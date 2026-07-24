/** Domain types for Lost & Found shipping (provider-agnostic). */

export type ShippingAddress = {
  name: string;
  line1: string;
  line2?: string;
  city: string;
  state: string;
  postal: string;
  country: string;
  phone?: string;
  email?: string;
};

export type ShippingPackage = {
  lengthIn: number;
  widthIn: number;
  heightIn: number;
  weightOz: number;
};

export type ShippingRate = {
  /** Opaque provider rate id — only meaningful to the active provider. */
  providerRateId: string;
  carrier: string;
  service: string;
  amount: number;
  currency: string;
  estimatedDaysMin?: number | null;
  estimatedDaysMax?: number | null;
  estimatedDeliveryLabel?: string | null;
};

export type AddressValidationResult = {
  isValid: boolean;
  messages: string[];
  /** Suggested correction when the provider returns one. */
  suggestedAddress?: ShippingAddress | null;
};

export type PurchasedLabel = {
  providerTransactionId: string;
  trackingNumber: string;
  trackingUrl: string | null;
  labelPdfBase64?: string | null;
  labelUrl?: string | null;
  carrier: string;
  service: string;
};

export type TrackingStatus =
  | "unknown"
  | "pre_transit"
  | "in_transit"
  | "delivered"
  | "exception"
  | "returned";

export type TrackingResult = {
  status: TrackingStatus;
  trackingNumber: string;
  trackingUrl: string | null;
  rawStatus?: string | null;
};

export type ShippingPaymentStatus =
  | "pending"
  | "paid"
  | "failed"
  | "expired"
  | "refunded";

export type ShippingFulfillmentStatus =
  | "pending"
  | "label_ready"
  | "needs_manual_review"
  | "cancelled";

export type ShippingShipmentStatus =
  | "awaiting_guest"
  | "awaiting_payment"
  | "label_ready"
  | "in_transit"
  | "delivered"
  | "exception"
  | "cancelled";

export type ShippingUiBadge =
  | "Awaiting Guest"
  | "Awaiting Payment"
  | "Payment Failed"
  | "Paid"
  | "Label Ready"
  | "In Transit"
  | "Delivered"
  | "Needs Manual Review"
  | "Cancelled"
  | "Expired";
