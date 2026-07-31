/**
 * Generate + diagnose final guest shipping email HTML, optionally send via Resend.
 *
 *   node scripts/tenant/preview-guest-shipping-email.mjs
 *   node scripts/tenant/preview-guest-shipping-email.mjs --send
 */
import fs from "fs";
import path from "path";
import { spawnSync } from "child_process";
import { createRequire } from "module";
import { fileURLToPath } from "url";

const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));

function loadEnvLocal() {
  const envPath = path.resolve(process.cwd(), ".env.local");
  if (!fs.existsSync(envPath)) return;
  for (const line of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const eq = t.indexOf("=");
    if (eq < 0) continue;
    const k = t.slice(0, eq).trim();
    let v = t.slice(eq + 1).trim();
    if (
      (v.startsWith('"') && v.endsWith('"')) ||
      (v.startsWith("'") && v.endsWith("'"))
    ) {
      v = v.slice(1, -1);
    }
    if (!process.env[k]) process.env[k] = v;
  }
}

loadEnvLocal();

const shouldSend = process.argv.includes("--send");
const previewPath = path.resolve(
  process.cwd(),
  "tmp-guest-shipping-email-preview.html"
);
const genFile = path.join(__dirname, "generate-guest-shipping-email-preview.ts");
const shim = path.join(__dirname, "shim-server-only.cjs");

const result = spawnSync(
  process.platform === "win32" ? "npx.cmd" : "npx",
  ["--yes", "tsx", "--require", shim, genFile],
  {
    encoding: "utf8",
    cwd: process.cwd(),
    shell: true,
    env: process.env,
  }
);

if (result.status !== 0) {
  console.error(result.stderr || result.stdout || "tsx failed");
  process.exit(1);
}

const stdout = (result.stdout || "").trim();
const jsonStart = stdout.indexOf("{");
if (jsonStart < 0) {
  console.error("No JSON from generator:\n", result.stdout, result.stderr);
  process.exit(1);
}

const content = JSON.parse(stdout.slice(jsonStart));

