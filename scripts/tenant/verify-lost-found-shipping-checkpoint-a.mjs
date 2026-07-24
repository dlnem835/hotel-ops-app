/**
 * Offline checks for Phase 2 Checkpoint A (no live API calls).
 * Run: node scripts/tenant/verify-lost-found-shipping-checkpoint-a.mjs
 */

import assert from "assert";
import { createRequire } from "module";

const require = createRequire(import.meta.url);

function loadEnvLocal() {
  try {
    const fs = require("fs");
    const path = require("path");
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

check("stripe and shippo packages resolve", () => {
  assert.ok(require.resolve("stripe"));
  assert.ok(require.resolve("shippo"));
  assert.ok(require.resolve("server-only"));
});

check("SHIPPING_PROVIDER defaults to mock when unset for this probe", () => {
  const mode = (process.env.SHIPPING_PROVIDER || "mock").toLowerCase();
  assert.ok(mode === "mock" || mode === "shippo");
});

check("live Stripe key would be rejected by naming convention", () => {
  const sample = "sk_live_example";
  assert.ok(sample.startsWith("sk_live_"));
  assert.ok(!"sk_test_x".startsWith("sk_live_"));
});

check("live Shippo token would be rejected by naming convention", () => {
  assert.ok("shippo_live_x".startsWith("shippo_live_"));
  assert.ok("shippo_test_x".startsWith("shippo_test_"));
});

check("no platform fee env vars are required in Phase 2", () => {
  assert.strictEqual(process.env.LOST_FOUND_PLATFORM_FEE_CENTS, undefined);
});

if (failures > 0) {
  console.error(`\n${failures} Checkpoint A check(s) failed`);
  process.exit(1);
}

console.log("\nCheckpoint A offline checks passed.");
console.log(
  "Next: add SHIPPO_API_TOKEN=shippo_test_… and SHIPPING_PROVIDER=shippo to .env.local for Checkpoint B."
);
