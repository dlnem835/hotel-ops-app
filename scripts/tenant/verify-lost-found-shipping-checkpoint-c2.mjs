/**
 * Checkpoint C2 structural checks (Payments layer + Stripe webhook).
 * Run: node scripts/tenant/verify-lost-found-shipping-checkpoint-c2.mjs
 */

import assert from "assert";
import fs from "fs";
import path from "path";

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

check("migration 052 payments layer exists", () => {
  assert.ok(
    fs.existsSync(
      path.join(root, "supabase/migrations/052_payments_layer.sql")
    )
  );
  const sql = fs.readFileSync(
    path.join(root, "supabase/migrations/052_payments_layer.sql"),
    "utf8"
  );
  assert.ok(sql.includes("CREATE TABLE IF NOT EXISTS public.payments"));
  assert.ok(sql.includes("payment_webhook_receipts"));
  assert.ok(sql.includes("successful_payment_id"));
  assert.ok(sql.includes("DROP COLUMN IF EXISTS stripe_checkout_session_id"));
});

check("webhook route verifies signature", () => {
  const route = fs.readFileSync(
    path.join(root, "app/api/webhooks/stripe/route.ts"),
    "utf8"
  );
  const processor = fs.readFileSync(
    path.join(root, "app/lib/payments/process-stripe-webhook.ts"),
    "utf8"
  );
  assert.ok(route.includes("processStripeWebhookEvent"));
  assert.ok(processor.includes("constructEvent"));
  assert.ok(processor.includes("claimWebhookEvent"));
  assert.ok(processor.includes("checkout.session.completed"));
  assert.ok(processor.includes("checkout.session.expired"));
  assert.ok(processor.includes("payment_intent.payment_failed"));
});

check("checkout amount comes only from server payment record", () => {
  const source = fs.readFileSync(
    path.join(root, "app/lib/payments/create-shipping-checkout.ts"),
    "utf8"
  );
  assert.ok(source.includes("total_amount"));
  assert.ok(source.includes("payment.amount_cents"));
  assert.ok(!/body\.amount|unit_amount:\s*body/i.test(source));
  assert.ok(!/platform.?fee|handling.?fee|service.?fee/i.test(source));
  assert.ok(!source.includes("stripe_checkout_session_id"));
});

check("successful payment triggers label purchase orchestration", () => {
  const processor = fs.readFileSync(
    path.join(root, "app/lib/payments/process-stripe-webhook.ts"),
    "utf8"
  );
  assert.ok(processor.includes("purchaseLabelForPaidShippingRequest"));
  assert.ok(processor.includes("paymentCompleted"));
  assert.ok(
    fs.existsSync(
      path.join(root, "app/lib/lost-found-shipping/purchase-label-for-request.ts")
    )
  );
  const purchase = fs.readFileSync(
    path.join(root, "app/lib/lost-found-shipping/purchase-label-for-request.ts"),
    "utf8"
  );
  assert.ok(purchase.includes("purchaseLabel"));
  assert.ok(purchase.includes("markShippingLabelReady"));
  assert.ok(purchase.includes("ensureShippoTrackUpdatedWebhook"));
});

check("redirect alone does not mark paid", () => {
  const processing = fs.readFileSync(
    path.join(
      root,
      "app/shipping-request/[token]/payment-processing/processing-client.tsx"
    ),
    "utf8"
  );
  assert.ok(processing.includes("Confirming your payment"));
  assert.ok(processing.includes("/api/shipping-request/"));
  assert.ok(!/payment_status:\s*['\"]paid['\"]/.test(processing));
  const cancelled = fs.readFileSync(
    path.join(
      root,
      "app/shipping-request/[token]/payment-cancelled/page.tsx"
    ),
    "utf8"
  );
  assert.ok(cancelled.includes("Payment not completed"));
});

check("staff panel surfaces paid payment fields", () => {
  const staff = fs.readFileSync(
    path.join(
      root,
      "app/lost-and-found/components/LostFoundShippingSection.tsx"
    ),
    "utf8"
  );
  assert.ok(staff.includes("Payment Received"));
  assert.ok(staff.includes("Amount paid"));
  assert.ok(staff.includes("Stripe reference"));
  assert.ok(staff.includes("providerReceiptUrl") || staff.includes("View Stripe receipt"));
});

check("webhook stores provider receipt URL in metadata", () => {
  const processor = fs.readFileSync(
    path.join(root, "app/lib/payments/process-stripe-webhook.ts"),
    "utf8"
  );
  assert.ok(processor.includes("provider_receipt_url"));
  assert.ok(processor.includes("resolveProviderReceiptUrl"));
});

check("idempotent webhook claim uses receipts table", () => {
  const records = fs.readFileSync(
    path.join(root, "app/lib/payments/payment-records.ts"),
    "utf8"
  );
  assert.ok(records.includes("payment_webhook_receipts"));
  assert.ok(records.includes("claimWebhookEvent"));
});

const secret = (process.env.STRIPE_SECRET_KEY || "").trim();
const webhook = (process.env.STRIPE_WEBHOOK_SECRET || "").trim();
if (!secret) {
  console.log("SKIP  STRIPE_SECRET_KEY not set");
} else if (secret.startsWith("sk_test_")) {
  console.log("PASS  STRIPE_SECRET_KEY is test-mode format");
} else {
  failures += 1;
  console.error("FAIL  STRIPE_SECRET_KEY must be sk_test_…");
}

if (!webhook) {
  console.log("SKIP  STRIPE_WEBHOOK_SECRET not set (needed for live webhook tests)");
} else if (webhook.startsWith("whsec_")) {
  console.log("PASS  STRIPE_WEBHOOK_SECRET format looks valid");
} else {
  failures += 1;
  console.error("FAIL  STRIPE_WEBHOOK_SECRET unexpected format");
}

if (failures > 0) {
  console.error(`\n${failures} Checkpoint C2 check(s) failed`);
  process.exit(1);
}

console.log("\nCheckpoint C2 structural checks passed.");
console.log(
  "Local test: stripe listen --forward-to localhost:3000/api/webhooks/stripe"
);
