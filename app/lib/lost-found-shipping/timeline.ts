/**
 * Immutable shipping timeline event catalog.
 * Events are append-only rows in lost_found_shipping_events.
 */

export const SHIPPING_TIMELINE_EVENTS = {
  requestCreated: "shipping_request_created",
  requestEmailed: "shipping_request_emailed",
  guestOpened: "guest_opened_shipping_request",
  guestEnteredAddress: "guest_entered_shipping_address",
  addressValidated: "address_validated",
  addressValidationFailed: "address_validation_failed",
  ratesRetrieved: "shipping_rates_retrieved",
  rateSelected: "shipping_rate_selected",
  paymentStarted: "payment_started",
  paymentCompleted: "payment_completed",
  paymentFailed: "payment_failed",
  checkoutSessionCreated: "checkout_session_created",
  checkoutCancelled: "checkout_cancelled",
  checkoutExpired: "checkout_expired",
  labelPurchased: "label_purchased",
  labelPurchaseFailed: "label_purchase_failed",
  labelPrinted: "label_printed",
  trackingAssigned: "tracking_number_assigned",
  packageShipped: "package_shipped",
  packageDelivered: "package_delivered",
  requestCancelled: "shipping_request_cancelled",
  manualRetry: "manual_retry",
  manualReview: "manual_review",
  guestEditingAddress: "guest_editing_shipping_address",
  guestLinkIssued: "guest_link_issued",
} as const;

export type ShippingTimelineEventType =
  (typeof SHIPPING_TIMELINE_EVENTS)[keyof typeof SHIPPING_TIMELINE_EVENTS];

export const SHIPPING_TIMELINE_LABELS: Record<ShippingTimelineEventType, string> = {
  shipping_request_created: "Shipping request created",
  shipping_request_emailed: "Shipping request emailed to guest",
  guest_opened_shipping_request: "Guest opened link",
  guest_entered_shipping_address: "Address entered",
  address_validated: "Address validated",
  address_validation_failed: "Address validation failed",
  shipping_rates_retrieved: "Shipping rates retrieved",
  shipping_rate_selected: "Shipping option selected",
  payment_started: "Secure checkout started",
  payment_completed: "Payment received",
  payment_failed: "Payment failed",
  checkout_session_created: "Checkout session created",
  checkout_cancelled: "Guest returned from cancelled checkout",
  checkout_expired: "Checkout expired",
  label_purchased: "Label purchased",
  label_purchase_failed: "Label purchase failed",
  label_printed: "Label printed",
  tracking_number_assigned: "Tracking number generated",
  package_shipped: "Package shipped",
  package_delivered: "Delivered",
  shipping_request_cancelled: "Shipping request cancelled",
  manual_retry: "Manual retry",
  manual_review: "Manual review",
  guest_editing_shipping_address: "Guest editing shipping address",
  guest_link_issued: "Guest link issued for staff",
};

export function shippingTimelineLabel(eventType: string): string {
  return (
    SHIPPING_TIMELINE_LABELS[eventType as ShippingTimelineEventType] ||
    eventType.replace(/_/g, " ")
  );
}
