/**
 * Deep diagnosis for paid live shipping request #24 / payment #14.
 * No secrets, no new charges.
 */
import fs from "fs";
import path from "path";
import { createRequire } from "module";

const require = createRequire(import.meta.url);

function loadEnvLocal() {
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
}

function redact(id) {
  if (!id) return null;
  const s = String(id);
  return s.length <= 14 ? s.slice(0, 6) + "…" : s.slice(0, 12) + "…" + s.slice(-4);
}

loadEnvLocal();
const { createClient } = require("@supabase/supabase-js");
const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

const { data: payment } = await sb
  .from("payments")
  .select("*")
  .eq("id", 14)
  .single();

const { data: req } = await sb
  .from("lost_found_shipping_requests")
  .select("*")
  .eq("id", 24)
  .single();

const { data: item } = await sb
  .from("lost_and_found")
  .select("id, status, item_name, organization_id, property_id")
  .eq("id", req?.lost_item_id)
  .maybeSingle();

const { data: receipts } = await sb
  .from("payment_webhook_receipts")
  .select("provider_event_id,event_type,payment_id,processed_at")
  .or(`payment_id.eq.14,provider_event_id.ilike.%${String(payment?.provider_checkout_session_id || "").slice(0, 20)}%`)
  .order("processed_at", { ascending: false })
  .limit(20);

const { data: events } = await sb
  .from("lost_found_shipping_events")
  .select("event_type,event_source,event_data,created_at")
  .eq("shipping_request_id", 24)
  .order("created_at", { ascending: false })
  .limit(30);

console.log(
  JSON.stringify(
    {
      env: {
        SHIPPING_PROVIDER: process.env.SHIPPING_PROVIDER || null,
        stripeSecretMode: String(process.env.STRIPE_SECRET_KEY || "").startsWith(
          "sk_live_"
        )
          ? "live"
          : String(process.env.STRIPE_SECRET_KEY || "").startsWith("sk_test_")
            ? "test"
            : "missing/unknown",
        shippoTokenPrefix: String(process.env.SHIPPO_API_TOKEN || "").slice(0, 12) || null,
      },
      payment: payment
        ? {
            id: payment.id,
            status: payment.status,
            amount_cents: payment.amount_cents,
            paid_at: payment.paid_at,
            organization_id: payment.organization_id,
            property_id: payment.property_id,
            shipping_request_id: payment.shipping_request_id,
            session: redact(payment.provider_checkout_session_id),
            payment_intent: redact(payment.provider_payment_intent_id),
            metadata: payment.metadata_json,
            failure_reason: payment.failure_reason,
          }
        : null,
      request: req
        ? {
            id: req.id,
            organization_id: req.organization_id,
            property_id: req.property_id,
            lost_item_id: req.lost_item_id,
            payment_status: req.payment_status,
            paid_at: req.paid_at,
            fulfillment_status: req.fulfillment_status,
            shipment_status: req.shipment_status,
            provider_rate_id: req.provider_rate_id,
            selected_carrier: req.selected_carrier,
            selected_service: req.selected_service,
            tracking_number: req.tracking_number || null,
            tracking_url: req.tracking_url || null,
            label_storage_path: req.label_storage_path || null,
            provider_transaction_id: req.provider_transaction_id || null,
            error_message: req.error_message || null,
            successful_payment_id: req.successful_payment_id,
            label_purchase_idempotency_key: req.label_purchase_idempotency_key,
            total_amount: req.total_amount,
          }
        : null,
      lost_item: item,
      webhook_receipts: (receipts || []).map((r) => ({
        event_type: r.event_type,
        payment_id: r.payment_id,
        event: redact(r.provider_event_id),
        processed_at: r.processed_at,
      })),
      timeline: (events || []).map((e) => ({
        event_type: e.event_type,
        event_source: e.event_source,
        notes: e.event_data?.notes || null,
        created_at: e.created_at,
      })),
    },
    null,
    2
  )
);
