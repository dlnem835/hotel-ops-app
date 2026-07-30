/**
 * List recent Stripe webhook receipts (no secrets).
 * Run: node scripts/tenant/list-stripe-webhook-receipts.mjs
 */
import fs from "fs";
import path from "path";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const envPath = path.resolve(process.cwd(), ".env.local");
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

function redact(id) {
  if (!id) return null;
  const s = String(id);
  return s.length <= 14
    ? `${s.slice(0, 6)}…`
    : `${s.slice(0, 12)}…${s.slice(-4)}`;
}

const { createClient } = require("@supabase/supabase-js");
const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

const { data, error } = await sb
  .from("payment_webhook_receipts")
  .select(
    "provider_event_id,event_type,payment_id,organization_id,property_id,processed_at"
  )
  .order("processed_at", { ascending: false })
  .limit(25);

if (error) {
  console.error(error);
  process.exit(1);
}

const rows = (data || []).map((row) => ({
  event_type: row.event_type,
  payment_id: row.payment_id,
  organization_id: row.organization_id,
  property_id: row.property_id,
  event: redact(row.provider_event_id),
  is_live_stripe_event: String(row.provider_event_id || "").startsWith("evt_"),
  processed_at: row.processed_at,
}));

const liveCompleted = rows.filter(
  (row) =>
    row.is_live_stripe_event &&
    (row.event_type === "checkout.session.completed" ||
      row.event_type === "checkout.session.async_payment_succeeded")
);

console.log(
  JSON.stringify(
    {
      totalListed: rows.length,
      liveCheckoutCompletedCount: liveCompleted.length,
      latestLiveCheckoutCompleted: liveCompleted[0] || null,
      receipts: rows,
    },
    null,
    2
  )
);
