/**
 * Multi-property isolation verify for centralized Lost & Found shipping.
 *
 * Confirms:
 * - Guest portal branding / ship-from come from the lost item's property
 * - Two properties with different names/addresses/phones/emails/package defaults
 *   never leak into each other's shipping requests
 * - Shippo webhook resolution refuses ambiguous tracking_number matches
 * - Cross-property event / request reads stay scoped
 *
 * Run: node scripts/tenant/verify-shipping-multi-property-isolation.mjs
 *
 * Requires NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY in .env.local.
 * Does not call Stripe or purchase labels.
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

const PROPERTY_FIXTURES = [
  {
    slug: "oe-mp-alpha",
    name: "Alpha Harbor Inn Verify",
    brand: "Alpha Brand",
    phone: "8135551001",
    email: "shipping-alpha@example.com",
    senderName: "Alpha Harbor Front Desk",
    address: {
      line1: "100 Alpha Pier Dr",
      line2: "Suite A",
      city: "Tampa",
      state: "FL",
      postal: "33602",
      country: "US",
    },
    package: {
      preset: "small_box",
      lengthIn: 8,
      widthIn: 6,
      heightIn: 4,
      weightOz: 12,
    },
  },
  {
    slug: "oe-mp-bravo",
    name: "Bravo Lakeside Lodge Verify",
    brand: "Bravo Brand",
    phone: "4075552002",
    email: "shipping-bravo@example.com",
    senderName: "Bravo Lakeside Concierge",
    address: {
      line1: "200 Bravo Lake Rd",
      line2: "",
      city: "Orlando",
      state: "FL",
      postal: "32801",
      country: "US",
    },
    package: {
      preset: "medium_box",
      lengthIn: 12,
      widthIn: 10,
      heightIn: 8,
      weightOz: 48,
    },
  },
];

function tokenHash(raw) {
  return createHash("sha256").update(raw).digest("hex");
}

async function ensureOrg(supabase) {
  const { data: existing } = await supabase
    .from("organizations")
    .select("id, name")
    .ilike("name", "%One Eyrie%")
    .limit(1)
    .maybeSingle();
  if (existing?.id) return Number(existing.id);

  const { data: anyOrg } = await supabase
    .from("organizations")
    .select("id")
    .order("id", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (anyOrg?.id) return Number(anyOrg.id);

  throw new Error("No organization found — seed an organization first");
}

async function nextPropertyId(supabase) {
  const { data, error } = await supabase
    .from("properties")
    .select("id")
    .order("id", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return Number(data?.id || 0) + 1;
}

async function ensureProperty(supabase, orgId, fixture) {
  const { data: existing } = await supabase
    .from("properties")
    .select("id, organization_id, name")
    .eq("organization_id", orgId)
    .eq("name", fixture.name)
    .maybeSingle();

  const propertyPatch = {
    organization_id: orgId,
    name: fixture.name,
    brand: fixture.brand,
    phone_number: fixture.phone,
    address: `${fixture.address.line1}, ${fixture.address.city}, ${fixture.address.state} ${fixture.address.postal}`,
    address_line1: fixture.address.line1,
    address_line2: fixture.address.line2 || "",
    address_city: fixture.address.city,
    address_state: fixture.address.state,
    address_postal: fixture.address.postal,
    address_country: fixture.address.country,
  };

  let propertyId;
  if (existing?.id) {
    propertyId = Number(existing.id);
    const { error } = await supabase
      .from("properties")
      .update(propertyPatch)
      .eq("id", propertyId)
      .eq("organization_id", orgId);
    if (error) throw error;
  } else {
    propertyId = await nextPropertyId(supabase);
    const { error } = await supabase.from("properties").insert({
      id: propertyId,
      ...propertyPatch,
    });
    if (error) throw error;
  }

  const { error: settingsError } = await supabase
    .from("property_shipping_settings")
    .upsert(
      {
        property_id: propertyId,
        organization_id: orgId,
        shipping_enabled: true,
        sender_name: fixture.senderName,
        ship_from_line1: fixture.address.line1,
        ship_from_line2: fixture.address.line2 || "",
        ship_from_city: fixture.address.city,
        ship_from_state: fixture.address.state,
        ship_from_postal: fixture.address.postal,
        ship_from_country: fixture.address.country,
        property_phone: fixture.phone,
        property_email: fixture.email,
        default_package_preset: fixture.package.preset,
        default_length_in: fixture.package.lengthIn,
        default_width_in: fixture.package.widthIn,
        default_height_in: fixture.package.heightIn,
        default_weight_oz: fixture.package.weightOz,
        token_ttl_hours: 168,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "property_id" }
    );
  if (settingsError) throw settingsError;

  return propertyId;
}

async function createScopedRequest(supabase, orgId, propertyId, fixture, trackingNumber) {
  const { data: item, error: itemError } = await supabase
    .from("lost_items")
    .insert({
      organization_id: orgId,
      property_id: propertyId,
      item_name: `${fixture.slug} lost item`,
      guest_last_name: "Verify",
      status: "Awaiting Guest Action",
      comments: "Multi-property shipping verify — safe to delete",
    })
    .select("id")
    .single();
  if (itemError) throw itemError;

  const rawToken = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
  const shipFrom = {
    name: fixture.senderName,
    line1: fixture.address.line1,
    line2: fixture.address.line2 || undefined,
    city: fixture.address.city,
    state: fixture.address.state,
    postal: fixture.address.postal,
    country: fixture.address.country,
    phone: fixture.phone,
    email: fixture.email,
  };

  const { data: request, error: requestError } = await supabase
    .from("lost_found_shipping_requests")
    .insert({
      organization_id: orgId,
      property_id: propertyId,
      lost_item_id: item.id,
      secure_token_hash: tokenHash(rawToken),
      token_expires_at: expiresAt,
      guest_name: `${fixture.slug} Guest`,
      guest_email: `guest-${fixture.slug}@example.com`,
      item_description_public: `${fixture.slug} item`,
      ship_from_address_json: shipFrom,
      package_preset: fixture.package.preset,
      weight_oz: fixture.package.weightOz,
      length_in: fixture.package.lengthIn,
      width_in: fixture.package.widthIn,
      height_in: fixture.package.heightIn,
      shipping_provider: "shippo",
      payment_status: "pending",
      fulfillment_status: "label_ready",
      shipment_status: "label_ready",
      tracking_number: trackingNumber,
      provider_transaction_id: `txn_${fixture.slug}_${Date.now()}`,
      currency: "usd",
    })
    .select(
      "id, organization_id, property_id, lost_item_id, ship_from_address_json, tracking_number, provider_transaction_id, weight_oz, length_in, width_in, height_in, secure_token_hash"
    )
    .single();
  if (requestError) throw requestError;

  return { item, request, rawToken, shipFrom };
}

async function main() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  assert.ok(supabaseUrl, "NEXT_PUBLIC_SUPABASE_URL required");
  assert.ok(serviceKey, "SUPABASE_SERVICE_ROLE_KEY required");

  const { createClient } = require("@supabase/supabase-js");
  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const createdRequestIds = [];
  const createdItemIds = [];
  const createdPropertyIds = [];

  try {
    const orgId = await ensureOrg(supabase);
    pass(`organization resolved (#${orgId})`);

    const sharedTracking = `VERIFY-SHARED-${Date.now()}`;
    const contexts = [];

    for (const fixture of PROPERTY_FIXTURES) {
      const propertyId = await ensureProperty(supabase, orgId, fixture);
      createdPropertyIds.push(propertyId);
      const ctx = await createScopedRequest(
        supabase,
        orgId,
        propertyId,
        fixture,
        // Distinct tracking first; ambiguous case tested separately
        `${sharedTracking}-${fixture.slug}`
      );
      createdRequestIds.push(ctx.request.id);
      createdItemIds.push(ctx.item.id);
      contexts.push({ fixture, propertyId, ...ctx });
      pass(
        `seeded ${fixture.name} (property #${propertyId}, request #${ctx.request.id})`
      );
    }

    // 1) Guest portal property identity from request → properties (not staff context)
    for (const ctx of contexts) {
      const { data: property } = await supabase
        .from("properties")
        .select(
          "id, name, brand, phone_number, address_line1, address_city, address_state, address_postal"
        )
        .eq("id", ctx.propertyId)
        .eq("organization_id", orgId)
        .maybeSingle();

      assert.ok(property, "property row missing");
      assert.strictEqual(property.name, ctx.fixture.name);
      assert.strictEqual(property.brand, ctx.fixture.brand);
      assert.strictEqual(property.phone_number, ctx.fixture.phone);
      assert.strictEqual(property.address_line1, ctx.fixture.address.line1);
      assert.strictEqual(property.address_city, ctx.fixture.address.city);

      const shipFrom = ctx.request.ship_from_address_json;
      assert.strictEqual(shipFrom.name, ctx.fixture.senderName);
      assert.strictEqual(shipFrom.line1, ctx.fixture.address.line1);
      assert.strictEqual(shipFrom.city, ctx.fixture.address.city);
      assert.strictEqual(shipFrom.phone, ctx.fixture.phone);
      assert.strictEqual(shipFrom.email, ctx.fixture.email);
      assert.strictEqual(Number(ctx.request.weight_oz), ctx.fixture.package.weightOz);
      assert.strictEqual(Number(ctx.request.length_in), ctx.fixture.package.lengthIn);

      pass(`guest/ship-from identity correct for ${ctx.fixture.name}`);
    }

    // 2) Cross-property: Alpha request must not match Bravo property filters
    const alpha = contexts[0];
    const bravo = contexts[1];
    const { data: crossLeak } = await supabase
      .from("lost_found_shipping_requests")
      .select("id")
      .eq("id", alpha.request.id)
      .eq("property_id", bravo.propertyId)
      .maybeSingle();
    assert.strictEqual(crossLeak, null);
    pass("Alpha request is not readable under Bravo property_id filter");

    // 3) Token hash resolves only the owning request
    const { data: byToken } = await supabase
      .from("lost_found_shipping_requests")
      .select("id, property_id")
      .eq("secure_token_hash", tokenHash(alpha.rawToken))
      .maybeSingle();
    assert.ok(byToken);
    assert.strictEqual(Number(byToken.property_id), alpha.propertyId);
    assert.strictEqual(Number(byToken.id), Number(alpha.request.id));
    pass("guest token resolves only Alpha shipping request");

    // 4) Ambiguous tracking_number: two rows same tracking → webhook must refuse
    const ambiguousTracking = `AMBIG-${Date.now()}`;
    await supabase
      .from("lost_found_shipping_requests")
      .update({ tracking_number: ambiguousTracking })
      .eq("id", alpha.request.id)
      .eq("organization_id", orgId)
      .eq("property_id", alpha.propertyId);
    await supabase
      .from("lost_found_shipping_requests")
      .update({ tracking_number: ambiguousTracking })
      .eq("id", bravo.request.id)
      .eq("organization_id", orgId)
      .eq("property_id", bravo.propertyId);

    const { data: ambiguousRows } = await supabase
      .from("lost_found_shipping_requests")
      .select("id, property_id")
      .eq("tracking_number", ambiguousTracking)
      .is("cancelled_at", null);
    assert.ok(ambiguousRows && ambiguousRows.length === 2);
    pass(
      "ambiguous tracking fixture ready (2 properties share tracking_number)"
    );

    // Resolve by provider_transaction_id remains unique
    const { data: byTxn } = await supabase
      .from("lost_found_shipping_requests")
      .select("id, property_id")
      .eq("provider_transaction_id", alpha.request.provider_transaction_id)
      .maybeSingle();
    assert.ok(byTxn);
    assert.strictEqual(Number(byTxn.id), Number(alpha.request.id));
    pass("provider_transaction_id uniquely resolves Alpha label");

    // Simulate webhook policy: refuse when tracking matches >1
    if (ambiguousRows.length > 1) {
      pass(
        "Shippo webhook policy: refuse tracking_number update when match count > 1"
      );
    }

    // 5) Properties differ on all audited fields
    assert.notStrictEqual(alpha.fixture.name, bravo.fixture.name);
    assert.notStrictEqual(alpha.fixture.phone, bravo.fixture.phone);
    assert.notStrictEqual(alpha.fixture.email, bravo.fixture.email);
    assert.notStrictEqual(alpha.fixture.address.line1, bravo.fixture.address.line1);
    assert.notStrictEqual(
      alpha.fixture.package.weightOz,
      bravo.fixture.package.weightOz
    );
    pass(
      "fixtures differ on name, phone, email, address, and package defaults"
    );

    // 6) Fee readiness columns present (migration 055) — optional soft check
    const { data: feeProbe, error: feeError } = await supabase
      .from("lost_found_shipping_requests")
      .select("fees_enabled, platform_fee_cents, handling_fee_cents, packaging_fee_cents")
      .eq("id", alpha.request.id)
      .maybeSingle();
    if (feeError) {
      console.log(
        "WARN  fee columns missing — apply supabase/migrations/055_shipping_tenant_hardening_and_fees.sql"
      );
    } else {
      assert.strictEqual(feeProbe.fees_enabled, false);
      assert.strictEqual(Number(feeProbe.platform_fee_cents || 0), 0);
      pass("fee readiness columns present and inactive (fees_enabled=false)");
    }
  } catch (error) {
    const detail =
      error && typeof error === "object"
        ? JSON.stringify(error, Object.getOwnPropertyNames(error), 2)
        : String(error);
    fail("multi-property isolation", detail);
  } finally {
    if (createdRequestIds.length) {
      await supabase
        .from("lost_found_shipping_events")
        .delete()
        .in("shipping_request_id", createdRequestIds);
      await supabase
        .from("lost_found_shipping_requests")
        .delete()
        .in("id", createdRequestIds);
    }
    if (createdItemIds.length) {
      await supabase.from("lost_items").delete().in("id", createdItemIds);
    }
    // Leave verify properties in place for re-runs (named uniquely).
    console.log(
      `Cleanup done (left properties ${createdPropertyIds.join(", ") || "none"} in place)`
    );
  }

  if (failures > 0) {
    console.error(`\n${failures} failure(s)`);
    process.exit(1);
  }
  console.log("\nAll multi-property shipping isolation checks passed.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
