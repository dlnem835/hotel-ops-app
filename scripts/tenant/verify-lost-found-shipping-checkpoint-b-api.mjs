/**
 * Exercise guest HTTP API against the local Next server for Checkpoint B.
 * Run after: npm run dev
 *   node scripts/tenant/verify-lost-found-shipping-checkpoint-b-api.mjs [optionalGuestToken]
 */

import fs from "fs";
import path from "path";
import { createHash, randomBytes } from "crypto";
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

const baseUrl = (process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000").replace(
  /\/$/,
  ""
);
const { createClient } = require("@supabase/supabase-js");
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false, autoRefreshToken: false } }
);

async function postGuest(token, body) {
  const response = await fetch(
    `${baseUrl}/api/shipping-request/${encodeURIComponent(token)}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }
  );
  const json = await response.json();
  return { response, json };
}

async function main() {
  const { data: settings, error: settingsError } = await supabase
    .from("property_shipping_settings")
    .select("*")
    .eq("shipping_enabled", true)
    .limit(1)
    .maybeSingle();
  if (settingsError) throw settingsError;
  if (!settings) throw new Error("No enabled property shipping settings");

  const orgId = Number(settings.organization_id);
  const propertyId = Number(settings.property_id);

  const { data: item, error: itemError } = await supabase
    .from("lost_items")
    .insert({
      organization_id: orgId,
      property_id: propertyId,
      item_name: "Checkpoint B API guest flow",
      guest_last_name: "ApiDemo",
      status: "Awaiting Guest Action",
      comments: "API demo — safe to delete",
    })
    .select("id")
    .single();
  if (itemError) throw itemError;

  const rawToken = randomBytes(32).toString("base64url");
  const tokenHash = createHash("sha256").update(rawToken, "utf8").digest("hex");
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

  const { error: requestError } = await supabase
    .from("lost_found_shipping_requests")
    .insert({
      organization_id: orgId,
      property_id: propertyId,
      lost_item_id: item.id,
      secure_token_hash: tokenHash,
      token_expires_at: expiresAt,
      guest_name: "API Demo Guest",
      guest_email: "api-demo@example.com",
      item_description_public: "Checkpoint B API guest flow",
      ship_from_address_json: {
        name: settings.sender_name,
        line1: settings.ship_from_line1,
        city: settings.ship_from_city,
        state: settings.ship_from_state,
        postal: settings.ship_from_postal,
        country: settings.ship_from_country || "US",
      },
      package_preset: "small_box",
      weight_oz: 16,
      length_in: 8,
      width_in: 6,
      height_in: 4,
      shipping_provider: "shippo",
      payment_status: "pending",
      fulfillment_status: "pending",
      shipment_status: "awaiting_guest",
      currency: "usd",
    });
  if (requestError) throw requestError;

  console.log(`Guest URL: ${baseUrl}/shipping-request/${rawToken}`);

  const invalid = await postGuest(rawToken, {
    action: "validate_address",
    name: "Bad Address",
    line1: "zzz not a real street",
    city: "Nowhere",
    state: "ZZ",
    postal: "00000",
    country: "US",
    email: "api-demo@example.com",
  });
  if (invalid.json?.validation?.isValid !== false) {
    throw new Error(
      `Expected invalid address rejection, got: ${JSON.stringify(invalid.json)}`
    );
  }
  console.log("PASS  guest API rejects invalid address");

  const valid = await postGuest(rawToken, {
    action: "validate_address",
    name: "API Demo Guest",
    line1: "215 Clayton St",
    city: "San Francisco",
    state: "CA",
    postal: "94117",
    country: "US",
    email: "api-demo@example.com",
  });
  if (valid.json?.validation?.isValid !== true) {
    throw new Error(
      `Expected valid address, got: ${JSON.stringify(valid.json)}`
    );
  }
  console.log("PASS  guest API validates live address");

  const rates = await postGuest(rawToken, { action: "get_rates" });
  if (!Array.isArray(rates.json?.rates) || rates.json.rates.length < 2) {
    throw new Error(`Expected multiple rates, got: ${JSON.stringify(rates.json)}`);
  }
  console.log(
    `PASS  guest API returns ${rates.json.rates.length} live rate option(s)`
  );
  for (const rate of rates.json.rates.slice(0, 6)) {
    console.log(
      `  - ${rate.carrier} | ${rate.service} | ${rate.estimatedDeliveryLabel || "n/a"} | $${rate.amount}`
    );
  }

  const chosen = rates.json.rates[0];
  const selected = await postGuest(rawToken, {
    action: "select_rate",
    providerRateId: chosen.providerRateId,
  });
  if (!selected.json?.ok || selected.json.checkoutReady !== false) {
    throw new Error(`Unexpected select_rate response: ${JSON.stringify(selected.json)}`);
  }
  console.log(
    `PASS  guest API stores selected rate server-side ($${selected.json.amount}, checkoutReady=false)`
  );

  const { data: requestRow } = await supabase
    .from("lost_found_shipping_requests")
    .select("provider_rate_id, selected_carrier, selected_service, total_amount")
    .eq("secure_token_hash", tokenHash)
    .single();
  if (requestRow?.provider_rate_id !== chosen.providerRateId) {
    throw new Error("provider_rate_id mismatch after select_rate");
  }
  console.log(
    `PASS  DB confirms selected ${requestRow.selected_carrier} ${requestRow.selected_service}`
  );

  const { data: timeline } = await supabase
    .from("lost_found_shipping_events")
    .select("event_type")
    .eq("lost_item_id", item.id)
    .order("id", { ascending: true });
  const types = (timeline || []).map((row) => row.event_type);
  for (const required of [
    "guest_entered_shipping_address",
    "address_validated",
    "shipping_rates_retrieved",
    "shipping_rate_selected",
  ]) {
    if (!types.includes(required)) {
      throw new Error(`Missing timeline event ${required}: ${types.join(", ")}`);
    }
  }
  console.log(`PASS  timeline recorded (${types.length} events): ${types.join(" → ")}`);
  console.log("\nCheckpoint B guest API demonstration passed.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
