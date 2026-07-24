/**
 * Probe Checkpoint C2 readiness (migration + Stripe env). Does not print secrets.
 * Run: node scripts/tenant/probe-checkpoint-c2-ready.mjs
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

const { createClient } = require("@supabase/supabase-js");
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false, autoRefreshToken: false } }
);

async function main() {
  for (const table of [
    "payments",
    "payment_webhook_receipts",
    "lost_found_shipping_requests",
  ]) {
    const { error } = await supabase.from(table).select("id").limit(0);
    console.log(`${table}: ${error ? `MISSING — ${error.message}` : "ok"}`);
  }

  const { error: successCol } = await supabase
    .from("lost_found_shipping_requests")
    .select("successful_payment_id")
    .limit(0);
  console.log(
    `successful_payment_id: ${successCol ? successCol.message : "ok"}`
  );

  const { error: legacy } = await supabase
    .from("lost_found_shipping_requests")
    .select("stripe_checkout_session_id")
    .limit(0);
  console.log(
    `legacy stripe_checkout_session_id: ${
      legacy ? "removed (good)" : "STILL PRESENT — apply migration 052"
    }`
  );

  const secret = (process.env.STRIPE_SECRET_KEY || "").trim();
  const webhook = (process.env.STRIPE_WEBHOOK_SECRET || "").trim();
  console.log(
    `STRIPE_SECRET_KEY: ${
      !secret
        ? "missing"
        : secret.startsWith("sk_test_")
          ? "sk_test_ present"
          : secret.startsWith("sk_live_")
            ? "LIVE KEY BLOCKED"
            : "unexpected format"
    }`
  );
  console.log(
    `STRIPE_WEBHOOK_SECRET: ${
      !webhook
        ? "missing"
        : webhook.startsWith("whsec_")
          ? "whsec_ present"
          : "unexpected format"
    }`
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
