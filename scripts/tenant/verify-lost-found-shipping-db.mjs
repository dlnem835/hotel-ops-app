/**
 * Confirms Phase 1 migration objects via Supabase service role.
 * Does not print secrets.
 *
 * Run: node scripts/tenant/verify-lost-found-shipping-db.mjs
 */

import { createClient } from "@supabase/supabase-js";
import { readFileSync, existsSync } from "fs";
import { resolve } from "path";

function loadEnvLocal() {
  const path = resolve(process.cwd(), ".env.local");
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
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

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const supabase = createClient(url, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

let failures = 0;
function pass(name) {
  console.log(`PASS  ${name}`);
}
function fail(name, detail) {
  failures += 1;
  console.error(`FAIL  ${name}: ${detail}`);
}

async function tableReachable(name) {
  const { error } = await supabase.from(name).select("*").limit(0);
  if (error) {
    fail(`table ${name}`, error.message);
    return false;
  }
  pass(`table ${name} reachable`);
  return true;
}

async function main() {
  for (const table of [
    "property_shipping_settings",
    "lost_found_shipping_requests",
    "lost_found_shipping_events",
    "payments",
    "payment_webhook_receipts",
  ]) {
    await tableReachable(table);
  }

  // Probe expected columns via a filtered empty select.
  const { error: colError } = await supabase
    .from("lost_found_shipping_requests")
    .select(
      "id, organization_id, property_id, lost_item_id, secure_token_hash, token_expires_at, payment_status, fulfillment_status, shipment_status, quoted_shipping_amount, total_amount, label_storage_path, successful_payment_id, paid_at"
    )
    .limit(0);
  if (colError) fail("shipping_requests core columns", colError.message);
  else pass("shipping_requests core columns selectable");

  const { error: paymentsColError } = await supabase
    .from("payments")
    .select(
      "id, organization_id, property_id, purpose, shipping_request_id, provider, provider_checkout_session_id, provider_payment_intent_id, amount_cents, currency, status, failure_reason, processed_webhook_event_ids, paid_at"
    )
    .limit(0);
  if (paymentsColError) fail("payments columns", paymentsColError.message);
  else pass("payments columns selectable");

  // Stripe-specific columns must not remain on shipping requests after 052.
  const { error: legacyStripeError } = await supabase
    .from("lost_found_shipping_requests")
    .select("stripe_checkout_session_id")
    .limit(0);
  if (!legacyStripeError) {
    fail(
      "shipping_requests stripe columns removed",
      "stripe_checkout_session_id still selectable — apply migration 052"
    );
  } else {
    pass("shipping_requests stripe columns removed");
  }
  const { error: settingsColError } = await supabase
    .from("property_shipping_settings")
    .select(
      "property_id, organization_id, shipping_enabled, ship_from_line1, ship_from_city, ship_from_state, ship_from_postal, token_ttl_hours"
    )
    .limit(0);
  if (settingsColError) fail("property_shipping_settings columns", settingsColError.message);
  else pass("property_shipping_settings columns selectable");

  // Unique token index behavior: insert without required FKs should fail predictably,
  // proving table constraints exist (not anon-writable freeform).
  const { error: insertError } = await supabase
    .from("lost_found_shipping_requests")
    .insert({ secure_token_hash: "probe-should-fail" });
  if (!insertError) {
    fail("shipping_requests FK/required constraints", "insert unexpectedly succeeded");
  } else {
    pass(`shipping_requests rejects incomplete insert (${insertError.code || "error"})`);
  }

  const { data: buckets, error: bucketError } = await supabase.storage.listBuckets();
  if (bucketError) {
    fail("list storage buckets", bucketError.message);
  } else {
    const privateBucket = (buckets || []).find(
      (b) => b.id === "lost-found-shipping-labels" || b.name === "lost-found-shipping-labels"
    );
    const publicManual = (buckets || []).find(
      (b) => b.id === "shipping-labels" || b.name === "shipping-labels"
    );
    if (!privateBucket) fail("private label bucket", "lost-found-shipping-labels not found");
    else if (privateBucket.public === true) {
      fail("private label bucket", "bucket is public (must be private)");
    } else pass("private bucket lost-found-shipping-labels exists and is private");

    if (!publicManual) fail("manual label bucket", "shipping-labels not found");
    else pass("manual public bucket shipping-labels still present");
  }

  // Anon should not freely read shipping requests (RLS).
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (anonKey) {
    const anon = createClient(url, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: anonRows, error: anonError } = await anon
      .from("lost_found_shipping_requests")
      .select("id")
      .limit(5);
    if (anonError) {
      pass(`anon select blocked or errored as expected (${anonError.code || "error"})`);
    } else if (!anonRows || anonRows.length === 0) {
      pass("anon select returns no rows (RLS effective for unauthenticated)");
    } else {
      fail("anon RLS", `anon read returned ${anonRows.length} row(s)`);
    }
  } else {
    console.log("SKIP  anon RLS probe (NEXT_PUBLIC_SUPABASE_ANON_KEY missing)");
  }

  if (failures > 0) {
    console.error(`\n${failures} DB check(s) failed`);
    process.exit(1);
  }
  console.log("\nPhase 1 DB object checks passed.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
