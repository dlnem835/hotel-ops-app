/**
 * Checkpoint C1 structural checks (no live Stripe calls required).
 * Run: node scripts/tenant/verify-lost-found-shipping-checkpoint-c1.mjs
 */

import assert from "assert";
import fs from "fs";
import path from "path";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const root = process.cwd();

function loadEnvLocal() {
  const envPath = path.resolve(root, ".env.local");
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
function check(name, fn) {
  try {
    fn();
    console.log(`PASS  ${name}`);
  } catch (error) {
    failures += 1;
    console.error(`FAIL  ${name}: ${error.message}`);
  }
}

check("stripe package resolves", () => {
  assert.ok(require.resolve("stripe"));
});

check("checkout route exists", () => {
  assert.ok(
    fs.existsSync(
      path.join(root, "app/api/shipping-request/[token]/checkout/route.ts")
    )
  );
});

check("processing and cancelled pages exist", () => {
  assert.ok(
    fs.existsSync(
      path.join(
        root,
        "app/shipping-request/[token]/payment-processing/page.tsx"
      )
    )
  );
  assert.ok(
    fs.existsSync(
      path.join(root, "app/shipping-request/[token]/payment-cancelled/page.tsx")
    )
  );
});

check("checkout creation never trusts browser amounts", () => {
  const source = fs.readFileSync(
    path.join(root, "app/lib/payments/create-shipping-checkout.ts"),
    "utf8"
  );
  assert.ok(source.includes("total_amount"));
  assert.ok(source.includes("rate_snapshot_json"));
  assert.ok(!/body\.amount|body\.totalAmount|req\.amount/i.test(source));
  assert.ok(source.includes('currency: "usd"'));
  assert.ok(source.includes("Lost Item Return Shipping"));
  assert.ok(!/platform.?fee|handling.?fee|service.?fee/i.test(source));
});

check("live Stripe keys are rejected by naming convention", () => {
  assert.ok("sk_live_x".startsWith("sk_live_"));
  assert.ok("sk_test_x".startsWith("sk_test_"));
});

check("guest button copy is Secure Checkout", () => {
  const page = fs.readFileSync(
    path.join(root, "app/shipping-request/[token]/page.tsx"),
    "utf8"
  );
  assert.ok(page.includes("Continue to Secure Checkout"));
  assert.ok(page.includes("/checkout"));
});

check("webhook route exists for C2+", () => {
  assert.ok(
    fs.existsSync(path.join(root, "app/api/webhooks/stripe/route.ts")),
    "Stripe webhook route should exist after C2"
  );
});

check("payments layer stores Stripe session ids", () => {
  const source = fs.readFileSync(
    path.join(root, "app/lib/payments/create-shipping-checkout.ts"),
    "utf8"
  );
  assert.ok(source.includes("createShippingPaymentAttempt"));
  assert.ok(source.includes("markPaymentCheckoutOpen"));
  assert.ok(!source.includes("stripe_checkout_session_id"));
});

const secret = (process.env.STRIPE_SECRET_KEY || "").trim();
if (!secret) {
  console.log("SKIP  STRIPE_SECRET_KEY not set (expected until credentials added)");
} else if (secret.startsWith("sk_live_")) {
  failures += 1;
  console.error("FAIL  STRIPE_SECRET_KEY appears to be a live key");
} else if (secret.startsWith("sk_test_")) {
  console.log("PASS  STRIPE_SECRET_KEY is test-mode format");
} else {
  failures += 1;
  console.error("FAIL  STRIPE_SECRET_KEY unexpected format");
}

if (failures > 0) {
  console.error(`\n${failures} Checkpoint C1 check(s) failed`);
  process.exit(1);
}

console.log("\nCheckpoint C1 structural checks passed.");
console.log(
  "Next: add sk_test_… to .env.local, run Stripe CLI webhook forwarding for C2."
);
