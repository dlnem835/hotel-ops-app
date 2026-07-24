import "server-only";

export type PaymentPurpose =
  | "lost_found_shipping"
  | "subscription"
  | "one_eyrie_billing"
  | "other";

export type PaymentProvider = "stripe";

export type PaymentAttemptStatus =
  | "created"
  | "checkout_open"
  | "paid"
  | "failed"
  | "expired"
  | "cancelled"
  | "refunded"
  | "partially_refunded";

export type PaymentRow = {
  id: number;
  organization_id: number;
  property_id: number;
  purpose: PaymentPurpose | string;
  shipping_request_id: number | null;
  provider: PaymentProvider | string;
  provider_checkout_session_id: string | null;
  provider_payment_intent_id: string | null;
  amount_cents: number;
  currency: string;
  status: PaymentAttemptStatus | string;
  failure_reason: string | null;
  processed_webhook_event_ids: string[] | null;
  metadata_json: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
  paid_at: string | null;
};

export function redactStripeId(id: string | null | undefined): string | null {
  if (!id) return null;
  if (id.length <= 12) return `${id.slice(0, 4)}***`;
  return `${id.slice(0, 8)}…${id.slice(-4)}`;
}

export function centsToAmount(cents: number): number {
  return Math.round(cents) / 100;
}

export function amountToCents(amount: number): number {
  return Math.round(amount * 100);
}
