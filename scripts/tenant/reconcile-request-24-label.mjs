/**
 * Reconcile shipping request #24 after live Stripe payment:
 * re-quote Shippo rates, purchase label once, update DB.
 * Never charges Stripe. Idempotent if tracking already present.
 *
 * Usage:
 *   node scripts/tenant/reconcile-request-24-label.mjs --dry-run
 *   node scripts/tenant/reconcile-request-24-label.mjs
 */
import fs from "fs";
import path from "path";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const REQUEST_ID = 24;

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
  return s.length <= 14 ? `${s.slice(0, 6)}…` : `${s.slice(0, 12)}…${s.slice(-4)}`;
}

function parseAddress(raw) {
  if (!raw) return null;
  const obj = typeof raw === "string" ? JSON.parse(raw) : raw;
  return {
    name: String(obj.name || "").trim(),
    street1: String(obj.line1 || obj.street1 || "").trim(),
    street2: String(obj.line2 || obj.street2 || "").trim() || undefined,
    city: String(obj.city || "").trim(),
    state: String(obj.state || "").trim(),
    zip: String(obj.postal || obj.zip || "").trim(),
    country: String(obj.country || "US").trim().toUpperCase(),
    phone: obj.phone ? String(obj.phone).trim() : undefined,
    email: obj.email ? String(obj.email).trim() : undefined,
  };
}

function normalize(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ");
}

async function shippoFetch(token, pathname, init = {}) {
  const response = await fetch(`https://api.goshippo.com${pathname}`, {
    ...init,
    headers: {
      Authorization: `ShippoToken ${token}`,
      "Content-Type": "application/json",
      ...(init.headers || {}),
    },
  });
  const text = await response.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = { raw: text };
  }
  if (!response.ok) {
    const detail =
      json?.detail ||
      json?.messages?.map((m) => m.text).filter(Boolean).join("; ") ||
      text.slice(0, 300);
    throw new Error(`Shippo ${pathname} ${response.status}: ${detail}`);
  }
  return json;
}

loadEnvLocal();
const dryRun = process.argv.includes("--dry-run");
const token = String(process.env.SHIPPO_API_TOKEN || "").trim();
const providerMode = String(process.env.SHIPPING_PROVIDER || "").toLowerCase();

if (providerMode !== "shippo" || !token.startsWith("shippo_")) {
  console.error("Need SHIPPING_PROVIDER=shippo and SHIPPO_API_TOKEN");
  process.exit(1);
}

const { createClient } = require("@supabase/supabase-js");
const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

const { data: row, error } = await sb
  .from("lost_found_shipping_requests")
  .select("*")
  .eq("id", REQUEST_ID)
  .single();
if (error || !row) {
  console.error(error || "Request not found");
  process.exit(1);
}

console.log(
  JSON.stringify(
    {
      dryRun,
      shippoMode: token.startsWith("shippo_live_") ? "live" : "test",
      before: {
        payment_status: row.payment_status,
        fulfillment_status: row.fulfillment_status,
        provider_rate_id: row.provider_rate_id,
        tracking_number: row.tracking_number,
        provider_transaction_id: redact(row.provider_transaction_id),
        error_message: row.error_message,
        org: row.organization_id,
        property: row.property_id,
        lost_item_id: row.lost_item_id,
      },
    },
    null,
    2
  )
);

if (String(row.payment_status) !== "paid") {
  console.error("Refusing: payment_status is not paid");
  process.exit(1);
}

if (row.tracking_number && String(row.fulfillment_status) === "label_ready") {
  console.log("Already labeled — nothing to do.");
  process.exit(0);
}

const shipFrom = parseAddress(row.ship_from_address_json);
const shipTo = parseAddress(row.recipient_address_json);
const parcel = {
  length: String(row.length_in),
  width: String(row.width_in),
  height: String(row.height_in),
  distance_unit: "in",
  weight: String(Number(row.weight_oz) / 16),
  mass_unit: "lb",
};

if (!shipFrom?.street1 || !shipTo?.street1) {
  console.error("Missing ship-from or destination address");
  process.exit(1);
}

if (dryRun) {
  console.log("Dry run OK — would re-quote and purchase.");
  process.exit(0);
}

const shipment = await shippoFetch(token, "/shipments/", {
  method: "POST",
  body: JSON.stringify({
    address_from: shipFrom,
    address_to: shipTo,
    parcels: [parcel],
    async: false,
  }),
});

const rates = Array.isArray(shipment.rates) ? shipment.rates : [];
if (rates.length === 0) {
  console.error("No Shippo rates returned");
  process.exit(1);
}

const targetCarrier = normalize(row.selected_carrier);
const targetService = normalize(row.selected_service);
const targetAmount = Number(row.total_amount ?? row.quoted_shipping_amount);

let selected =
  rates.find(
    (rate) =>
      normalize(rate.provider) === targetCarrier &&
      (normalize(rate.servicelevel?.name) === targetService ||
        normalize(rate.servicelevel?.name).includes(targetService) ||
        targetService.includes(normalize(rate.servicelevel?.name)))
  ) || null;

if (!selected && Number.isFinite(targetAmount) && targetAmount > 0) {
  selected = [...rates].sort(
    (a, b) =>
      Math.abs(Number(a.amount) - targetAmount) -
      Math.abs(Number(b.amount) - targetAmount)
  )[0];
}
if (!selected) selected = rates[0];

const providerRateId = String(selected.object_id);
const carrier = String(selected.provider || row.selected_carrier || "");
const service = String(selected.servicelevel?.name || row.selected_service || "");
const amount = Number(selected.amount);

console.log(
  JSON.stringify(
    {
      selected: {
        providerRateId: redact(providerRateId),
        carrier,
        service,
        amount,
        currency: selected.currency,
      },
      rateCount: rates.length,
    },
    null,
    2
  )
);

