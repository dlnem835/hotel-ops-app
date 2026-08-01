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

/** Light guest shipping-request email + single Shippo CTA. */
function diagnose(html) {
  const findings = [];

  if (/color-scheme|prefers-color-scheme/i.test(html)) {
    findings.push({ severity: "error", issue: "color_scheme_present" });
  }
  if (/@media[^{]*prefers-color-scheme/i.test(html)) {
    findings.push({ severity: "error", issue: "prefers_color_scheme_media" });
  }

  if (!/Your Lost Item Has Been Found/i.test(html)) {
    findings.push({ severity: "error", issue: "missing_current_heading" });
  }
  if (!/Choose Shipping and Pay/i.test(html)) {
    findings.push({ severity: "error", issue: "missing_current_cta" });
  }

  const carrierButtons = [
    ...html.matchAll(/>\s*(UPS|FedEx|USPS)\s*</gi),
  ].map((m) => m[1]);
  if (carrierButtons.length) {
    findings.push({
      severity: "error",
      issue: "carrier_buttons_present",
      values: carrierButtons,
    });
  }
  if (/Upload Shipping Label/i.test(html)) {
    findings.push({ severity: "error", issue: "legacy_upload_cta_present" });
  }

  const hasWhiteOuter =
    /bgcolor\s*=\s*["']#FFFFFF["']/i.test(html) &&
    /background-color\s*:\s*#FFFFFF/i.test(html);
  if (!hasWhiteOuter) {
    findings.push({ severity: "error", issue: "missing_white_outer" });
  }

  if (!/#111111/i.test(html)) {
    findings.push({ severity: "error", issue: "missing_primary_text_color" });
  }
  if (!/#4A4A4A/i.test(html)) {
    findings.push({ severity: "error", issue: "missing_secondary_text_color" });
  }
  if (!/#D4AF37/i.test(html)) {
    findings.push({ severity: "error", issue: "missing_gold_accent" });
  }
  if (!/#F7F7F5/i.test(html)) {
    findings.push({ severity: "error", issue: "missing_card_background" });
  }

  // Large dark content sections should not exist (header-only black is OK).
  const darkBodyHits = (
    html.match(/#211F1B|#1[Aa]1815|#1a1a1a/gi) || []
  ).length;
  if (darkBodyHits > 0) {
    findings.push({
      severity: "error",
      issue: "dark_content_surface_present",
      count: darkBodyHits,
    });
  }

  const hasLightShell =
    /max-width\s*:\s*600px/i.test(html) &&
    />\s*ONE\s*</i.test(html) &&
    /EYRIE/i.test(html) &&
    /Lost\s*&amp;\s*Found Shipping Request/i.test(html);
  if (!hasLightShell) {
    findings.push({ severity: "error", issue: "missing_light_shell" });
  }

  if (!/Hotel/i.test(html)) {
    findings.push({ severity: "error", issue: "missing_hotel_block" });
  }
  if (/Ship From/i.test(html)) {
    findings.push({ severity: "error", issue: "legacy_ship_from_label_present" });
  }
  if (/Instructions/i.test(html)) {
    findings.push({ severity: "error", issue: "instructions_card_still_present" });
  }
  if (!/<span[^>]*>Item<\/span>/i.test(html)) {
    findings.push({ severity: "error", issue: "missing_item_block" });
  }

  return {
    ok: findings.filter((f) => f.severity === "error").length === 0,
    hasWhiteOuter,
    hasLightShell,
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
