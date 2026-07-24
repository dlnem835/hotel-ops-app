import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  amountToCents,
  type PaymentAttemptStatus,
  type PaymentRow,
} from "@/app/lib/payments/types";

function mapPaymentRow(row: Record<string, unknown>): PaymentRow {
  return {
    id: Number(row.id),
    organization_id: Number(row.organization_id),
    property_id: Number(row.property_id),
    purpose: String(row.purpose || "lost_found_shipping"),
    shipping_request_id:
      row.shipping_request_id == null ? null : Number(row.shipping_request_id),
    provider: String(row.provider || "stripe"),
    provider_checkout_session_id: row.provider_checkout_session_id
      ? String(row.provider_checkout_session_id)
      : null,
    provider_payment_intent_id: row.provider_payment_intent_id
      ? String(row.provider_payment_intent_id)
      : null,
    amount_cents: Number(row.amount_cents),
    currency: String(row.currency || "usd").toLowerCase(),
    status: String(row.status || "created"),
    failure_reason: row.failure_reason ? String(row.failure_reason) : null,
    processed_webhook_event_ids: Array.isArray(row.processed_webhook_event_ids)
      ? row.processed_webhook_event_ids.map(String)
      : [],
    metadata_json:
      row.metadata_json && typeof row.metadata_json === "object"
        ? (row.metadata_json as Record<string, unknown>)
        : {},
    created_at: String(row.created_at),
    updated_at: String(row.updated_at),
    paid_at: row.paid_at ? String(row.paid_at) : null,
  };
}

