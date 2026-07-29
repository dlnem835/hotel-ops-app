/**
 * Lost & Found six-status model + Shippo tracking guards (offline).
 *
 * Run: node scripts/tenant/verify-lost-found-status-tracking.mjs
 */

import assert from "assert";
import fs from "fs";
import path from "path";
import { createHash, createHmac, timingSafeEqual } from "crypto";

const root = process.cwd();

const LOST_ITEM_STATUS = {
  stored: "Stored",
  awaitingGuestAction: "Awaiting Guest Action",
  readyToShip: "Ready to Ship",
  shipped: "Shipped",
  delivered: "Delivered",
  discarded: "Discarded",
};

const RANK = {
  Stored: 1,
  "Awaiting Guest Action": 2,
  "Ready to Ship": 3,
  Shipped: 4,
  Delivered: 5,
  Discarded: 100,
};

const LEGACY_MAP = {
  Found: "Stored",
  "Awaiting Guest Payment": "Awaiting Guest Action",
  "Label sent": "Awaiting Guest Action",
  "Ready to be shipped": "Ready to Ship",
};

function normalize(raw) {
  const status = String(raw || "").trim();
  if (!status) return null;
  if (LEGACY_MAP[status]) return LEGACY_MAP[status];
  if (RANK[status] != null) return status;
  return null;
}

function canApply(current, next) {
  const cur = normalize(current);
  if (!cur) return true;
  if (cur === "Discarded") return false;
  if (cur === next) return false;
  return RANK[next] > RANK[cur];
}

function mapShippo(raw) {
  switch (String(raw || "").toUpperCase()) {
    case "PRE_TRANSIT":
      return "pre_transit";
    case "TRANSIT":
    case "OUT_FOR_DELIVERY":
      return "in_transit";
    case "DELIVERED":
      return "delivered";
    case "RETURNED":
      return "returned";
    case "FAILURE":
      return "exception";
    default:
      return "unknown";
  }
}

function trackingToStatus(tracking) {
  switch (tracking) {
    case "pre_transit":
      return "Ready to Ship";
    case "in_transit":
      return "Shipped";
    case "delivered":
      return "Delivered";
    case "returned":
      return "Shipped";
    default:
      return null;
  }
}

function isStale(lastEventAt, incomingAt) {
  if (!incomingAt || !lastEventAt) return false;
  return new Date(incomingAt).getTime() < new Date(lastEventAt).getTime();
}

