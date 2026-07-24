import type {
  ShippingFulfillmentStatus,
  ShippingPaymentStatus,
  ShippingShipmentStatus,
  ShippingUiBadge,
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

/**
 * Top-level lost_items.status values.
 * Automated path: Found → Awaiting Guest Payment → Ready to be shipped → Shipped → Delivered.
 * Manual path keeps Label sent / Ready to be shipped compatibility.
 * Stored is retained for legacy rows.
 */
export const LOST_ITEM_STATUS = {
  found: "Found",
  stored: "Stored",
  awaitingGuestPayment: "Awaiting Guest Payment",
  labelSent: "Label sent",
  readyToShip: "Ready to be shipped",
  shipped: "Shipped",
  delivered: "Delivered",
  discarded: "Discarded",
} as const;

/** Staff filter / select options (legacy + automated). */
export const LOST_ITEM_STATUS_OPTIONS = [
  LOST_ITEM_STATUS.found,
  LOST_ITEM_STATUS.stored,
  LOST_ITEM_STATUS.awaitingGuestPayment,
  LOST_ITEM_STATUS.labelSent,
  LOST_ITEM_STATUS.readyToShip,
  LOST_ITEM_STATUS.shipped,
  LOST_ITEM_STATUS.delivered,
  LOST_ITEM_STATUS.discarded,
] as const;

/**
 * Whether a tracking webhook may move lost_items.status to Delivered.
 * Never overwrite Discarded; never downgrade from Delivered.
 */
export function canApplyDeliveredToLostItem(
  currentStatus: string | null | undefined
): boolean {
  const status = (currentStatus || "").trim();
  if (status === LOST_ITEM_STATUS.discarded) return false;
  if (status === LOST_ITEM_STATUS.delivered) return false;
  return true;
}

export function canApplyShippedToLostItem(
  currentStatus: string | null | undefined
): boolean {
  const status = (currentStatus || "").trim();
  if (status === LOST_ITEM_STATUS.discarded) return false;
  if (status === LOST_ITEM_STATUS.delivered) return false;
  return true;
}
