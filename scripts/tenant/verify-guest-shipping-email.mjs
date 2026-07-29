/**
 * Verify automated guest shipping email configuration (and optional live send).
 *
 *   node scripts/tenant/verify-guest-shipping-email.mjs
 *   GUEST_SHIPPING_TEST_EMAIL=you@example.com node scripts/tenant/verify-guest-shipping-email.mjs
 */

import fs from "fs";
import path from "path";
import { createRequire } from "module";

const require = createRequire(import.meta.url);

function loadEnvLocal() {
  const envPath = path.resolve(process.cwd(), ".env.local");
  if (!fs.existsSync(envPath)) return;
  for (const line of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq < 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = value;
  }
}

loadEnvLocal();

function read(name) {
  return (process.env[name] || "").trim();
}

const missing = [];
if (!read("RESEND_API_KEY")) missing.push("RESEND_API_KEY");
const from =
  read("AUTH_EMAIL_FROM") || "One Eyrie Support <support@oneeyrie.com>";
if (!from.includes("@")) missing.push("AUTH_EMAIL_FROM");
const support = read("SUPPORT_EMAIL") || "support@oneeyrie.com";
if (!support.includes("@")) missing.push("SUPPORT_EMAIL");
const appUrl =
  read("NEXT_PUBLIC_APP_URL") ||
  read("NEXT_PUBLIC_SITE_URL") ||
  "http://localhost:3000";
if (!/^https?:\/\//i.test(appUrl)) missing.push("NEXT_PUBLIC_APP_URL");

console.log("Sender (from):", from);
console.log("Support / reply-to:", support);
console.log("App URL:", appUrl.replace(/\/$/, ""));

if (missing.length) {
  console.error("MISSING config:", missing.join(", "));
  process.exit(1);
}
console.log("PASS  Resend/auth email config present");

const testTo = read("GUEST_SHIPPING_TEST_EMAIL");
if (!testTo) {
  console.log(
    "SKIP  live Resend send (set GUEST_SHIPPING_TEST_EMAIL to send a real test)"
  );
  process.exit(0);
}

const { Resend } = require("resend");
const resend = new Resend(read("RESEND_API_KEY"));
const guestUrl = `${appUrl.replace(/\/$/, "")}/shipping-request/verify-test-token`;

const result = await resend.emails.send({
  from,
  to: testTo,
  replyTo: support,
  subject: "One Eyrie guest shipping email verification",
  html: `<p>This is a configuration test for automated Lost &amp; Found guest shipping.</p><p><a href="${guestUrl}">${guestUrl}</a></p>`,
  text: `Configuration test. Link: ${guestUrl}`,
});

if (result.error) {
  console.error("FAIL  Resend rejected:", result.error);
  process.exit(1);
}

console.log("PASS  Resend accepted test email", {
  to: testTo,
  messageId: result.data?.id || null,
  from,
});