export async function findPaymentById(
  supabase: SupabaseClient,
  paymentId: number
): Promise<PaymentRow | null> {
  const { data, error } = await supabase
    .from("payments")
    .select("*")
    .eq("id", paymentId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data ? mapPaymentRow(data as Record<string, unknown>) : null;
}

export async function findPaymentByCheckoutSessionId(
  supabase: SupabaseClient,
  sessionId: string
): Promise<PaymentRow | null> {
  const { data, error } = await supabase
    .from("payments")
    .select("*")
    .eq("provider", "stripe")
    .eq("provider_checkout_session_id", sessionId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data ? mapPaymentRow(data as Record<string, unknown>) : null;
}

export async function findPaymentByPaymentIntentId(
  supabase: SupabaseClient,
  paymentIntentId: string
): Promise<PaymentRow | null> {
  const { data, error } = await supabase
    .from("payments")
    .select("*")
    .eq("provider", "stripe")
    .eq("provider_payment_intent_id", paymentIntentId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data ? mapPaymentRow(data as Record<string, unknown>) : null;
}

export async function findOpenPaymentForShippingRequest(
  supabase: SupabaseClient,
  shippingRequestId: number
): Promise<PaymentRow | null> {
  const { data, error } = await supabase
    .from("payments")
    .select("*")
    .eq("shipping_request_id", shippingRequestId)
    .eq("purpose", "lost_found_shipping")
    .eq("status", "checkout_open")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data ? mapPaymentRow(data as Record<string, unknown>) : null;
}

export async function findSuccessfulPaymentForShippingRequest(
  supabase: SupabaseClient,
  shippingRequestId: number
): Promise<PaymentRow | null> {
  const { data, error } = await supabase
    .from("payments")
    .select("*")
    .eq("shipping_request_id", shippingRequestId)
    .eq("purpose", "lost_found_shipping")
    .eq("status", "paid")
    .order("paid_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data ? mapPaymentRow(data as Record<string, unknown>) : null;
}

export async function createShippingPaymentAttempt(
  supabase: SupabaseClient,
  input: {
    organizationId: number;
    propertyId: number;
    shippingRequestId: number;
    amount: number;
    currency?: string;
    metadata?: Record<string, unknown>;
  }
): Promise<PaymentRow> {
  const amountCents = amountToCents(input.amount);
  if (!Number.isFinite(amountCents) || amountCents < 50) {
    throw new Error("Payment amount is below the minimum chargeable amount.");
  }

  const { data, error } = await supabase
    .from("payments")
    .insert({
      organization_id: input.organizationId,
      property_id: input.propertyId,
      purpose: "lost_found_shipping",
      shipping_request_id: input.shippingRequestId,
      provider: "stripe",
      amount_cents: amountCents,
      currency: (input.currency || "usd").toLowerCase(),
      status: "created",
      metadata_json: input.metadata || {},
    })
    .select("*")
    .single();

  if (error || !data) {
    throw new Error(error?.message || "Unable to create payment attempt");
  }
  return mapPaymentRow(data as Record<string, unknown>);
}

export async function markPaymentCheckoutOpen(
  supabase: SupabaseClient,
  paymentId: number,
  checkoutSessionId: string
): Promise<PaymentRow> {
  const { data, error } = await supabase
    .from("payments")
    .update({
      provider_checkout_session_id: checkoutSessionId,
      status: "checkout_open",
      updated_at: new Date().toISOString(),
    })
    .eq("id", paymentId)
    .select("*")
    .single();
  if (error || !data) {
    throw new Error(error?.message || "Unable to update payment checkout session");
  }
  return mapPaymentRow(data as Record<string, unknown>);
}

export async function updatePaymentStatus(
  supabase: SupabaseClient,
  paymentId: number,
  patch: {
    status: PaymentAttemptStatus;
    providerPaymentIntentId?: string | null;
    failureReason?: string | null;
    paidAt?: string | null;
    appendWebhookEventId?: string | null;
    metadataPatch?: Record<string, unknown>;
  }
): Promise<PaymentRow> {
  const existing = await findPaymentById(supabase, paymentId);
  if (!existing) throw new Error("Payment not found");

  const eventIds = [...(existing.processed_webhook_event_ids || [])];
  if (
    patch.appendWebhookEventId &&
    !eventIds.includes(patch.appendWebhookEventId)
  ) {
    eventIds.push(patch.appendWebhookEventId);
  }

  const metadata = {
    ...(existing.metadata_json || {}),
    ...(patch.metadataPatch || {}),
  };

  const { data, error } = await supabase
    .from("payments")
    .update({
      status: patch.status,
      provider_payment_intent_id:
        patch.providerPaymentIntentId !== undefined
          ? patch.providerPaymentIntentId
          : existing.provider_payment_intent_id,
      failure_reason:
        patch.failureReason !== undefined
          ? patch.failureReason
          : existing.failure_reason,
      paid_at:
        patch.paidAt !== undefined ? patch.paidAt : existing.paid_at,
      processed_webhook_event_ids: eventIds,
      metadata_json: metadata,
      updated_at: new Date().toISOString(),
    })
    .eq("id", paymentId)
    .select("*")
    .single();

  if (error || !data) {
    throw new Error(error?.message || "Unable to update payment");
  }
  return mapPaymentRow(data as Record<string, unknown>);
}

/**
 * Claim a Stripe webhook event for processing.
 * Returns { claimed: true } on first insert, { claimed: false } if already processed.
 */
export async function claimWebhookEvent(
  supabase: SupabaseClient,
  input: {
    providerEventId: string;
    eventType: string;
    paymentId?: number | null;
    organizationId?: number | null;
    propertyId?: number | null;
  }
): Promise<{ claimed: boolean }> {
  const { error } = await supabase.from("payment_webhook_receipts").insert({
    provider: "stripe",
    provider_event_id: input.providerEventId,
    event_type: input.eventType,
    payment_id: input.paymentId ?? null,
    organization_id: input.organizationId ?? null,
    property_id: input.propertyId ?? null,
  });

  if (!error) return { claimed: true };

  // Unique violation → already processed
  if (
    error.code === "23505" ||
    /duplicate|unique/i.test(error.message || "")
  ) {
    return { claimed: false };
  }
  throw new Error(error.message);
}
