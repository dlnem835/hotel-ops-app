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

/** Checks for restored 598bc6c dark shell + current heading/CTA. */
function diagnose(html) {
  const findings = [];
  const whitePatterns = [
    /background(?:-color)?\s*:\s*#fff(?:fff)?\b/gi,
    /background(?:-color)?\s*:\s*white\b/gi,
    /background(?:-color)?\s*:\s*rgb\s*\(\s*255\s*,\s*255\s*,\s*255\s*\)/gi,
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

  if (!/Your Lost Item Has Been Found/i.test(html)) {
    findings.push({ severity: "error", issue: "missing_current_heading" });
  }
  if (!/Choose Shipping and Pay/i.test(html)) {
    findings.push({ severity: "error", issue: "missing_current_cta" });
  }
  if (/We['’]ve Located Your Item/i.test(html)) {
    findings.push({
      severity: "error",
      issue: "old_598bc6c_heading_still_present",
    });
  }

  const hasBlackOuter =
    /bgcolor\s*=\s*["']#111111["']/i.test(html) &&
    /background-color\s*:\s*#111111/i.test(html);
  if (!hasBlackOuter) {
    findings.push({ severity: "error", issue: "missing_black_outer" });
  }

  const hasCard =
    /class="oe-email-card"/i.test(html) &&
    /max-width\s*:\s*560px/i.test(html) &&
    /border:\s*1px solid/i.test(html);
  if (!hasCard) {
    findings.push({ severity: "error", issue: "missing_598bc6c_card_shell" });
  }

  if (!/alt="One Eyrie"/i.test(html)) {
    findings.push({ severity: "error", issue: "missing_logo_header" });
  }

  if (!/color-scheme:\s*dark light/i.test(html)) {
    findings.push({
      severity: "error",
      issue: "missing_598bc6c_color_scheme",
    });
  }

  if (!/Hotel contact/i.test(html)) {
    findings.push({ severity: "error", issue: "missing_hotel_contact_block" });
  }

  return {
    ok: findings.filter((f) => f.severity === "error").length === 0,
    hasBlackOuter,
    hasCard,
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
