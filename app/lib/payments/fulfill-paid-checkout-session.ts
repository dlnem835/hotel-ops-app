import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type Stripe from "stripe";
import { appendShippingEvent } from "@/app/lib/lost-found-shipping/shipping-requests";
import { purchaseLabelForPaidShippingRequest } from "@/app/lib/lost-found-shipping/purchase-label-for-request";
import { SHIPPING_TIMELINE_EVENTS } from "@/app/lib/lost-found-shipping/timeline";
import { laterTokenExpiry } from "@/app/lib/lost-found-shipping/token";
import {
  claimWebhookEvent,
  findPaymentByCheckoutSessionId,
  findPaymentById,
  updatePaymentStatus,
} from "@/app/lib/payments/payment-records";
import type { PaymentRow } from "@/app/lib/payments/types";
import { getStripeServerClient } from "@/app/lib/payments/stripe-server";
import { redactStripeId } from "@/app/lib/payments/types";

export type FulfillPaidCheckoutResult = {
  ok: boolean;
  duplicate: boolean;
  handled: boolean;
  paymentId: number | null;
  shippingRequestId: number | null;
  message: string;
  labelPurchased: boolean;
};

function paymentIntentIdFromSession(
  session: Stripe.Checkout.Session
): string | null {
  const pi = session.payment_intent;
  if (!pi) return null;
  if (typeof pi === "string") return pi;
  return pi.id || null;
}

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

export async function resolvePaymentForCheckoutSession(
  supabase: SupabaseClient,
  session: Stripe.Checkout.Session
): Promise<PaymentRow | null> {
  const metaPaymentId = Number(session.metadata?.oe_payment_id || 0);
  if (Number.isFinite(metaPaymentId) && metaPaymentId > 0) {
    const byId = await findPaymentById(supabase, metaPaymentId);
    if (byId) return byId;
  }
  return findPaymentByCheckoutSessionId(supabase, session.id);
}

/**
 * Idempotent paid-checkout fulfillment shared by Stripe webhooks and success-URL reconcile.
 * Marks payment + shipping request paid, then purchases the label at most once.
 */
