import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type Stripe from "stripe";
import { appendShippingEvent } from "@/app/lib/lost-found-shipping/shipping-requests";
import { SHIPPING_TIMELINE_EVENTS } from "@/app/lib/lost-found-shipping/timeline";
import { fulfillPaidCheckoutSession } from "@/app/lib/payments/fulfill-paid-checkout-session";
import {
  claimWebhookEvent,
  findPaymentByCheckoutSessionId,
  findPaymentById,
  findPaymentByPaymentIntentId,
  updatePaymentStatus,
} from "@/app/lib/payments/payment-records";
import { getStripeServerClient } from "@/app/lib/payments/stripe-server";
import {
  getStripeCheckoutStatus,
  getStripeWebhookSecret,
} from "@/app/lib/payments/stripe-env";
import { redactStripeId } from "@/app/lib/payments/types";

export type StripeWebhookResult = {
  ok: boolean;
  duplicate: boolean;
  handled: boolean;
  eventType: string;
  paymentId: number | null;
  message: string;
};

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
 * On paid: mirrors payment state, then attempts automatic label purchase.
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
    const status = getStripeCheckoutStatus();
    console.error("[stripe-webhook] signature verification failed", {
      reason: "invalid_signature",
      stripeMode: status.mode,
      vercelEnv: process.env.VERCEL_ENV || null,
      hint:
        status.mode === "live"
          ? "STRIPE_WEBHOOK_SECRET must be the signing secret from the LIVE webhook endpoint (not test/CLI)."
          : "STRIPE_WEBHOOK_SECRET must match the webhook endpoint for this Stripe mode.",
    });
    throw new StripeWebhookVerifyError("Invalid Stripe webhook signature");
  }

  if (
    event.type === "checkout.session.completed" ||
    event.type === "checkout.session.async_payment_succeeded"
  ) {
    const result = await fulfillPaidCheckoutSession(
      supabase,
      event.data.object as Stripe.Checkout.Session,
      {
        providerEventId: event.id,
        eventType: event.type,
        source: "webhook",
      }
    );
    return {
      ok: result.ok,
      duplicate: result.duplicate,
      handled: result.handled,
      eventType: event.type,
      paymentId: result.paymentId,
      message: result.message,
    };
  }

  if (event.type === "checkout.session.expired") {
    return handleCheckoutSessionExpired(
      supabase,
      event,
      event.data.object as Stripe.Checkout.Session
    );
  }

  if (event.type === "checkout.session.async_payment_failed") {
    return handleCheckoutAsyncPaymentFailed(
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

async function handleCheckoutAsyncPaymentFailed(
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
      message: "Ignored async failure for paid payment",
    };
  }

  await updatePaymentStatus(supabase, payment.id, {
    status: "failed",
    failureReason: "Checkout async payment failed",
    appendWebhookEventId: event.id,
  });

  await appendShippingTimelineSafe(supabase, payment.shipping_request_id, {
    eventType: SHIPPING_TIMELINE_EVENTS.paymentFailed,
    eventSource: "stripe",
    eventData: {
      notes: "Async checkout payment failed — guest may try again",
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
    message: "Async payment marked failed",
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