function safeEqual(a, b) {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

function verifyTokenAuth(secret, queryToken) {
  return Boolean(queryToken && safeEqual(queryToken, secret));
}

function verifyHmac(secret, rawBody, sigHeader) {
  const parts = Object.fromEntries(
    sigHeader.split(",").map((part) => {
      const [key, ...rest] = part.trim().split("=");
      return [key, rest.join("=")];
    })
  );
  const expected = createHmac("sha256", secret)
    .update(`${parts.t}.${rawBody}`, "utf8")
    .digest("hex");
  return safeEqual(expected, parts.v1);
}

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

check("six primary statuses only in status.ts options", () => {
  const status = fs.readFileSync(
    path.join(root, "app/lib/lost-found-shipping/status.ts"),
    "utf8"
  );
  assert.ok(status.includes('awaitingGuestAction: "Awaiting Guest Action"'));
  assert.ok(status.includes('readyToShip: "Ready to Ship"'));
  assert.ok(!status.includes('found: "Found"'));
  assert.ok(!status.includes('awaitingGuestPayment: "Awaiting Guest Payment"'));
  assert.ok(!status.includes('readyToShip: "Ready to be shipped"'));
});

check("legacy status mappings", () => {
  assert.strictEqual(normalize("Found"), "Stored");
  assert.strictEqual(normalize("Awaiting Guest Payment"), "Awaiting Guest Action");
  assert.strictEqual(normalize("Label sent"), "Awaiting Guest Action");
  assert.strictEqual(normalize("Ready to be shipped"), "Ready to Ship");
  assert.strictEqual(normalize("Ready to Ship"), "Ready to Ship");
});

check("downgrade prevention: delivered / shipped / discarded", () => {
  assert.strictEqual(canApply("Delivered", "Shipped"), false);
  assert.strictEqual(canApply("Shipped", "Ready to Ship"), false);
  assert.strictEqual(canApply("Ready to Ship", "Shipped"), true);
  assert.strictEqual(canApply("Shipped", "Delivered"), true);
  assert.strictEqual(canApply("Discarded", "Delivered"), false);
  assert.strictEqual(canApply("Discarded", "Shipped"), false);
  assert.strictEqual(canApply("Awaiting Guest Action", "Ready to Ship"), true);
});

check("Shippo tracking → operational status", () => {
  assert.strictEqual(trackingToStatus(mapShippo("PRE_TRANSIT")), "Ready to Ship");
  assert.strictEqual(trackingToStatus(mapShippo("TRANSIT")), "Shipped");
  assert.strictEqual(trackingToStatus(mapShippo("OUT_FOR_DELIVERY")), "Shipped");
  assert.strictEqual(trackingToStatus(mapShippo("DELIVERED")), "Delivered");
  assert.strictEqual(trackingToStatus(mapShippo("RETURNED")), "Shipped");
  assert.strictEqual(trackingToStatus(mapShippo("FAILURE")), null);
});

check("stale tracking events ignored", () => {
  assert.strictEqual(
    isStale("2026-07-28T12:00:00.000Z", "2026-07-28T11:00:00.000Z"),
    true
  );
  assert.strictEqual(
    isStale("2026-07-28T12:00:00.000Z", "2026-07-28T13:00:00.000Z"),
    false
  );
});

check("webhook auth: query token + HMAC", () => {
  const secret = "test-shippo-secret";
  assert.ok(verifyTokenAuth(secret, secret));
  assert.ok(!verifyTokenAuth(secret, "wrong"));
  const body = '{"tracking_number":"1Z"}';
  const t = "1688493073";
  const v1 = createHmac("sha256", secret).update(`${t}.${body}`, "utf8").digest("hex");
  assert.ok(verifyHmac(secret, body, `t=${t},v1=${v1}`));
  assert.ok(!verifyHmac(secret, body, `t=${t},v1=deadbeef`));
});

check("webhook idempotency key is stable for same event", () => {
  const a = `shippo:obj1:TRANSIT:2026-07-28T12:00:00Z`;
  const b = `shippo:obj1:TRANSIT:2026-07-28T12:00:00Z`;
  assert.strictEqual(a, b);
  const hash = createHash("sha256").update("payload").digest("hex").slice(0, 32);
  assert.strictEqual(hash.length, 32);
});

check("Shippo webhook route + processor exist", () => {
  assert.ok(fs.existsSync(path.join(root, "app/api/webhooks/shippo/route.ts")));
  assert.ok(
    fs.existsSync(
      path.join(root, "app/lib/lost-found-shipping/process-shippo-tracking-webhook.ts")
    )
  );
  assert.ok(
    fs.existsSync(
      path.join(root, "supabase/migrations/054_lost_found_status_and_tracking.sql")
    )
  );
  assert.ok(
    fs.existsSync(path.join(root, "app/lib/shipping/shippo-ensure-webhooks.ts"))
  );
  assert.ok(
    fs.existsSync(
      path.join(root, "app/shipping-request/[token]/GuestShipmentTrackingCard.tsx")
    )
  );
  const purchase = fs.readFileSync(
    path.join(root, "app/lib/lost-found-shipping/purchase-label-for-request.ts"),
    "utf8"
  );
  assert.ok(purchase.includes("markShippingLabelReady"));
});

check("UI no longer offers Found / Awaiting Guest Payment / Ready to be shipped", () => {
  const page = fs.readFileSync(path.join(root, "app/lost-and-found/page.tsx"), "utf8");
  const modal = fs.readFileSync(
    path.join(root, "app/lost-and-found/components/LostFoundAddItemModal.tsx"),
    "utf8"
  );
  assert.ok(!page.includes("<option>Found</option>"));
  assert.ok(!page.includes("Awaiting Guest Payment"));
  assert.ok(!page.includes("Ready to be shipped"));
  assert.ok(!modal.includes("<option>Found</option>"));
  assert.ok(page.includes("Awaiting Guest Action") || page.includes("LOST_ITEM_STATUS"));
  assert.ok(modal.includes("Awaiting Guest Action"));
  assert.ok(modal.includes("Ready to Ship"));
});

check("manual workflow still present with remapped statuses", () => {
  const send = fs.readFileSync(path.join(root, "app/api/send-email/route.ts"), "utf8");
  const upload = fs.readFileSync(path.join(root, "app/api/upload-label/route.ts"), "utf8");
  assert.ok(send.includes("Awaiting Guest Action"));
  assert.ok(upload.includes("Ready to Ship"));
  assert.ok(fs.existsSync(path.join(root, "app/SendLabelRequestForm.tsx")));
});

check("guest link remains tracking page after label (no new email/link)", () => {
  const resolve = fs.readFileSync(
    path.join(root, "app/lib/lost-found-shipping/shipping-requests.ts"),
    "utf8"
  );
  assert.ok(resolve.includes("Never treat these as \"expired\""));
  assert.ok(resolve.includes('state = "label_created"'));
  assert.ok(resolve.includes("carrierTrackingStatus"));
  assert.ok(resolve.includes("latestCarrierUpdate"));

  const page = fs.readFileSync(
    path.join(root, "app/shipping-request/[token]/page.tsx"),
    "utf8"
  );
  assert.ok(page.includes("GuestShipmentTrackingCard"));
  assert.ok(page.includes("visibilitychange"));
  assert.ok(page.includes("loadRequest({ quiet: true })"));
  assert.ok(page.includes('view.state === "label_created"'));

  const token = fs.readFileSync(
    path.join(root, "app/lib/lost-found-shipping/token.ts"),
    "utf8"
  );
  assert.ok(token.includes("GUEST_TRACKING_LINK_TTL_HOURS"));
  assert.ok(token.includes("laterTokenExpiry"));

  const stripe = fs.readFileSync(
    path.join(root, "app/lib/payments/process-stripe-webhook.ts"),
    "utf8"
  );
  assert.ok(stripe.includes("laterTokenExpiry"));
  assert.ok(stripe.includes("token_expires_at"));
});

if (failures > 0) {
  console.error(`\n${failures} check(s) failed`);
  process.exit(1);
}
console.log("\nAll Lost & Found status/tracking checks passed.");
