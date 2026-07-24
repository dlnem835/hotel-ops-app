import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type Stripe from "stripe";
import { appendShippingEvent } from "@/app/lib/lost-found-shipping/shipping-requests";
import { SHIPPING_TIMELINE_EVENTS } from "@/app/lib/lost-found-shipping/timeline";
import {
  claimWebhookEvent,
  findPaymentByCheckoutSessionId,
  findPaymentById,
  findPaymentByPaymentIntentId,
  updatePaymentStatus,
} from "@/app/lib/payments/payment-records";
import { getStripeServerClient } from "@/app/lib/payments/stripe-server";
import { getStripeWebhookSecret } from "@/app/lib/payments/stripe-env";
import { redactStripeId } from "@/app/lib/payments/types";

export type StripeWebhookResult = {
  ok: boolean;
  duplicate: boolean;
  handled: boolean;
  eventType: string;
  paymentId: number | null;
  message: string;
};

function paymentIntentIdFromSession(
  session: Stripe.Checkout.Session
): string | null {
  const pi = session.payment_intent;
  if (!pi) return null;
  if (typeof pi === "string") return pi;
  return pi.id || null;
}

/** Provider receipt URL when Stripe exposes one (stored in payment metadata_json). */
async function resolveProviderReceiptUrl(
  stripe: Stripe,
  session: Stripe.Checkout.Session
): Promise<string | null> {
  try {
    const paymentIntentId = paymentIntentIdFromSession(session);
    if (!paymentIntentId) return null;
    const intent = await stripe.paymentIntents.retrieve(paymentIntentId, {
      expand: ["latest_charge"],
    });
    const charge = intent.latest_charge;
    if (charge && typeof charge !== "string" && charge.receipt_url) {
      return String(charge.receipt_url);
    }
  } catch {
    return null;
  }
  return null;
}

async function resolvePaymentForSession(
  supabase: SupabaseClient,
  session: Stripe.Checkout.Session
) {
  const metaPaymentId = Number(session.metadata?.oe_payment_id || 0);
  if (Number.isFinite(metaPaymentId) && metaPaymentId > 0) {
    const byId = await findPaymentById(supabase, metaPaymentId);
    if (byId) return byId;
  }
  return findPaymentByCheckoutSessionId(supabase, session.id);
}

/**
 * Verify Stripe signature and process payment webhooks idempotently.
 * Does not purchase labels or update Shipped/Delivered.
 */
export async function processStripeWebhookEvent(
  supabase: SupabaseClient,
  rawBody: string,
  signatureHeader: string | null
): Promise<StripeWebhookResult> {
  if (!signatureHeader) {
    throw new StripeWebhookVerifyError("Missing Stripe-Signature header");
  }

  const stripe = getStripeServerClient();
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(
      rawBody,
      signatureHeader,
      getStripeWebhookSecret()
    );
  } catch {
    throw new StripeWebhookVerifyError("Invalid Stripe webhook signature");
  }

  if (event.type === "checkout.session.completed") {
    return handleCheckoutSessionCompleted(
      supabase,
      event,
      event.data.object as Stripe.Checkout.Session
    );
  }

  if (event.type === "checkout.session.expired") {
    return handleCheckoutSessionExpired(
      supabase,
      event,
      event.data.object as Stripe.Checkout.Session
    );
  }

  if (event.type === "payment_intent.payment_failed") {
    return handlePaymentIntentFailed(
      supabase,
      event,
      event.data.object as Stripe.PaymentIntent
    );
  }

  // Acknowledge unrelated events without claiming them against a payment.
  return {
    ok: true,
    duplicate: false,
    handled: false,
    eventType: event.type,
    paymentId: null,
    message: "Event ignored",
  };
}

export class StripeWebhookVerifyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "StripeWebhookVerifyError";
  }
}

