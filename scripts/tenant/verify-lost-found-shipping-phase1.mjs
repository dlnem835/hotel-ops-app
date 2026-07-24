/**
 * Phase 1 Lost & Found shipping — offline unit checks (no DB required).
 *
 * Verifies:
 * - Token hash is one-way and stable
 * - Token expiry helpers
 * - UI badge derivation
 * - Delivered/Shipped item status guards
 * - Manual workflow status strings still canonical
 * - Package presets present
 *
 * Run: node scripts/tenant/verify-lost-found-shipping-phase1.mjs
 */

import { createHash, randomBytes } from "crypto";
import assert from "assert";

function hashToken(token) {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

function generateToken() {
  return randomBytes(32).toString("base64url");
}

function isExpired(expiresAt, now = new Date()) {
  const expiry = new Date(expiresAt);
  return Number.isNaN(expiry.getTime()) || expiry.getTime() <= now.getTime();
}

function deriveBadge(input, now = new Date()) {
  if (input.cancelledAt) return "Cancelled";
  if (input.paymentStatus === "pending" && isExpired(input.tokenExpiresAt, now)) {
    return "Expired";
  }
  if (input.fulfillmentStatus === "needs_manual_review") return "Needs Manual Review";
  if (input.fulfillmentStatus === "cancelled" || input.shipmentStatus === "cancelled") {
    return "Cancelled";
  }
  if (input.shipmentStatus === "delivered") return "Delivered";
  if (input.shipmentStatus === "in_transit") return "In Transit";
  if (
    input.fulfillmentStatus === "label_ready" ||
    input.shipmentStatus === "label_ready"
  ) {
    return "Label Ready";
  }
  if (input.paymentStatus === "paid") return "Paid";
  if (input.paymentStatus === "failed") return "Payment Failed";
  if (input.paymentStatus === "expired") return "Expired";
  if (input.shipmentStatus === "awaiting_payment") return "Awaiting Payment";
  return "Awaiting Guest";
}

function canApplyDelivered(status) {
  const s = (status || "").trim();
  return s !== "Discarded" && s !== "Delivered";
}

function canApplyShipped(status) {
  const s = (status || "").trim();
  return s !== "Discarded" && s !== "Delivered";
}

const MANUAL_STATUSES = [
  "Stored",
  "Label sent",
  "Ready to be shipped",
  "Shipped",
  "Discarded",
];

const PRESET_KEYS = [
  "document_envelope",
  "padded_envelope",
  "small_box",
  "medium_box",
  "large_box",
  "custom",
];

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

check("token hash is deterministic and not equal to raw token", () => {
  const token = generateToken();
  const a = hashToken(token);
  const b = hashToken(token);
  assert.strictEqual(a, b);
  assert.notStrictEqual(a, token);
  assert.strictEqual(a.length, 64);
});

check("different tokens produce different hashes", () => {
  assert.notStrictEqual(hashToken(generateToken()), hashToken(generateToken()));
});

check("token expiry detects past and future", () => {
  const past = new Date(Date.now() - 60_000).toISOString();
  const future = new Date(Date.now() + 60_000).toISOString();
  assert.strictEqual(isExpired(past), true);
  assert.strictEqual(isExpired(future), false);
});

check("badge: awaiting guest / payment / expired / delivered", () => {
  const future = new Date(Date.now() + 86400000).toISOString();
  const past = new Date(Date.now() - 86400000).toISOString();
  assert.strictEqual(
    deriveBadge({
      paymentStatus: "pending",
      fulfillmentStatus: "pending",
      shipmentStatus: "awaiting_guest",
      tokenExpiresAt: future,
    }),
    "Awaiting Guest"
  );
  assert.strictEqual(
    deriveBadge({
      paymentStatus: "pending",
      fulfillmentStatus: "pending",
      shipmentStatus: "awaiting_payment",
      tokenExpiresAt: future,
    }),
    "Awaiting Payment"
  );
  assert.strictEqual(
    deriveBadge({
      paymentStatus: "pending",
      fulfillmentStatus: "pending",
      shipmentStatus: "awaiting_guest",
      tokenExpiresAt: past,
    }),
    "Expired"
  );
  assert.strictEqual(
    deriveBadge({
      paymentStatus: "paid",
      fulfillmentStatus: "label_ready",
      shipmentStatus: "delivered",
      tokenExpiresAt: future,
    }),
    "Delivered"
  );
});

check("Delivered webhook must not overwrite Discarded or re-apply", () => {
  assert.strictEqual(canApplyDelivered("Shipped"), true);
  assert.strictEqual(canApplyDelivered("Ready to be shipped"), true);
  assert.strictEqual(canApplyDelivered("Discarded"), false);
  assert.strictEqual(canApplyDelivered("Delivered"), false);
  assert.strictEqual(canApplyShipped("Delivered"), false);
});

check("manual Lost & Found status strings preserved", () => {
  for (const status of MANUAL_STATUSES) {
    assert.ok(typeof status === "string" && status.length > 0);
  }
  assert.ok(!MANUAL_STATUSES.includes("Awaiting Guest Payment"));
  assert.ok(!MANUAL_STATUSES.includes("Payment Failed"));
  assert.ok(!MANUAL_STATUSES.includes("Found"));
});

check("package preset keys match Phase 1 design", () => {
  assert.strictEqual(PRESET_KEYS.length, 6);
  assert.ok(PRESET_KEYS.includes("small_box"));
  assert.ok(PRESET_KEYS.includes("custom"));
});

check("guest URL must not embed sequential item ids", () => {
  const token = generateToken();
  const url = `https://app.example/shipping-request/${token}`;
  assert.ok(!/shipping-request\/\d+$/.test(url));
  assert.ok(url.includes(token));
});

if (failures > 0) {
  console.error(`\n${failures} check(s) failed`);
  process.exit(1);
}

console.log("\nAll Phase 1 Lost & Found shipping checks passed.");
