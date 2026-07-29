/**
 * One-time / idempotent Shippo track_updated webhook registration.
 *
 * Requires in .env.local:
 *   SHIPPO_API_TOKEN
 *   SHIPPO_WEBHOOK_SECRET
 *   NEXT_PUBLIC_APP_URL  (public HTTPS origin Shippo can reach)
 *
 * Run: node scripts/tenant/ensure-shippo-webhooks.mjs
 */

import fs from "fs";
import path from "path";

function loadEnvLocal() {
  try {
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
  } catch {
    // ignore
  }
}

loadEnvLocal();

const token = (process.env.SHIPPO_API_TOKEN || "").trim();
const secret = (process.env.SHIPPO_WEBHOOK_SECRET || "").trim();
const base = (
  process.env.NEXT_PUBLIC_APP_URL ||
  process.env.APP_BASE_URL ||
  process.env.NEXT_PUBLIC_SITE_URL ||
  ""
)
  .trim()
  .replace(/\/$/, "");

if (!token) {
  console.error("Missing SHIPPO_API_TOKEN");
  process.exit(1);
}
if (!secret) {
  console.error(
    "Missing SHIPPO_WEBHOOK_SECRET (set any long random string; used as ?token= on the webhook URL)"
  );
  process.exit(1);
}
if (!base || /localhost|127\.0\.0\.1/i.test(base)) {
  console.error(
    "NEXT_PUBLIC_APP_URL must be a public HTTPS origin Shippo can reach (not localhost)."
  );
  console.error(
    "For local testing, use a tunnel URL (e.g. ngrok) as NEXT_PUBLIC_APP_URL, then re-run."
  );
  process.exit(1);
}

const webhookUrl = `${base}/api/webhooks/shippo?token=${encodeURIComponent(secret)}`;
const isTest = token.startsWith("shippo_test_");

const headers = {
  Authorization: `ShippoToken ${token}`,
  "Content-Type": "application/json",
};

const listed = await fetch("https://api.goshippo.com/webhooks", {
  method: "GET",
  headers,
});
if (!listed.ok) {
  console.error("List webhooks failed:", listed.status, await listed.text());
  process.exit(1);
}
const body = await listed.json();
const existing = (body.results || []).find((hook) => {
  const url = String(hook.url || "");
  const event = String(hook.event || "");
  return (
    hook.active !== false &&
    (event === "track_updated" || event === "all") &&
    (url === webhookUrl ||
      (url.includes("/api/webhooks/shippo") &&
        url.includes(encodeURIComponent(secret))))
  );
});

if (existing) {
  console.log("Already registered:", existing.url || webhookUrl);
  console.log("Event:", existing.event);
  process.exit(0);
}

const created = await fetch("https://api.goshippo.com/webhooks", {
  method: "POST",
  headers,
  body: JSON.stringify({
    url: webhookUrl,
    event: "track_updated",
    is_test: isTest,
  }),
});

if (!created.ok) {
  console.error("Create webhook failed:", created.status, await created.text());
  process.exit(1);
}

const result = await created.json();
console.log("Registered Shippo track_updated webhook");
console.log("URL:", result.url || webhookUrl);
console.log("Object id:", result.object_id || result.objectId || "—");
console.log("is_test:", isTest);