export async function fulfillPaidCheckoutSession(
  supabase: SupabaseClient,
  session: Stripe.Checkout.Session,
  options: {
    providerEventId: string;
    eventType: string;
    source: "webhook" | "reconcile";
  }
): Promise<FulfillPaidCheckoutResult> {
  const payment = await resolvePaymentForCheckoutSession(supabase, session);
  if (!payment) {
    return {
      ok: true,
      duplicate: false,
      handled: false,
      paymentId: null,
      shippingRequestId: null,
      message: "No matching payment attempt",
      labelPurchased: false,
    };
  }

  const claim = await claimWebhookEvent(supabase, {
    providerEventId: options.providerEventId,
    eventType: options.eventType,
    paymentId: payment.id,
    organizationId: payment.organization_id,
    propertyId: payment.property_id,
  });
  if (!claim.claimed) {
    // Another worker already claimed this event id — still attempt label if paid.
    if (payment.status === "paid" && payment.shipping_request_id) {
      try {
        const label = await purchaseLabelForPaidShippingRequest(
          supabase,
          payment.shipping_request_id
        );
        return {
          ok: true,
          duplicate: true,
          handled: true,
          paymentId: payment.id,
          shippingRequestId: payment.shipping_request_id,
          message: "Already processed",
          labelPurchased: Boolean(label.ok && !label.skipped),
        };
      } catch {
        // fall through
      }
    }
    return {
      ok: true,
      duplicate: true,
      handled: true,
      paymentId: payment.id,
      shippingRequestId: payment.shipping_request_id,
      message: "Already processed",
      labelPurchased: false,
    };
  }

  if (payment.status === "paid") {
    await updatePaymentStatus(supabase, payment.id, {
      status: "paid",
      appendWebhookEventId: options.providerEventId,
      providerPaymentIntentId: paymentIntentIdFromSession(session),
    });
    let labelPurchased = false;
    if (payment.shipping_request_id) {
      try {
        const label = await purchaseLabelForPaidShippingRequest(
          supabase,
          payment.shipping_request_id
        );
        labelPurchased = Boolean(label.ok && !label.skipped);
      } catch (labelError) {
        console.error(
          "[stripe-fulfill] label purchase failed (already paid)",
          labelError instanceof Error ? labelError.message : "unknown"
        );
      }
    }
    return {
      ok: true,
      duplicate: true,
      handled: true,
      paymentId: payment.id,
      shippingRequestId: payment.shipping_request_id,
      message: "Payment already marked paid",
      labelPurchased,
    };
  }

  if (session.payment_status !== "paid") {
    await updatePaymentStatus(supabase, payment.id, {
      status: "failed",
      failureReason: `Checkout completed with payment_status=${session.payment_status}`,
      appendWebhookEventId: options.providerEventId,
      providerPaymentIntentId: paymentIntentIdFromSession(session),
    });
    await appendShippingTimelineSafe(supabase, payment.shipping_request_id, {
      eventType: SHIPPING_TIMELINE_EVENTS.paymentFailed,
      eventSource: options.source === "webhook" ? "stripe" : "system",
      eventData: {
        notes: "Checkout session completed but payment was not paid",
        sessionRef: redactStripeId(session.id),
        eventRef: redactStripeId(options.providerEventId),
        paymentId: payment.id,
        source: options.source,
      },
    });
    return {
      ok: true,
      duplicate: false,
      handled: true,
      paymentId: payment.id,
      shippingRequestId: payment.shipping_request_id,
      message: "Session not paid",
      labelPurchased: false,
    };
  }

  const sessionAmount = Number(session.amount_total ?? 0);
  const sessionCurrency = String(session.currency || "").toLowerCase();
  if (
    sessionAmount !== payment.amount_cents ||
    sessionCurrency !== payment.currency
  ) {
    await updatePaymentStatus(supabase, payment.id, {
      status: "failed",
      failureReason: "Checkout amount/currency mismatch vs stored payment",
      appendWebhookEventId: options.providerEventId,
      providerPaymentIntentId: paymentIntentIdFromSession(session),
    });
    await appendShippingTimelineSafe(supabase, payment.shipping_request_id, {
      eventType: SHIPPING_TIMELINE_EVENTS.paymentFailed,
      eventSource: options.source === "webhook" ? "stripe" : "system",
      eventData: {
        notes: "Payment amount verification failed — not marked paid",
        sessionRef: redactStripeId(session.id),
        eventRef: redactStripeId(options.providerEventId),
        paymentId: payment.id,
        expectedCents: payment.amount_cents,
        receivedCents: sessionAmount,
        source: options.source,
      },
    });
    return {
      ok: false,
      duplicate: false,
      handled: true,
      paymentId: payment.id,
      shippingRequestId: payment.shipping_request_id,
      message: "Amount mismatch",
      labelPurchased: false,
    };
  }

  const metaRequestId = Number(session.metadata?.oe_shipping_request_id || 0);
  const metaOrgId = Number(session.metadata?.oe_organization_id || 0);
  const metaPropertyId = Number(session.metadata?.oe_property_id || 0);
  const metaLostItemId = Number(session.metadata?.oe_lost_item_id || 0);

  if (
    payment.shipping_request_id &&
    Number.isFinite(metaRequestId) &&
    metaRequestId > 0 &&
    metaRequestId !== payment.shipping_request_id
  ) {
    await updatePaymentStatus(supabase, payment.id, {
      status: "failed",
      failureReason: "Checkout metadata shipping request mismatch",
      appendWebhookEventId: options.providerEventId,
    });
    return {
      ok: false,
      duplicate: false,
      handled: true,
      paymentId: payment.id,
      shippingRequestId: payment.shipping_request_id,
      message: "Shipping request mismatch",
      labelPurchased: false,
    };
  }

  if (
    Number.isFinite(metaOrgId) &&
    metaOrgId > 0 &&
    metaOrgId !== payment.organization_id
  ) {
    await updatePaymentStatus(supabase, payment.id, {
      status: "failed",
      failureReason: "Checkout metadata organization mismatch",
      appendWebhookEventId: options.providerEventId,
    });
    return {
      ok: false,
      duplicate: false,
      handled: true,
      paymentId: payment.id,
      shippingRequestId: payment.shipping_request_id,
      message: "Organization mismatch",
      labelPurchased: false,
    };
  }

  if (
    Number.isFinite(metaPropertyId) &&
    metaPropertyId > 0 &&
    metaPropertyId !== payment.property_id
  ) {
    await updatePaymentStatus(supabase, payment.id, {
      status: "failed",
      failureReason: "Checkout metadata property mismatch",
      appendWebhookEventId: options.providerEventId,
    });
    return {
      ok: false,
      duplicate: false,
      handled: true,
      paymentId: payment.id,
      shippingRequestId: payment.shipping_request_id,
      message: "Property mismatch",
      labelPurchased: false,
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
    appendWebhookEventId: options.providerEventId,
    failureReason: null,
    metadataPatch: receiptUrl
      ? { provider_receipt_url: receiptUrl }
      : undefined,
  });

  let labelPurchased = false;

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
      if (
        Number.isFinite(metaLostItemId) &&
        metaLostItemId > 0 &&
        metaLostItemId !== Number(request.lost_item_id)
      ) {
        await updatePaymentStatus(supabase, payment.id, {
          status: "failed",
          failureReason: "Checkout metadata lost item mismatch",
          appendWebhookEventId: options.providerEventId,
        });
        return {
          ok: false,
          duplicate: false,
          handled: true,
          paymentId: payment.id,
          shippingRequestId: payment.shipping_request_id,
          message: "Lost item mismatch",
          labelPurchased: false,
        };
      }

      if (
        (Number.isFinite(metaOrgId) &&
          metaOrgId > 0 &&
          metaOrgId !== Number(request.organization_id)) ||
        (Number.isFinite(metaPropertyId) &&
          metaPropertyId > 0 &&
          metaPropertyId !== Number(request.property_id))
      ) {
        await updatePaymentStatus(supabase, payment.id, {
          status: "failed",
          failureReason: "Checkout metadata tenant mismatch vs shipping request",
          appendWebhookEventId: options.providerEventId,
        });
        return {
          ok: false,
          duplicate: false,
          handled: true,
          paymentId: payment.id,
          shippingRequestId: payment.shipping_request_id,
          message: "Tenant mismatch vs shipping request",
          labelPurchased: false,
        };
      }

      const alreadyPaid = String(request.payment_status) === "paid";

      if (!alreadyPaid) {
        await supabase
          .from("lost_found_shipping_requests")
          .update({
            payment_status: "paid",
            paid_at: paidAt,
            successful_payment_id: payment.id,
            token_expires_at: laterTokenExpiry(null, new Date(paidAt)),
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
          .eq("id", request.id)
          .eq("organization_id", payment.organization_id)
          .eq("property_id", payment.property_id);
      }

      if (!alreadyPaid) {
        await appendShippingEvent(supabase, {
          organizationId: Number(request.organization_id),
          propertyId: Number(request.property_id),
          lostItemId: Number(request.lost_item_id),
          shippingRequestId: Number(request.id),
          eventType: SHIPPING_TIMELINE_EVENTS.paymentCompleted,
          eventSource: options.source === "webhook" ? "stripe" : "system",
          eventData: {
            notes:
              options.source === "reconcile"
                ? "Payment received (Stripe verified via success-page reconcile)"
                : "Payment received (Stripe verified)",
            sessionRef: redactStripeId(session.id),
            paymentIntentRef: redactStripeId(paymentIntentId),
            eventRef: redactStripeId(options.providerEventId),
            paymentId: payment.id,
            amountCents: payment.amount_cents,
            currency: payment.currency,
            receiptUrl: receiptUrl || null,
            source: options.source,
          },
        });
      }

      try {
        const label = await purchaseLabelForPaidShippingRequest(
          supabase,
          Number(request.id)
        );
        labelPurchased = Boolean(label.ok && !label.skipped);
      } catch (labelError) {
        console.error(
          "[stripe-fulfill] label purchase failed",
          labelError instanceof Error ? labelError.message : "unknown"
        );
      }
    }
  }

  return {
    ok: true,
    duplicate: false,
    handled: true,
    paymentId: payment.id,
    shippingRequestId: payment.shipping_request_id,
    message: "Payment marked paid",
    labelPurchased,
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
