/**
 * Phase 2 Checkpoint B checks:
 * - Timeline + status catalog present
 * - Optional live Shippo test validate + rates when SHIPPING_PROVIDER=shippo
 *
 * Run: node scripts/tenant/verify-lost-found-shipping-checkpoint-b.mjs
 */

import assert from "assert";
import fs from "fs";
import path from "path";
import { createRequire } from "module";

const require = createRequire(import.meta.url);

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

let failures = 0;
function check(name, fn) {
  try {
    fn();
    console.log(`PASS  ${name}`);
  } catch (error) {
    failures += 1;
    console.error(`FAIL  ${name}: ${error.message}`);
  }
}

async function checkAsync(name, fn) {
  try {
    await fn();
    console.log(`PASS  ${name}`);
  } catch (error) {
    failures += 1;
    console.error(`FAIL  ${name}: ${error.message}`);
  }
}

const root = process.cwd();

check("timeline catalog file exists", () => {
  assert.ok(
    fs.existsSync(path.join(root, "app/lib/lost-found-shipping/timeline.ts"))
  );
});

check("status flow includes six primary statuses", () => {
  const status = fs.readFileSync(
    path.join(root, "app/lib/lost-found-shipping/status.ts"),
    "utf8"
  );
  assert.ok(status.includes('awaitingGuestAction: "Awaiting Guest Action"'));
  assert.ok(status.includes('readyToShip: "Ready to Ship"'));
  assert.ok(status.includes('stored: "Stored"'));
  assert.ok(status.includes("normalizeLostItemStatus"));
  assert.ok(status.includes("canApplyAutomatedLostItemStatus"));
});

check("timeline events cover audit path through delivery", () => {
  const timeline = fs.readFileSync(
    path.join(root, "app/lib/lost-found-shipping/timeline.ts"),
    "utf8"
  );
  for (const event of [
    "shipping_request_created",
    "guest_opened_shipping_request",
    "guest_entered_shipping_address",
    "address_validated",
    "shipping_rates_retrieved",
    "shipping_rate_selected",
    "payment_completed",
    "label_purchased",
    "package_delivered",
    "shipping_request_cancelled",
    "manual_retry",
  ]) {
    assert.ok(timeline.includes(event), `missing ${event}`);
  }
});

check("guest API wires provider validate/rates; checkout is server-driven", () => {
  const route = fs.readFileSync(
    path.join(root, "app/api/shipping-request/[token]/route.ts"),
    "utf8"
  );
  assert.ok(route.includes("getShippingProvider"));
  assert.ok(route.includes('action === "validate_address"'));
  assert.ok(route.includes('action === "get_rates"'));
  assert.ok(route.includes("checkoutReady: true") || route.includes("checkoutReady: false"));
  assert.ok(!route.includes("stripe.checkout.sessions.create"));
});

check("Shippo stays behind ShippingProvider factory", () => {
  const factory = fs.readFileSync(
    path.join(root, "app/lib/shipping/get-shipping-provider.ts"),
    "utf8"
  );
  assert.ok(factory.includes("ShippoShippingProvider"));
  assert.ok(factory.includes('mode === "shippo"'));
});

const mode = (process.env.SHIPPING_PROVIDER || "mock").toLowerCase();
const token = (process.env.SHIPPO_API_TOKEN || "").trim();

await checkAsync("optional live Shippo test validate + rates", async () => {
  if (mode !== "shippo") {
    console.log(
      "SKIP  live Shippo (set SHIPPING_PROVIDER=shippo and SHIPPO_API_TOKEN=shippo_test_…)"
    );
    return;
  }
  assert.ok(token.startsWith("shippo_test_"), "Phase 2 requires shippo_test_… token");

  const { Shippo } = require("shippo");
  const client = new Shippo({ apiKeyHeader: token });

  const address = await client.addresses.create({
    name: "Checkpoint B Guest",
    street1: "215 Clayton St",
    city: "San Francisco",
    state: "CA",
    zip: "94117",
    country: "US",
    validate: true,
  });
  assert.ok(address.objectId, "address create returned objectId");
  assert.notStrictEqual(address.validationResults?.isValid, false);

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

  assert.ok(Array.isArray(shipment.rates), "shipment.rates should be an array");
  assert.ok(shipment.rates.length > 0, "expected at least one live test rate");
  console.log(`      ${shipment.rates.length} Shippo test rate(s) returned`);
});

if (failures > 0) {
  console.error(`\n${failures} Checkpoint B check(s) failed`);
  process.exit(1);
}

console.log("\nCheckpoint B structural checks passed.");
if (mode === "shippo" && token.startsWith("shippo_test_")) {
  console.log("Live Shippo test validate + rates also passed.");
} else {
  console.log(
    "To exercise live Shippo: SHIPPING_PROVIDER=shippo SHIPPO_API_TOKEN=shippo_test_… then re-run."
  );
}