async function handleCheckoutSessionCompleted(
  supabase: SupabaseClient,
  event: Stripe.Event,
  session: Stripe.Checkout.Session
): Promise<StripeWebhookResult> {
  const payment = await resolvePaymentForSession(supabase, session);
  if (!payment) {
    return {
      ok: true,
      duplicate: false,
      handled: false,
      eventType: event.type,
      paymentId: null,
      message: "No matching payment attempt",
    };
  }

  const claim = await claimWebhookEvent(supabase, {
    providerEventId: event.id,
    eventType: event.type,
    paymentId: payment.id,
    organizationId: payment.organization_id,
    propertyId: payment.property_id,
  });
  if (!claim.claimed) {
    return {
      ok: true,
      duplicate: true,
      handled: true,
      eventType: event.type,
      paymentId: payment.id,
      message: "Already processed",
    };
  }

  // Already paid — still claim event, do not duplicate timeline.
  if (payment.status === "paid") {
    await updatePaymentStatus(supabase, payment.id, {
      status: "paid",
      appendWebhookEventId: event.id,
      providerPaymentIntentId: paymentIntentIdFromSession(session),
    });
    return {
      ok: true,
      duplicate: true,
      handled: true,
      eventType: event.type,
      paymentId: payment.id,
      message: "Payment already marked paid",
    };
  }

  if (session.payment_status !== "paid") {
    await updatePaymentStatus(supabase, payment.id, {
      status: "failed",
      failureReason: `Checkout completed with payment_status=${session.payment_status}`,
      appendWebhookEventId: event.id,
      providerPaymentIntentId: paymentIntentIdFromSession(session),
    });
    await appendShippingTimelineSafe(supabase, payment.shipping_request_id, {
      eventType: SHIPPING_TIMELINE_EVENTS.paymentFailed,
      eventSource: "stripe",
      eventData: {
        notes: "Checkout session completed but payment was not paid",
        sessionRef: redactStripeId(session.id),
        eventRef: redactStripeId(event.id),
        paymentId: payment.id,
      },
    });
    return {
      ok: true,
      duplicate: false,
      handled: true,
      eventType: event.type,
      paymentId: payment.id,
      message: "Session not paid",
    };
  }

  const sessionAmount = Number(session.amount_total ?? 0);
  const sessionCurrency = String(session.currency || "").toLowerCase();
  if (sessionAmount !== payment.amount_cents || sessionCurrency !== payment.currency) {
    await updatePaymentStatus(supabase, payment.id, {
      status: "failed",
      failureReason: "Checkout amount/currency mismatch vs stored payment",
      appendWebhookEventId: event.id,
      providerPaymentIntentId: paymentIntentIdFromSession(session),
    });
    await appendShippingTimelineSafe(supabase, payment.shipping_request_id, {
      eventType: SHIPPING_TIMELINE_EVENTS.paymentFailed,
      eventSource: "stripe",
      eventData: {
        notes: "Payment amount verification failed — not marked paid",
        sessionRef: redactStripeId(session.id),
        eventRef: redactStripeId(event.id),
        paymentId: payment.id,
        expectedCents: payment.amount_cents,
        receivedCents: sessionAmount,
      },
    });
    return {
      ok: false,
      duplicate: false,
      handled: true,
      eventType: event.type,
      paymentId: payment.id,
      message: "Amount mismatch",
    };
  }

  const metaRequestId = Number(session.metadata?.oe_shipping_request_id || 0);
  if (
    payment.shipping_request_id &&
    Number.isFinite(metaRequestId) &&
    metaRequestId > 0 &&
    metaRequestId !== payment.shipping_request_id
  ) {
    await updatePaymentStatus(supabase, payment.id, {
      status: "failed",
      failureReason: "Checkout metadata shipping request mismatch",
      appendWebhookEventId: event.id,
    });
    return {
      ok: false,
      duplicate: false,
      handled: true,
      eventType: event.type,
      paymentId: payment.id,
      message: "Shipping request mismatch",
    };
  }

  const paidAt = new Date().toISOString();
  const paymentIntentId = paymentIntentIdFromSession(session);
  const stripe = getStripeServerClient();
  const receiptUrl = await resolveProviderReceiptUrl(stripe, session);

  await updatePaymentStatus(supabase, payment.id, {
    status: "paid",
    paidAt,
    providerPaymentIntentId: paymentIntentId,
    appendWebhookEventId: event.id,
    failureReason: null,
    metadataPatch: receiptUrl
      ? { provider_receipt_url: receiptUrl }
      : undefined,
  });

  if (payment.shipping_request_id) {
    const { data: request } = await supabase
      .from("lost_found_shipping_requests")
      .select(
        "id, organization_id, property_id, lost_item_id, payment_status, successful_payment_id"
      )
      .eq("id", payment.shipping_request_id)
      .eq("organization_id", payment.organization_id)
      .eq("property_id", payment.property_id)
      .maybeSingle();

    if (request) {
      const alreadyPaid = String(request.payment_status) === "paid";

      // Mirror business payment state; do not purchase label or mark Ready to Ship.
      if (!alreadyPaid) {
        await supabase
          .from("lost_found_shipping_requests")
          .update({
            payment_status: "paid",
            paid_at: paidAt,
            successful_payment_id: payment.id,
            updated_at: paidAt,
          })
          .eq("id", request.id)
          .eq("organization_id", payment.organization_id)
          .eq("property_id", payment.property_id);
      } else if (!request.successful_payment_id) {
        await supabase
          .from("lost_found_shipping_requests")
          .update({
            successful_payment_id: payment.id,
            updated_at: paidAt,
          })
          .eq("id", request.id);
      }

      if (!alreadyPaid) {
        await appendShippingEvent(supabase, {
          organizationId: Number(request.organization_id),
          propertyId: Number(request.property_id),
          lostItemId: Number(request.lost_item_id),
          shippingRequestId: Number(request.id),
          eventType: SHIPPING_TIMELINE_EVENTS.paymentCompleted,
          eventSource: "stripe",
          eventData: {
            notes: "Payment received (Stripe verified)",
            sessionRef: redactStripeId(session.id),
            paymentIntentRef: redactStripeId(paymentIntentId),
            eventRef: redactStripeId(event.id),
            paymentId: payment.id,
            amountCents: payment.amount_cents,
            currency: payment.currency,
            receiptUrl: receiptUrl || null,
          },
        });
      }
    }
  }

  return {
    ok: true,
    duplicate: false,
    handled: true,
    eventType: event.type,
    paymentId: payment.id,
    message: "Payment marked paid",
  };
}