function diagnose(html) {
  const findings = [];
  const whitePatterns = [
    /background(?:-color)?\s*:\s*#fff(?:fff)?\b/gi,
    /background(?:-color)?\s*:\s*white\b/gi,
    /background(?:-color)?\s*:\s*rgb\s*\(\s*255\s*,\s*255\s*,\s*255\s*\)/gi,
    /background(?:-color)?\s*:\s*transparent\b/gi,
    /bgcolor\s*=\s*["']#fff(?:fff)?["']/gi,
    /bgcolor\s*=\s*["']white["']/gi,
  ];
  for (const re of whitePatterns) {
    const matches = html.match(re);
    if (matches?.length) {
      findings.push({
        severity: "error",
        issue: "white_background",
        count: matches.length,
        samples: matches.slice(0, 5),
      });
    }
  }

  if (/color-scheme|prefers-color-scheme/i.test(html)) {
    findings.push({ severity: "error", issue: "color_scheme_meta_or_css" });
  }
  if (/@media/i.test(html)) {
    findings.push({ severity: "error", issue: "media_query_present" });
  }
  if (/min-width\s*:/i.test(html)) {
    findings.push({ severity: "error", issue: "min_width_present" });
  }

  const attrWidths = [...html.matchAll(/\bwidth\s*=\s*["'](\d+)["']/gi)].map(
    (m) => Number(m[1])
  );
  const styleWidths = [
    ...html.matchAll(/(?:^|[^a-z-])width\s*:\s*(\d+)px/gi),
  ].map((m) => Number(m[1]));
  const over = [...attrWidths, ...styleWidths].filter((n) => n > 600);
  if (over.length) {
    findings.push({
      severity: "error",
      issue: "width_over_600",
      values: over,
    });
  }

  const withoutMso = html.replace(
    /<!--\[if mso\]>[\s\S]*?<!\[endif\]-->/gi,
    ""
  );
  if (/\bwidth\s*=\s*["']600["']/i.test(withoutMso)) {
    findings.push({
      severity: "error",
      issue: "fixed_width_600_attr_outside_mso",
    });
  }
  if (/(?:^|[^a-z-])width\s*:\s*600px/i.test(withoutMso)) {
    findings.push({
      severity: "error",
      issue: "fixed_width_600_style_outside_mso",
    });
  }

  const riskyDivs = [...html.matchAll(/<div\b([^>]*)>/gi)].filter((m) => {
    const attrs = m[1] || "";
    const hasColor = /color\s*:/i.test(attrs);
    const hasBg = /background-color\s*:|bgcolor\s*=/i.test(attrs);
    const isHidden = /display\s*:\s*none/i.test(attrs);
    return hasColor && !hasBg && !isHidden;
  });
  if (riskyDivs.length) {
    findings.push({
      severity: "error",
      issue: "div_text_without_background",
      count: riskyDivs.length,
    });
  }

  const hasBlackOuter =
    /bgcolor\s*=\s*["']#111111["']/i.test(html) &&
    /background-color\s*:\s*#111111/i.test(html);

  const hasFluidInner = /max-width\s*:\s*600px/i.test(html);

  // Greeting/body must sit on continuous #1a1a1a (not a separate card surface).
  const helloIdx = html.search(/Hello\s+/i);
  const goodNewsIdx = html.search(/Good news/i);
  const instructionsIdx = html.search(/Use the secure link below/i);
  const headingIdx = html.search(
    /<td\b[^>]*>[\s\S]{0,80}?Your Lost Item Has Been Found/i
  );

  function nearHasSurface(idx, label) {
    if (idx < 0) return;
    const window = html.slice(Math.max(0, idx - 500), idx + 120);
    if (!/#1a1a1a/i.test(window)) {
      findings.push({
        severity: "error",
        issue: `${label}_missing_1a1a1a_near_context`,
      });
    }
    if (!/background\s*:\s*#1a1a1a/i.test(window) || !/background-color\s*:\s*#1a1a1a/i.test(window)) {
      findings.push({
        severity: "error",
        issue: `${label}_missing_dual_background_shorthand`,
      });
    }
  }

  nearHasSurface(helloIdx, "greeting");
  nearHasSurface(goodNewsIdx, "good_news");
  nearHasSurface(instructionsIdx, "instructions");
  nearHasSurface(headingIdx, "heading");

  if (!/<tbody\b[^>]*bgcolor\s*=\s*["']#1a1a1a["']/i.test(html)) {
    findings.push({
      severity: "error",
      issue: "missing_tbody_bgcolor_1a1a1a",
    });
  }

  // Body copy must not be split across multiple sibling paragraph rows
  // (that pattern produced white bands in Gmail Mobile).
  const bodyRowSplits = (
    html.match(/padding:0 0 14px;background[^>]*>[\s\S]*?(?:Hello|Good news|Use the secure)/gi) ||
    []
  ).length;
  if (bodyRowSplits > 1) {
    findings.push({
      severity: "error",
      issue: "body_still_split_across_multiple_painted_rows",
      count: bodyRowSplits,
    });
  }

  if (/#211F1B/i.test(html)) {
    findings.push({
      severity: "error",
      issue: "legacy_211F1B_surface_present",
      count: (html.match(/#211F1B/gi) || []).length,
    });
  }

  // Every <td> should carry bgcolor (except none expected).
  const tds = html.match(/<td\b[^>]*>/gi) || [];
  const tdsMissingBgcolor = tds.filter((t) => !/bgcolor\s*=/i.test(t));
  if (tdsMissingBgcolor.length) {
    findings.push({
      severity: "error",
      issue: "td_missing_bgcolor",
      count: tdsMissingBgcolor.length,
      samples: tdsMissingBgcolor.slice(0, 3),
    });
  }

  return {
    ok:
      findings.filter((f) => f.severity === "error").length === 0 &&
      hasBlackOuter &&
      hasFluidInner,
    hasBlackOuter,
    hasFluidInner,
    htmlBytes: Buffer.byteLength(html, "utf8"),
    findings,
  };
}

fs.writeFileSync(previewPath, content.html, "utf8");
const report = diagnose(content.html);

console.log(
  JSON.stringify(
    {
      previewPath,
      subject: content.subject,
      diagnosis: report,
    },
    null,
    2
  )
);

if (!report.ok) {
  console.error("Diagnosis failed — not sending.");
  process.exit(1);
}

if (shouldSend) {
  const { Resend } = require("resend");
  const key = process.env.RESEND_API_KEY;
  const from = process.env.AUTH_EMAIL_FROM || process.env.EMAIL_FROM || "";
  const to =
    process.env.GUEST_SHIPPING_TEST_EMAIL ||
    process.env.EMAIL_PREVIEW_TO ||
    process.env.SUPPORT_EMAIL ||
    "dlnem835@gmail.com";
  if (!key || !from) {
    console.error("Missing RESEND_API_KEY or AUTH_EMAIL_FROM");
    process.exit(1);
  }
  const resend = new Resend(key);
  const sent = await resend.emails.send({
    from,
    to: [to],
    subject: `[PREVIEW] ${content.subject}`,
    html: content.html,
    text: content.text,
  });
  if (sent.error) {
    console.error(sent.error);
    process.exit(1);
  }
  console.log(
    JSON.stringify(
      {
        sent: true,
        toDomain: String(to).split("@")[1] || null,
        id: sent.data?.id || null,
      },
      null,
      2
    )
  );
}
