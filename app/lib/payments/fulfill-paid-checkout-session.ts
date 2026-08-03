import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type Stripe from "stripe";
import {
  appendShippingEvent,
  getStoredGuestShippingUrl,
} from "@/app/lib/lost-found-shipping/shipping-requests";
import { purchaseLabelForPaidShippingRequest } from "@/app/lib/lost-found-shipping/purchase-label-for-request";
import {
  alertLabelCreationFailed,
  sendGuestPaymentConfirmationEmail,
  sendHotelLabelReadyEmail,
} from "@/app/lib/lost-found-shipping/notify-shipping-fulfillment";
import { logFulfillment } from "@/app/lib/payments/fulfillment-log";
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
  logFulfillment("info", "fulfill.start", {
    source: options.source,
    eventType: options.eventType,
    eventRef: redactStripeId(options.providerEventId),
    sessionRef: redactStripeId(session.id),
    paymentStatus: session.payment_status,
    livemode: session.livemode,
  });

  const payment = await resolvePaymentForCheckoutSession(supabase, session);
  if (!payment) {
    logFulfillment("warn", "fulfill.no_payment_match", {
      source: options.source,
      sessionRef: redactStripeId(session.id),
      metaPaymentId: session.metadata?.oe_payment_id || null,
    });
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

  logFulfillment("info", "fulfill.payment_resolved", {
    source: options.source,
    paymentId: payment.id,
    paymentStatus: payment.status,
    organizationId: payment.organization_id,
    propertyId: payment.property_id,
    shippingRequestId: payment.shipping_request_id,
  });

  const claim = await claimWebhookEvent(supabase, {
    providerEventId: options.providerEventId,
    eventType: options.eventType,
    paymentId: payment.id,
    organizationId: payment.organization_id,
    propertyId: payment.property_id,
  });
  if (!claim.claimed) {
    logFulfillment("info", "fulfill.duplicate_event", {
      source: options.source,
      eventRef: redactStripeId(options.providerEventId),
      paymentId: payment.id,
    });
    // Another worker already claimed this event id — still attempt label if paid.
    if (payment.status === "paid" && payment.shipping_request_id) {
      try {
        const label = await purchaseLabelForPaidShippingRequest(
          supabase,
          payment.shipping_request_id
        );
        if (label.ok && !label.skipped) {
          const { data: req } = await supabase
            .from("lost_found_shipping_requests")
            .select("lost_item_id")
            .eq("id", payment.shipping_request_id)
            .maybeSingle();
          await notifyGuestAndStaffAfterPayment(supabase, {
            shippingRequestId: payment.shipping_request_id,
            organizationId: payment.organization_id,
            propertyId: payment.property_id,
            lostItemId: Number(req?.lost_item_id || 0),
            amountCents: payment.amount_cents,
            currency: payment.currency,
            labelPurchased: true,
            labelMessage: label.message,
            newlyPaid: false,
          });
        }
        return {
          ok: true,
          duplicate: true,
          handled: true,
          paymentId: payment.id,
          shippingRequestId: payment.shipping_request_id,
          message: "Already processed",
          labelPurchased: Boolean(label.ok && !label.skipped),
        };
      } catch (labelError) {
        logFulfillment("error", "fulfill.duplicate_label_retry_failed", {
          paymentId: payment.id,
          message:
            labelError instanceof Error ? labelError.message : "unknown",
        });
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

  logFulfillment("info", "fulfill.event_claimed", {
    source: options.source,
    eventRef: redactStripeId(options.providerEventId),
    paymentId: payment.id,
  });

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
        const { data: req } = await supabase
          .from("lost_found_shipping_requests")
          .select("lost_item_id")
          .eq("id", payment.shipping_request_id)
          .maybeSingle();
        await notifyGuestAndStaffAfterPayment(supabase, {
          shippingRequestId: payment.shipping_request_id,
          organizationId: payment.organization_id,
          propertyId: payment.property_id,
          lostItemId: Number(req?.lost_item_id || 0),
          amountCents: payment.amount_cents,
          currency: payment.currency,
          labelPurchased,
          labelMessage: label.message,
          newlyPaid: false,
        });
      } catch (labelError) {
        logFulfillment("error", "fulfill.label_failed_already_paid", {
          paymentId: payment.id,
          message:
            labelError instanceof Error ? labelError.message : "unknown",
        });
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

  logFulfillment("info", "fulfill.marking_paid", {
    source: options.source,
    paymentId: payment.id,
    amountCents: payment.amount_cents,
    shippingRequestId: payment.shipping_request_id,
    paymentIntentRef: redactStripeId(paymentIntentId),
  });

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

  logFulfillment("info", "fulfill.payment_marked_paid", {
    paymentId: payment.id,
    paidAt,
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
        logFulfillment("error", "fulfill.meta_lost_item_mismatch", {
          paymentId: payment.id,
          metaLostItemId,
          requestLostItemId: request.lost_item_id,
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
        logFulfillment("error", "fulfill.meta_tenant_mismatch", {
          paymentId: payment.id,
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
            // Stay on awaiting_payment shipment enum until label_ready, but payment_status drives UI.
            token_expires_at: laterTokenExpiry(null, new Date(paidAt)),
            updated_at: paidAt,
            error_message: null,
          })
          .eq("id", request.id)
          .eq("organization_id", payment.organization_id)
          .eq("property_id", payment.property_id)
          .neq("payment_status", "paid");
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

      logFulfillment("info", "fulfill.label_purchase_start", {
        shippingRequestId: Number(request.id),
        paymentId: payment.id,
        source: options.source,
      });

      try {
        const label = await purchaseLabelForPaidShippingRequest(
          supabase,
          Number(request.id)
        );
        labelPurchased = Boolean(label.ok && !label.skipped);
        logFulfillment(
          labelPurchased ? "info" : "warn",
          "fulfill.label_purchase_result",
          {
            shippingRequestId: Number(request.id),
            ok: label.ok,
            skipped: label.skipped,
            labelPurchased,
            message: label.message,
            trackingNumber: label.trackingNumber,
          }
        );
        await notifyGuestAndStaffAfterPayment(supabase, {
          shippingRequestId: Number(request.id),
          organizationId: payment.organization_id,
          propertyId: payment.property_id,
          lostItemId: Number(request.lost_item_id),
          amountCents: payment.amount_cents,
          currency: payment.currency,
          labelPurchased,
          labelMessage: label.message,
          newlyPaid: !alreadyPaid,
        });
      } catch (labelError) {
        const message =
          labelError instanceof Error ? labelError.message : "unknown";
        logFulfillment("error", "fulfill.label_purchase_exception", {
          shippingRequestId: Number(request.id),
          message,
        });
        await notifyGuestAndStaffAfterPayment(supabase, {
          shippingRequestId: Number(request.id),
          organizationId: payment.organization_id,
          propertyId: payment.property_id,
          lostItemId: Number(request.lost_item_id),
          amountCents: payment.amount_cents,
          currency: payment.currency,
          labelPurchased: false,
          labelMessage: message,
          newlyPaid: !alreadyPaid,
        });
      }
    } else {
      logFulfillment("error", "fulfill.shipping_request_missing", {
        paymentId: payment.id,
        shippingRequestId: payment.shipping_request_id,
      });
    }
  }

  logFulfillment("info", "fulfill.complete", {
    source: options.source,
    paymentId: payment.id,
    shippingRequestId: payment.shipping_request_id,
    labelPurchased,
  });

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

async function notifyGuestAndStaffAfterPayment(
  supabase: SupabaseClient,
  input: {
    shippingRequestId: number;
    organizationId: number;
    propertyId: number;
    lostItemId: number;
    amountCents: number;
    currency: string;
    labelPurchased: boolean;
    labelMessage: string;
    newlyPaid: boolean;
  }
) {
  const { data: row } = await supabase
    .from("lost_found_shipping_requests")
    .select(
      "guest_email,guest_name,item_description_public,tracking_number,tracking_url,selected_carrier,selected_service,fulfillment_status,error_message,total_amount,label_storage_path"
    )
    .eq("id", input.shippingRequestId)
    .maybeSingle();
  if (!row) return;

  let propertyName = "the hotel";
  const { data: property } = await supabase
    .from("properties")
    .select("name")
    .eq("id", input.propertyId)
    .eq("organization_id", input.organizationId)
    .maybeSingle();
  if (property?.name) propertyName = String(property.name);

  const itemName =
    String(row.item_description_public || "").trim() || "your item";
  const amount = Number(input.amountCents) / 100;
  const trackingNumber = row.tracking_number
    ? String(row.tracking_number)
    : null;

  if (input.newlyPaid || input.labelPurchased) {
    logFulfillment("info", "notify.guest_payment_email_start", {
      shippingRequestId: input.shippingRequestId,
      hasTracking: Boolean(trackingNumber),
      labelPurchased: input.labelPurchased,
    });
    // CTA must be the One Eyrie guest tracking page — not the carrier site.
    const guestTrackingUrl = await getStoredGuestShippingUrl(
      supabase,
      input.shippingRequestId
    );
    const carrierRaw = row.selected_carrier
      ? String(row.selected_carrier).trim()
      : "";
    const serviceRaw = row.selected_service
      ? String(row.selected_service).trim()
      : "";
    const emailed = await sendGuestPaymentConfirmationEmail({
      guestEmail: String(row.guest_email || ""),
      guestName: row.guest_name ? String(row.guest_name) : null,
      propertyName,
      itemName,
      amount,
      currency: input.currency,
      guestTrackingUrl,
      trackingNumber,
      carrier:
        carrierRaw && !/^(carrier|service)$/i.test(carrierRaw)
          ? carrierRaw
          : null,
      service:
        serviceRaw && !/^(carrier|service)$/i.test(serviceRaw)
          ? serviceRaw
          : null,
    });
    if (!emailed.ok) {
      logFulfillment("error", "notify.guest_payment_email_failed", {
        shippingRequestId: input.shippingRequestId,
        message: emailed.message,
      });
    } else {
      logFulfillment("info", "notify.guest_payment_email_sent", {
        shippingRequestId: input.shippingRequestId,
        hasTracking: Boolean(trackingNumber),
      });
    }
  }

  if (input.labelPurchased && row.label_storage_path) {
    logFulfillment("info", "notify.hotel_label_email_start", {
      shippingRequestId: input.shippingRequestId,
      lostItemId: input.lostItemId,
    });
    const hotelMail = await sendHotelLabelReadyEmail({
      supabase,
      organizationId: input.organizationId,
      propertyId: input.propertyId,
      lostItemId: input.lostItemId,
      shippingRequestId: input.shippingRequestId,
      propertyName,
      itemName,
      trackingNumber,
      carrier: row.selected_carrier ? String(row.selected_carrier) : null,
      service: row.selected_service ? String(row.selected_service) : null,
      labelStoragePath: String(row.label_storage_path),
    });
    if (!hotelMail.ok) {
      logFulfillment("error", "notify.hotel_label_email_failed", {
        shippingRequestId: input.shippingRequestId,
        message: hotelMail.message,
      });
    } else {
      logFulfillment("info", "notify.hotel_label_email_sent", {
        shippingRequestId: input.shippingRequestId,
      });
    }
  }

  if (
    !input.labelPurchased &&
    String(row.fulfillment_status) === "needs_manual_review"
  ) {
    logFulfillment("warn", "notify.label_failed_alert", {
      shippingRequestId: input.shippingRequestId,
      errorMessage: String(
        row.error_message || input.labelMessage || "Label purchase failed"
      ).slice(0, 240),
    });
    await alertLabelCreationFailed({
      supabase,
      organizationId: input.organizationId,
      propertyId: input.propertyId,
      lostItemId: input.lostItemId,
      shippingRequestId: input.shippingRequestId,
      propertyName,
      itemName,
      guestEmail: row.guest_email ? String(row.guest_email) : null,
      errorMessage:
        String(row.error_message || input.labelMessage || "Label purchase failed").slice(
          0,
          500
        ),
      amount,
    });
  }
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