async function handleCheckoutSessionExpired(
  supabase: SupabaseClient,
  event: Stripe.Event,
  session: Stripe.Checkout.Session
): Promise<StripeWebhookResult> {
  const payment = await resolvePaymentForSession(supabase, session);
  if (!payment) {
    return {
      ok: true,
      duplicate: false,
      handled: false,
      eventType: event.type,
      paymentId: null,
      message: "No matching payment attempt",
    };
  }

  const claim = await claimWebhookEvent(supabase, {
    providerEventId: event.id,
    eventType: event.type,
    paymentId: payment.id,
    organizationId: payment.organization_id,
    propertyId: payment.property_id,
  });
  if (!claim.claimed) {
    return {
      ok: true,
      duplicate: true,
      handled: true,
      eventType: event.type,
      paymentId: payment.id,
      message: "Already processed",
    };
  }

  if (payment.status === "paid") {
    return {
      ok: true,
      duplicate: false,
      handled: true,
      eventType: event.type,
      paymentId: payment.id,
      message: "Ignored expired event for paid payment",
    };
  }

  await updatePaymentStatus(supabase, payment.id, {
    status: "expired",
    failureReason: "Checkout session expired",
    appendWebhookEventId: event.id,
  });

  // Keep shipping request unpaid so guest can retry with a new payment attempt.
  if (payment.shipping_request_id) {
    await supabase
      .from("lost_found_shipping_requests")
      .update({
        payment_status: "pending",
        updated_at: new Date().toISOString(),
      })
      .eq("id", payment.shipping_request_id)
      .eq("organization_id", payment.organization_id)
      .eq("property_id", payment.property_id)
      .neq("payment_status", "paid");

    await appendShippingTimelineSafe(supabase, payment.shipping_request_id, {
      eventType: SHIPPING_TIMELINE_EVENTS.checkoutExpired,
      eventSource: "stripe",
      eventData: {
        notes: "Checkout session expired — guest may try again",
        sessionRef: redactStripeId(session.id),
        eventRef: redactStripeId(event.id),
        paymentId: payment.id,
      },
    });
  }

  return {
    ok: true,
    duplicate: false,
    handled: true,
    eventType: event.type,
    paymentId: payment.id,
    message: "Checkout marked expired",
  };
}

