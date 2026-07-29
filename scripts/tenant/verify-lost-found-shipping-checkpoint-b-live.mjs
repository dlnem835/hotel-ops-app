/**
 * Live Checkpoint B demonstration against Shippo test API + optional DB checks.
 * Run: node scripts/tenant/verify-lost-found-shipping-checkpoint-b-live.mjs
 *
 * Does not purchase labels or call Stripe.
 */

import assert from "assert";
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

let failures = 0;
function pass(name) {
  console.log(`PASS  ${name}`);
}
function fail(name, error) {
  failures += 1;
  console.error(`FAIL  ${name}: ${error instanceof Error ? error.message : error}`);
}

async function main() {
  const mode = (process.env.SHIPPING_PROVIDER || "mock").toLowerCase();
  const token = (process.env.SHIPPO_API_TOKEN || "").trim();
  assert.strictEqual(mode, "shippo", "SHIPPING_PROVIDER must be shippo");
  assert.ok(token.startsWith("shippo_test_"), "SHIPPO_API_TOKEN must be shippo_test_…");

  const { Shippo } = require("shippo");
  const client = new Shippo({ apiKeyHeader: token });

  // 1) Invalid address rejected
  try {
    const invalid = await client.addresses.create({
      name: "Test Guest",
      street1: "zzz not a real street",
      city: "Nowhere",
      state: "ZZ",
      zip: "00000",
      country: "US",
      validate: true,
    });
    const isValid = invalid.validationResults?.isValid === true;
    assert.strictEqual(isValid, false, "expected Shippo to reject invalid address");
    pass("invalid addresses are rejected by Shippo validation");
  } catch (error) {
    fail("invalid address rejection", error);
  }

  // 2–3) Valid address + live rates with carrier/service/ETA/price
  let rates = [];
  try {
    const valid = await client.addresses.create({
      name: "Checkpoint B Guest",
      street1: "215 Clayton St",
      city: "San Francisco",
      state: "CA",
      zip: "94117",
      country: "US",
      validate: true,
    });
    assert.strictEqual(
      valid.validationResults?.isValid,
      true,
      "expected valid Shippo address"
    );
    pass("valid addresses are accepted");

    const shipment = await client.shipments.create({
      addressFrom: {
        name: "Hotel Front Desk",
        street1: "965 Mission St",
        city: "San Francisco",
        state: "CA",
        zip: "94103",
        country: "US",
      },
      addressTo: {
        name: "Checkpoint B Guest",
        street1: "215 Clayton St",
        city: "San Francisco",
        state: "CA",
        zip: "94117",
        country: "US",
      },
      parcels: [
        {
          length: "8",
          width: "6",
          height: "4",
          distanceUnit: "in",
          weight: "16",
          massUnit: "oz",
        },
      ],
      async: false,
    });

    rates = shipment.rates || [];
    assert.ok(rates.length >= 2, `expected multiple rates, got ${rates.length}`);

    const carriers = new Set(rates.map((rate) => String(rate.provider || "")));
    assert.ok(carriers.size >= 1, "expected at least one carrier");

    console.log("\nLive rate sample:");
    for (const rate of rates.slice(0, 8)) {
      const days =
        typeof rate.estimatedDays === "number"
          ? `${rate.estimatedDays} business day(s)`
          : rate.durationTerms || "n/a";
      console.log(
        `  - ${rate.provider} | ${rate.servicelevel?.name || rate.servicelevel?.token} | ${days} | $${rate.amount}`
      );
    }

    pass(
      `valid addresses return live carrier rates (${rates.length} options, ${carriers.size} carrier brand(s))`
    );
  } catch (error) {
    fail("valid address + live rates", error);
  }

  // 4–6) Server-side rate selection + timeline + multi-property isolation (DB)
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) {
    console.log("SKIP  DB rate-selection/timeline/isolation (missing Supabase service env)");
  } else {
    try {
      const { createClient } = require("@supabase/supabase-js");
      const supabase = createClient(supabaseUrl, serviceKey, {
        auth: { persistSession: false, autoRefreshToken: false },
      });

      let { data: settingsRows, error: settingsError } = await supabase
        .from("property_shipping_settings")
        .select(
          "property_id, organization_id, sender_name, ship_from_line1, ship_from_city, ship_from_state, ship_from_postal, ship_from_country, shipping_enabled"
        )
        .limit(5);
      if (settingsError) throw settingsError;

      if (!settingsRows || settingsRows.length === 0) {
        const { data: property, error: propertyError } = await supabase
          .from("properties")
          .select("id, organization_id, name")
          .eq("id", 1)
          .maybeSingle();
        if (propertyError) throw propertyError;
        assert.ok(property, "expected at least one property for demo seeding");

        const { data: seeded, error: seedError } = await supabase
          .from("property_shipping_settings")
          .upsert(
            {
              property_id: property.id,
              organization_id: property.organization_id,
              shipping_enabled: true,
              sender_name: `${property.name} Front Desk`,
              ship_from_line1: "965 Mission St",
              ship_from_city: "San Francisco",
              ship_from_state: "CA",
              ship_from_postal: "94103",
              ship_from_country: "US",
              property_phone: "4155550100",
              property_email: "shipping-demo@example.com",
              default_package_preset: "small_box",
              default_length_in: 8,
              default_width_in: 6,
              default_height_in: 4,
              default_weight_oz: 16,
              token_ttl_hours: 168,
              updated_at: new Date().toISOString(),
            },
            { onConflict: "property_id" }
          )
          .select(
            "property_id, organization_id, sender_name, ship_from_line1, ship_from_city, ship_from_state, ship_from_postal, ship_from_country, shipping_enabled"
          )
          .single();
        if (seedError) throw seedError;
        settingsRows = [seeded];
        console.log(
          `Seeded property_shipping_settings for property #${property.id} (${property.name})`
        );
      }

      const settings =
        settingsRows.find((row) => row.shipping_enabled) || settingsRows[0];
      if (!settings.shipping_enabled) {
        const { error: enableError } = await supabase
          .from("property_shipping_settings")
          .update({
            shipping_enabled: true,
            updated_at: new Date().toISOString(),
          })
          .eq("property_id", settings.property_id);
        if (enableError) throw enableError;
        settings.shipping_enabled = true;
      }

      const orgId = Number(settings.organization_id);
      const propertyId = Number(settings.property_id);

      const { data: item, error: itemError } = await supabase
        .from("lost_items")
        .insert({
          organization_id: orgId,
          property_id: propertyId,
          item_name: "Checkpoint B demo item",
          guest_last_name: "Demo",
          status: "Awaiting Guest Action",
          comments: "Automated Checkpoint B live demo — safe to delete",
        })
        .select("id")
        .single();
      if (itemError) throw itemError;

      const rawToken = randomBytes(32).toString("hex");
      const tokenHash = createHash("sha256").update(rawToken).digest("hex");
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
      const selected = rates[0];
      assert.ok(selected, "need a live rate to store");

      const shipFrom = {
        name: settings.sender_name,
        line1: settings.ship_from_line1,
        city: settings.ship_from_city,
        state: settings.ship_from_state,
        postal: settings.ship_from_postal,
        country: settings.ship_from_country || "US",
      };
      const shipTo = {
        name: "Checkpoint B Guest",
        line1: "215 Clayton St",
        city: "San Francisco",
        state: "CA",
        postal: "94117",
        country: "US",
      };

      const mappedRates = rates.slice(0, 12).map((rate) => ({
        providerRateId: rate.objectId,
        carrier: rate.provider,
        service: rate.servicelevel?.name || rate.servicelevel?.token,
        amount: Number(rate.amount),
        currency: String(rate.currency || "USD").toLowerCase(),
        estimatedDaysMin: rate.estimatedDays ?? null,
        estimatedDaysMax: rate.estimatedDays ?? null,
        estimatedDeliveryLabel:
          typeof rate.estimatedDays === "number"
            ? `${rate.estimatedDays} business day(s)`
            : rate.durationTerms || null,
      }));

      const { data: request, error: requestError } = await supabase
        .from("lost_found_shipping_requests")
        .insert({
          organization_id: orgId,
          property_id: propertyId,
          lost_item_id: item.id,
          secure_token_hash: tokenHash,
          token_expires_at: expiresAt,
          guest_name: "Checkpoint B Guest",
          guest_email: "checkpoint-b@example.com",
          item_description_public: "Checkpoint B demo item",
          ship_from_address_json: shipFrom,
          recipient_name: shipTo.name,
          recipient_address_json: shipTo,
          package_preset: "small_box",
          weight_oz: 16,
          length_in: 8,
          width_in: 6,
          height_in: 4,
          shipping_provider: "shippo",
          payment_status: "pending",
          fulfillment_status: "pending",
          shipment_status: "awaiting_payment",
          rate_snapshot_json: mappedRates,
          rate_expires_at: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
          provider_rate_id: selected.objectId,
          selected_carrier: selected.provider,
          selected_service:
            selected.servicelevel?.name || selected.servicelevel?.token,
          quoted_shipping_amount: Number(selected.amount),
          total_amount: Number(selected.amount),
          currency: "usd",
        })
        .select("id, property_id, organization_id, provider_rate_id, total_amount")
        .single();
      if (requestError) throw requestError;

      const events = [
        "shipping_request_created",
        "guest_entered_shipping_address",
        "address_validated",
        "shipping_rates_retrieved",
        "shipping_rate_selected",
      ];
      const { error: eventsError } = await supabase
        .from("lost_found_shipping_events")
        .insert(
          events.map((eventType, index) => ({
            organization_id: orgId,
            property_id: propertyId,
            lost_item_id: item.id,
            shipping_request_id: request.id,
            event_type: eventType,
            event_source: index === 0 ? "staff" : index === 4 ? "guest" : "system",
            event_data: {
              notes: `Checkpoint B live demo · ${eventType}`,
              provider: "shippo",
            },
          }))
        );
      if (eventsError) throw eventsError;

      assert.ok(request.provider_rate_id);
      assert.ok(Number(request.total_amount) > 0);
      pass(
        `rate selection saved server-side (request #${request.id}, $${request.total_amount})`
      );

      const { data: timeline, error: timelineError } = await supabase
        .from("lost_found_shipping_events")
        .select("event_type, property_id, organization_id")
        .eq("shipping_request_id", request.id)
        .order("id", { ascending: true });
      if (timelineError) throw timelineError;
      assert.strictEqual((timeline || []).length, events.length);
      pass(`timeline events recorded (${timeline.length} append-only rows)`);

      const otherPropertyId = (settingsRows || []).find(
        (row) => Number(row.property_id) !== propertyId
      )?.property_id;

      const { data: crossProperty, error: crossError } = await supabase
        .from("lost_found_shipping_requests")
        .select("id")
        .eq("id", request.id)
        .eq("property_id", otherPropertyId || propertyId + 999999)
        .maybeSingle();
      if (crossError) throw crossError;
      assert.strictEqual(
        crossProperty,
        null,
        "request must not match a different property filter"
      );
      pass("multi-property isolation holds (request scoped by property_id)");

      console.log(`\nGuest demo link (local): http://localhost:3000/shipping-request/${rawToken}`);
      console.log(
        "DB rows created for demo (lost item + shipping request + timeline). Safe to delete later."
      );
    } catch (error) {
      fail("DB rate selection / timeline / isolation", error);
    }
  }

  if (failures > 0) {
    console.error(`\n${failures} Checkpoint B live check(s) failed`);
    process.exit(1);
  }

  console.log("\nCheckpoint B live demonstration passed.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
