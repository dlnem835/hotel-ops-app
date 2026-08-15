import type {
  ShippingFulfillmentStatus,
  ShippingPaymentStatus,
  ShippingShipmentStatus,
  ShippingUiBadge,
  TrackingStatus,
} from "@/app/lib/shipping/types";

function isExpired(expiresAt: string | Date, now = new Date()): boolean {
  const expiry = typeof expiresAt === "string" ? new Date(expiresAt) : expiresAt;
  return Number.isNaN(expiry.getTime()) || expiry.getTime() <= now.getTime();
}

export type ShippingRequestStatusInput = {
  paymentStatus: ShippingPaymentStatus | string;
  fulfillmentStatus: ShippingFulfillmentStatus | string;
  shipmentStatus: ShippingShipmentStatus | string;
  tokenExpiresAt: string | Date;
  cancelledAt?: string | Date | null;
};

/** Derive staff/guest badge from shipping-request fields (not lost_items.status). */
export function deriveShippingUiBadge(
  input: ShippingRequestStatusInput,
  now = new Date()
): ShippingUiBadge {
  if (input.cancelledAt) return "Cancelled";

  if (input.paymentStatus === "pending" && isExpired(input.tokenExpiresAt, now)) {
    return "Expired";
  }

  if (input.fulfillmentStatus === "needs_manual_review") {
    return "Needs Manual Review";
  }

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

/** Staff Automated Shipping "Current Step" badge (workflow stage, not lost_items.status). */
export type ShippingCurrentStep =
  | "Awaiting Guest Address"
  | "Awaiting Shipping Selection"
  | "Awaiting Guest Payment"
  | "Payment received — preparing shipping label."
  | "Payment received — label creation failed"
  | "Ready to Ship"
  | "Shipped"
  | "Delivered"
  | "Needs Manual Review";

export function deriveShippingCurrentStep(
  input: ShippingRequestStatusInput & {
    selectedCarrier?: string | null;
    selectedService?: string | null;
    providerRateId?: string | null;
  },
  now = new Date()
): ShippingCurrentStep {
  if (input.fulfillmentStatus === "needs_manual_review") {
    return "Payment received — label creation failed";
  }
  if (input.shipmentStatus === "delivered") return "Delivered";
  if (input.shipmentStatus === "in_transit") return "Shipped";
  if (
    input.fulfillmentStatus === "label_ready" ||
    input.shipmentStatus === "label_ready"
  ) {
    return "Ready to Ship";
  }
  if (input.paymentStatus === "paid") {
    return "Payment received — preparing shipping label.";
  }
  if (input.shipmentStatus === "awaiting_payment") {
    const hasSelection = Boolean(
      input.providerRateId || input.selectedCarrier || input.selectedService
    );
    return hasSelection ? "Awaiting Guest Payment" : "Awaiting Shipping Selection";
  }
  if (
    input.paymentStatus === "pending" &&
    isExpired(input.tokenExpiresAt, now)
  ) {
    return "Awaiting Guest Address";
  }
  return "Awaiting Guest Address";
}

/**
 * Six primary Lost & Found operational statuses (staff-facing).
 * Detailed payment / carrier state lives on shipping request fields + timeline.
 */
export const LOST_ITEM_STATUS = {
  stored: "Stored",
  awaitingGuestAction: "Awaiting Guest Action",
  readyToShip: "Ready to Ship",
  shipped: "Shipped",
  delivered: "Delivered",
  discarded: "Discarded",
} as const;

export type LostItemStatus =
  (typeof LOST_ITEM_STATUS)[keyof typeof LOST_ITEM_STATUS];

/** Staff filter / select options — primary six only. */
export const LOST_ITEM_STATUS_OPTIONS: readonly LostItemStatus[] = [
  LOST_ITEM_STATUS.stored,
  LOST_ITEM_STATUS.awaitingGuestAction,
  LOST_ITEM_STATUS.readyToShip,
  LOST_ITEM_STATUS.shipped,
  LOST_ITEM_STATUS.delivered,
  LOST_ITEM_STATUS.discarded,
] as const;

/** Carrier-owned once a live label + tracking number exist. */
export const SHIPPO_OWNED_LOST_ITEM_STATUSES: readonly LostItemStatus[] = [
  LOST_ITEM_STATUS.readyToShip,
  LOST_ITEM_STATUS.shipped,
  LOST_ITEM_STATUS.delivered,
] as const;

/** Always staff-editable (including when tracking is active). */
export const STAFF_EDITABLE_LOST_ITEM_STATUSES: readonly LostItemStatus[] = [
  LOST_ITEM_STATUS.stored,
  LOST_ITEM_STATUS.awaitingGuestAction,
  LOST_ITEM_STATUS.discarded,
] as const;

export function isShippoOwnedLostItemStatus(
  status: string | null | undefined
): boolean {
  const normalized = normalizeLostItemStatus(status);
  return Boolean(
    normalized &&
      (SHIPPO_OWNED_LOST_ITEM_STATUSES as readonly string[]).includes(normalized)
  );
}

export function isStaffEditableLostItemStatus(
  status: string | null | undefined
): boolean {
  const normalized = normalizeLostItemStatus(status);
  return Boolean(
    normalized &&
      (STAFF_EDITABLE_LOST_ITEM_STATUSES as readonly string[]).includes(
        normalized
      )
  );
}

/** @deprecated Legacy string aliases for docs / migration notes only. */
export const LOST_ITEM_STATUS_LEGACY_ALIASES = {
  foundLegacy: "Found",
  awaitingGuestPaymentLegacy: "Awaiting Guest Payment",
  labelSentLegacy: "Label sent",
  readyToBeShippedLegacy: "Ready to be shipped",
} as const;

const LEGACY_STATUS_MAP: Record<string, LostItemStatus> = {
  Found: LOST_ITEM_STATUS.stored,
  Stored: LOST_ITEM_STATUS.stored,
  "Awaiting Guest Payment": LOST_ITEM_STATUS.awaitingGuestAction,
  "Awaiting Guest Action": LOST_ITEM_STATUS.awaitingGuestAction,
  "Label sent": LOST_ITEM_STATUS.awaitingGuestAction,
  "Label Sent": LOST_ITEM_STATUS.awaitingGuestAction,
  "Label request sent": LOST_ITEM_STATUS.awaitingGuestAction,
  "Ready to be shipped": LOST_ITEM_STATUS.readyToShip,
  "Ready to be Shipped": LOST_ITEM_STATUS.readyToShip,
  "Ready to Ship": LOST_ITEM_STATUS.readyToShip,
  Shipped: LOST_ITEM_STATUS.shipped,
  Delivered: LOST_ITEM_STATUS.delivered,
  Discarded: LOST_ITEM_STATUS.discarded,
  Closed: LOST_ITEM_STATUS.discarded,
};

/** Normalize legacy or current status strings to the six primary values. */
export function normalizeLostItemStatus(
  raw: string | null | undefined
): LostItemStatus | null {
  const status = (raw || "").trim();
  if (!status) return null;
  if (status in LEGACY_STATUS_MAP) return LEGACY_STATUS_MAP[status];
  return null;
}

export function isPrimaryLostItemStatus(
  raw: string | null | undefined
): raw is LostItemStatus {
  const normalized = normalizeLostItemStatus(raw);
  return (
    normalized !== null &&
    (LOST_ITEM_STATUS_OPTIONS as readonly string[]).includes(normalized)
  );
}

/** Validate / coerce a staff-provided status for writes. */
export function coerceLostItemStatusForWrite(
  raw: string | null | undefined,
  fallback: LostItemStatus = LOST_ITEM_STATUS.stored
): LostItemStatus {
  return normalizeLostItemStatus(raw) || fallback;
}

/**
 * Workflow rank for automated upgrades.
 * Discarded is terminal and never auto-overwritten.
 */
export const LOST_ITEM_STATUS_RANK: Record<LostItemStatus, number> = {
  [LOST_ITEM_STATUS.stored]: 1,
  [LOST_ITEM_STATUS.awaitingGuestAction]: 2,
  [LOST_ITEM_STATUS.readyToShip]: 3,
  [LOST_ITEM_STATUS.shipped]: 4,
  [LOST_ITEM_STATUS.delivered]: 5,
  [LOST_ITEM_STATUS.discarded]: 100,
};

export type AutomatedLostItemStatusTarget =
  | typeof LOST_ITEM_STATUS.awaitingGuestAction
  | typeof LOST_ITEM_STATUS.readyToShip
  | typeof LOST_ITEM_STATUS.shipped
  | typeof LOST_ITEM_STATUS.delivered;

/**
 * Whether an automated (System / Shippo / Stripe) update may set lost_items.status.
 * - Never overwrite Discarded
 * - Never downgrade workflow rank (e.g. Delivered → Shipped, Shipped → Ready to Ship)
 * - Same status is a no-op (returns false so callers skip write)
 */
export function canApplyAutomatedLostItemStatus(
  currentStatus: string | null | undefined,
  nextStatus: AutomatedLostItemStatusTarget
): boolean {
  const current = normalizeLostItemStatus(currentStatus);
  if (!current) return true;
  if (current === LOST_ITEM_STATUS.discarded) return false;
  if (current === nextStatus) return false;

  const currentRank = LOST_ITEM_STATUS_RANK[current];
  const nextRank = LOST_ITEM_STATUS_RANK[nextStatus];
  return nextRank > currentRank;
}

/** @deprecated Prefer canApplyAutomatedLostItemStatus(..., Delivered) */
export function canApplyDeliveredToLostItem(
  currentStatus: string | null | undefined
): boolean {
  return canApplyAutomatedLostItemStatus(
    currentStatus,
    LOST_ITEM_STATUS.delivered
  );
}

/** @deprecated Prefer canApplyAutomatedLostItemStatus(..., Shipped) */
export function canApplyShippedToLostItem(
  currentStatus: string | null | undefined
): boolean {
  return canApplyAutomatedLostItemStatus(
    currentStatus,
    LOST_ITEM_STATUS.shipped
  );
}

/**
 * Map normalized carrier tracking → proposed operational lost_items.status.
 * Exceptions / returned do not propose Delivered; RTS stays Shipped.
 */
export function trackingStatusToOperationalLostItemStatus(
  tracking: TrackingStatus
): AutomatedLostItemStatusTarget | null {
  switch (tracking) {
    case "pre_transit":
      return LOST_ITEM_STATUS.readyToShip;
    case "in_transit":
      return LOST_ITEM_STATUS.shipped;
    case "delivered":
      return LOST_ITEM_STATUS.delivered;
    case "returned":
      return LOST_ITEM_STATUS.shipped;
    case "exception":
    case "unknown":
      return null;
    default:
      return null;
  }
}

export function mapShippoRawTrackingStatus(raw: string): TrackingStatus {
  const upper = (raw || "").trim().toUpperCase().replace(/[\s-]+/g, "_");
  switch (upper) {
    case "PRE_TRANSIT":
    case "PRETRANSIT":
      return "pre_transit";
    case "TRANSIT":
    case "IN_TRANSIT":
    case "OUT_FOR_DELIVERY":
    case "ACCEPTED":
      return "in_transit";
    case "DELIVERED":
      return "delivered";
    case "RETURNED":
    case "RETURN_TO_SENDER":
      return "returned";
    case "FAILURE":
    case "ERROR":
    case "FAILED":
      return "exception";
    default:
      return "unknown";
  }
}

/**
 * Prefer top-level Shippo status; fall back to substatus codes that mean
 * the carrier has accepted / moved the package (USPS "Accepted", etc.).
 */
export function resolveShippoTrackingStatus(
  rawStatus: string,
  substatusCode?: string | null
): TrackingStatus {
  const primary = mapShippoRawTrackingStatus(rawStatus);
  if (primary !== "unknown") return primary;

  const code = String(substatusCode || "")
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");
  if (!code) return "unknown";

  if (
    code === "package_accepted" ||
    code === "package_arrived" ||
    code === "package_departed" ||
    code === "package_forwarded" ||
    code === "package_processed" ||
    code === "out_for_delivery" ||
    code === "delivery_scheduled" ||
    code === "picked_up"
  ) {
    return "in_transit";
  }
  if (code === "delivered" || code.startsWith("delivered_")) {
    return "delivered";
  }
  if (
    code === "return_to_sender" ||
    code === "package_returned" ||
    code === "returned_to_sender"
  ) {
    return "returned";
  }
  if (
    code === "delivery_attempted" ||
    code === "package_undeliverable" ||
    code === "package_damaged" ||
    code === "package_lost" ||
    code === "delivery_failure"
  ) {
    return "exception";
  }
  if (code === "information_received" || code === "label_created") {
    return "pre_transit";
  }
  return "unknown";
}

export function carrierTrackingStatusLabel(status: string | null | undefined): string {
  switch ((status || "").trim().toLowerCase()) {
    case "pre_transit":
      return "Pre-transit";
    case "in_transit":
      return "In transit";
    case "delivered":
      return "Delivered";
    case "exception":
      return "Exception";
    case "returned":
      return "Returned to sender";
    case "unknown":
      return "Unknown";
    default:
      return status?.trim() || "Not available";
  }
}
