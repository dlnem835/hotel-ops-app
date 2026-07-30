/**
 * Diagnose recent shipping payments after a live Stripe charge.
 * Never prints full secret values or full Stripe session IDs.
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

function redactId(id) {
  if (!id) return null;
  const s = String(id);
  if (s.length <= 12) return s.slice(0, 4) + "…";
  return s.slice(0, 12) + "…" + s.slice(-4);
}

loadEnvLocal();
const { createClient } = require("@supabase/supabase-js");
const Stripe = require("stripe");

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false, autoRefreshToken: false } }
);

const secret = (process.env.STRIPE_SECRET_KEY || "").trim();
const webhook = (process.env.STRIPE_WEBHOOK_SECRET || "").trim();

console.log("=== Local Stripe env (safe) ===");
console.log({
  secretPresent: Boolean(secret),
  secretMode: secret.startsWith("sk_live_")
    ? "live"
    : secret.startsWith("sk_test_")
      ? "test"
      : "unknown",
  webhookPresent: Boolean(webhook),
  webhookPrefix: webhook ? webhook.slice(0, 6) : null,
  webhookLooksLikeCli:
    webhook.includes("whsec_") && webhook.length < 40 ? "maybe_short" : "normal_length",
  webhookLength: webhook ? webhook.length : 0,
});

const paymentsRes = await sb
  .from("payments")
  .select(
    "id,status,amount_cents,currency,shipping_request_id,provider_checkout_session_id,provider_payment_intent_id,failure_reason,paid_at,created_at,organization_id,property_id,purpose,metadata_json"
  )
  .order("created_at", { ascending: false })
  .limit(20);

if (paymentsRes.error) {
  console.error("payments query failed", paymentsRes.error.message);
  process.exit(1);
}

const payments = paymentsRes.data || [];
console.log("\n=== Recent payments ===");
for (const p of payments) {
  console.log({
    id: p.id,
    status: p.status,
    amount_cents: p.amount_cents,
    dollars: (Number(p.amount_cents) / 100).toFixed(2),
    currency: p.currency,
    shipping_request_id: p.shipping_request_id,
    session: redactId(p.provider_checkout_session_id),
    pi: redactId(p.provider_payment_intent_id),
    failure_reason: p.failure_reason,
    paid_at: p.paid_at,
    created_at: p.created_at,
  });
}

const target =
  payments.find((p) => Number(p.amount_cents) === 1075) ||
  payments.find((p) => p.status !== "paid") ||
  payments[0];

if (!target) {
  console.log("No payments found");
  process.exit(0);
}

console.log("\n=== Focus payment ===", {
  id: target.id,
  status: target.status,
  amount_cents: target.amount_cents,
  session: redactId(target.provider_checkout_session_id),
});

const reqId = target.shipping_request_id;
if (reqId) {
  const { data: req, error } = await sb
    .from("lost_found_shipping_requests")
    .select(
      "id,payment_status,paid_at,fulfillment_status,shipment_status,tracking_number,label_url,label_storage_path,provider_transaction_id,provider_rate_id,selected_carrier,selected_service,error_message,successful_payment_id,total_amount,quoted_shipping_amount,label_purchase_lock_at,label_purchase_idempotency_key,updated_at"
    )
    .eq("id", reqId)
    .maybeSingle();
  console.log("\n=== Shipping request ===");
  console.log(error?.message || req);
}

const { data: receipts } = await sb
  .from("payment_webhook_receipts")
  .select("provider,provider_event_id,event_type,payment_id,created_at")
  .order("created_at", { ascending: false })
  .limit(25);
console.log("\n=== Recent webhook receipts ===");
console.log(
  (receipts || []).map((r) => ({
    event_type: r.event_type,
    payment_id: r.payment_id,
    event: redactId(r.provider_event_id),
    created_at: r.created_at,
  }))
);

const { data: events } = await sb
  .from("lost_found_shipping_events")
  .select("event_type,event_source,event_data,created_at,shipping_request_id")
  .eq("shipping_request_id", reqId)
  .order("created_at", { ascending: false })
  .limit(20);
console.log("\n=== Timeline for request ===");
console.log(
  (events || []).map((e) => ({
    event_type: e.event_type,
    event_source: e.event_source,
    notes: e.event_data?.notes || null,
    created_at: e.created_at,
  }))
);

if (secret.startsWith("sk_live_") || secret.startsWith("sk_test_")) {
  const stripe = new Stripe(secret, { typescript: false });
  console.log("\n=== Stripe API (same mode as local secret) ===");
  try {
    const endpoints = await stripe.webhookEndpoints.list({ limit: 20 });
    console.log(
      "webhook_endpoints",
      endpoints.data.map((e) => ({
        id: redactId(e.id),
        url: e.url,
        status: e.status,
        livemode: e.livemode,
        enabled_events: e.enabled_events,
      }))
    );
  } catch (err) {
    console.log(
      "webhookEndpoints.list failed:",
      err instanceof Error ? err.message : String(err)
    );
  }

  if (target.provider_checkout_session_id) {
    try {
      const session = await stripe.checkout.sessions.retrieve(
        target.provider_checkout_session_id
      );
      console.log("\n=== Checkout session from local secret mode ===");
      console.log({
        id: redactId(session.id),
        livemode: session.livemode,
        status: session.status,
        payment_status: session.payment_status,
        amount_total: session.amount_total,
        currency: session.currency,
        metadata: session.metadata,
        payment_intent: redactId(
          typeof session.payment_intent === "string"
            ? session.payment_intent
            : session.payment_intent?.id
        ),
      });
    } catch (err) {
      console.log(
        "session.retrieve failed (likely mode mismatch vs live payment):",
        err instanceof Error ? err.message : String(err)
      );
    }
  }
}
