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
  labelPurchased: "label_purchased",
  labelPurchaseFailed: "label_purchase_failed",
  labelPrinted: "label_printed",
  trackingAssigned: "tracking_number_assigned",
  packageShipped: "package_shipped",
  packageDelivered: "package_delivered",
  requestCancelled: "shipping_request_cancelled",
  manualRetry: "manual_retry",
  manualReview: "manual_review",
} as const;

export type ShippingTimelineEventType =
  (typeof SHIPPING_TIMELINE_EVENTS)[keyof typeof SHIPPING_TIMELINE_EVENTS];

export const SHIPPING_TIMELINE_LABELS: Record<ShippingTimelineEventType, string> = {
  shipping_request_created: "Shipping request created",
  shipping_request_emailed: "Shipping request emailed to guest",
  guest_opened_shipping_request: "Guest opened shipping request",
  guest_entered_shipping_address: "Guest entered shipping address",
  address_validated: "Address validated",
  address_validation_failed: "Address validation failed",
  shipping_rates_retrieved: "Shipping rates retrieved",
  shipping_rate_selected: "Shipping rate selected",
  payment_started: "Payment started",
  payment_completed: "Payment completed",
  payment_failed: "Payment failed",
  label_purchased: "Label purchased",
  label_purchase_failed: "Label purchase failed",
  label_printed: "Label printed",
  tracking_number_assigned: "Tracking number assigned",
  package_shipped: "Package shipped",
  package_delivered: "Package delivered",
  shipping_request_cancelled: "Shipping request cancelled",
  manual_retry: "Manual retry",
  manual_review: "Manual review",
};

export function shippingTimelineLabel(eventType: string): string {
  return (
    SHIPPING_TIMELINE_LABELS[eventType as ShippingTimelineEventType] ||
    eventType.replace(/_/g, " ")
  );
}