await sb
  .from("lost_found_shipping_requests")
  .update({
    provider_rate_id: providerRateId,
    selected_carrier: carrier,
    selected_service: service,
    quoted_shipping_amount: amount,
    total_amount: amount,
    currency: String(selected.currency || "USD").toLowerCase(),
    rate_snapshot_json: rates.map((rate) => ({
      providerRateId: rate.object_id,
      carrier: rate.provider,
      service: rate.servicelevel?.name,
      amount: Number(rate.amount),
      currency: rate.currency,
    })),
    rate_expires_at: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
    fulfillment_status: "pending",
    error_message: null,
    label_purchase_lock_at: new Date().toISOString(),
    label_purchase_idempotency_key:
      row.label_purchase_idempotency_key ||
      `lf-ship-${REQUEST_ID}-pay-${row.successful_payment_id || "paid"}`,
    updated_at: new Date().toISOString(),
  })
  .eq("id", REQUEST_ID)
  .eq("organization_id", row.organization_id)
  .eq("property_id", row.property_id)
  .eq("payment_status", "paid");

const idempotencyKey =
  row.label_purchase_idempotency_key ||
  `lf-ship-${REQUEST_ID}-pay-${row.successful_payment_id || "paid"}`;

let transaction;
try {
  transaction = await shippoFetch(token, "/transactions/", {
    method: "POST",
    body: JSON.stringify({
      rate: providerRateId,
      async: false,
      label_file_type: "PDF",
      metadata: String(idempotencyKey).slice(0, 100),
    }),
  });
} catch (purchaseError) {
  const message =
    purchaseError instanceof Error
      ? purchaseError.message
      : "Shippo purchase failed";
  await sb
    .from("lost_found_shipping_requests")
    .update({
      fulfillment_status: "needs_manual_review",
      error_message: message.slice(0, 500),
      label_purchase_lock_at: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", REQUEST_ID);
  console.error(JSON.stringify({ ok: false, error: message }, null, 2));
  process.exit(1);
}

const status = String(transaction.status || "").toUpperCase();
if (status !== "SUCCESS") {
  const detail = (transaction.messages || [])
    .map((m) => String(m.text || "").trim())
    .filter(Boolean)
    .join("; ");
  const message = detail || `Shippo status=${status}`;
  await sb
    .from("lost_found_shipping_requests")
    .update({
      fulfillment_status: "needs_manual_review",
      error_message: message.slice(0, 500),
      label_purchase_lock_at: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", REQUEST_ID);
  console.error(
    JSON.stringify(
      {
        ok: false,
        transactionId: redact(transaction.object_id),
        status,
        error: message,
        postageCharged: false,
      },
      null,
      2
    )
  );
  process.exit(1);
}

const trackingNumber = transaction.tracking_number
  ? String(transaction.tracking_number)
  : null;
const trackingUrl = transaction.tracking_url_provider
  ? String(transaction.tracking_url_provider)
  : null;
const labelUrl = transaction.label_url ? String(transaction.label_url) : null;
const providerTransactionId = String(transaction.object_id);

let labelStoragePath = null;
if (labelUrl) {
  try {
    const pdfRes = await fetch(labelUrl);
    if (pdfRes.ok) {
      const bytes = Buffer.from(await pdfRes.arrayBuffer());
      const storagePath = `${row.organization_id}/${row.property_id}/${REQUEST_ID}/label.pdf`;
      const { error: uploadError } = await sb.storage
        .from("lost-found-shipping-labels")
        .upload(storagePath, bytes, {
          contentType: "application/pdf",
          upsert: true,
        });
      if (!uploadError) labelStoragePath = storagePath;
    }
  } catch {
    // keep label_url path via tracking; staff can retry print from Shippo URL if needed
  }
}

const nowIso = new Date().toISOString();
await sb
  .from("lost_found_shipping_requests")
  .update({
    fulfillment_status: "label_ready",
    shipment_status: "label_ready",
    tracking_number: trackingNumber,
    tracking_url: trackingUrl,
    label_storage_path: labelStoragePath,
    provider_transaction_id: providerTransactionId,
    label_created_at: nowIso,
    carrier_tracking_status: "pre_transit",
    carrier_tracking_raw: "PRE_TRANSIT",
    carrier_tracking_updated_at: nowIso,
    label_purchase_lock_at: null,
    error_message: null,
    updated_at: nowIso,
  })
  .eq("id", REQUEST_ID)
  .eq("organization_id", row.organization_id)
  .eq("property_id", row.property_id);

await sb
  .from("lost_items")
  .update({ status: "Ready to Ship", updated_at: nowIso })
  .eq("id", row.lost_item_id)
  .eq("organization_id", row.organization_id)
  .eq("property_id", row.property_id)
  .neq("status", "Discarded");

await sb.from("lost_found_shipping_events").insert({
  organization_id: row.organization_id,
  property_id: row.property_id,
  lost_item_id: row.lost_item_id,
  shipping_request_id: REQUEST_ID,
  event_type: "label_purchased",
  event_source: "system",
  event_data: {
    notes: `Reconcile script purchased Shippo label (${token.startsWith("shippo_live_") ? "live" : "test"})`,
    providerTransactionId: redact(providerTransactionId),
    trackingNumber,
  },
});

console.log(
  JSON.stringify(
    {
      ok: true,
      transactionId: redact(providerTransactionId),
      status: "SUCCESS",
      postageCharged: token.startsWith("shippo_live_"),
      trackingNumber,
      trackingUrl,
      labelStoragePath,
      labelUrl: labelUrl ? redact(labelUrl) : null,
    },
    null,
    2
  )
);