async function handlePaymentIntentFailed(
  supabase: SupabaseClient,
  event: Stripe.Event,
  intent: Stripe.PaymentIntent
): Promise<StripeWebhookResult> {
  const metaPaymentId = Number(intent.metadata?.oe_payment_id || 0);
  let payment =
    Number.isFinite(metaPaymentId) && metaPaymentId > 0
      ? await findPaymentById(supabase, metaPaymentId)
      : null;

  if (!payment && intent.id) {
    payment = await findPaymentByPaymentIntentId(supabase, intent.id);
  }

  if (!payment) {
    return {
      ok: true,
      duplicate: false,
      handled: false,
      eventType: event.type,
      paymentId: null,
      message: "No matching payment attempt",
    };
  }

  const claim = await claimWebhookEvent(supabase, {
    providerEventId: event.id,
    eventType: event.type,
    paymentId: payment.id,
    organizationId: payment.organization_id,
    propertyId: payment.property_id,
  });
  if (!claim.claimed) {
    return {
      ok: true,
      duplicate: true,
      handled: true,
      eventType: event.type,
      paymentId: payment.id,
      message: "Already processed",
    };
  }

  if (payment.status === "paid") {
    return {
      ok: true,
      duplicate: false,
      handled: true,
      eventType: event.type,
      paymentId: payment.id,
      message: "Ignored failure for paid payment",
    };
  }

  const reason =
    intent.last_payment_error?.message ||
    intent.last_payment_error?.code ||
    "Payment failed";

  await updatePaymentStatus(supabase, payment.id, {
    status: "failed",
    failureReason: String(reason).slice(0, 500),
    providerPaymentIntentId: intent.id,
    appendWebhookEventId: event.id,
  });

  await appendShippingTimelineSafe(supabase, payment.shipping_request_id, {
    eventType: SHIPPING_TIMELINE_EVENTS.paymentFailed,
    eventSource: "stripe",
    eventData: {
      notes: "Payment failed — guest may try again",
      paymentIntentRef: redactStripeId(intent.id),
      eventRef: redactStripeId(event.id),
      paymentId: payment.id,
      // Safe high-level reason only (no card/billing details)
      failureCode: intent.last_payment_error?.code || null,
    },
  });

  return {
    ok: true,
    duplicate: false,
    handled: true,
    eventType: event.type,
    paymentId: payment.id,
    message: "Payment marked failed",
  };
}

async function appendShippingTimelineSafe(
  supabase: SupabaseClient,
  shippingRequestId: number | null,
  input: {
    eventType: string;
    eventSource: string;
    eventData: Record<string, unknown>;
  }
) {
  if (!shippingRequestId) return;
  const { data: request } = await supabase
    .from("lost_found_shipping_requests")
    .select("id, organization_id, property_id, lost_item_id")
    .eq("id", shippingRequestId)
    .maybeSingle();
  if (!request) return;
  await appendShippingEvent(supabase, {
    organizationId: Number(request.organization_id),
    propertyId: Number(request.property_id),
    lostItemId: Number(request.lost_item_id),
    shippingRequestId: Number(request.id),
    eventType: input.eventType,
    eventSource: input.eventSource,
    eventData: input.eventData,
  });
}
