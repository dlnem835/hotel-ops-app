import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { getAppBaseUrl } from "@/app/lib/shipping/env";
import { appendShippingEvent } from "@/app/lib/lost-found-shipping/shipping-requests";
import { SHIPPING_TIMELINE_EVENTS } from "@/app/lib/lost-found-shipping/timeline";
import {
  hashShippingGuestToken,
  isTokenExpired,
} from "@/app/lib/lost-found-shipping/token";
import {
  createShippingPaymentAttempt,
  findOpenPaymentForShippingRequest,
  findSuccessfulPaymentForShippingRequest,
  markPaymentCheckoutOpen,
  updatePaymentStatus,
} from "@/app/lib/payments/payment-records";
import { getStripeServerClient } from "@/app/lib/payments/stripe-server";
import { assertStripeCheckoutEnvReady } from "@/app/lib/payments/stripe-env";
import { redactCheckoutSecrets } from "@/app/lib/payments/checkout-error-message";
import { redactStripeId } from "@/app/lib/payments/types";
import Stripe from "stripe";

export class ShippingCheckoutError extends Error {
  status: number;
  code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

function assertCheckoutAppBaseUrl(baseUrl: string): void {
  const isLocalhost = /localhost|127\.0\.0\.1/i.test(baseUrl);
  // Local next dev may use http://localhost. Vercel must not.
  if (isLocalhost) {
    if (process.env.VERCEL) {
      throw new ShippingCheckoutError(
        500,
        "bad_app_url",
        "NEXT_PUBLIC_APP_URL still points to localhost on Vercel. Set it to https://app.oneeyrie.com in Production and redeploy."
      );
    }
    return;
  }
  if (!/^https:\/\//i.test(baseUrl)) {
    throw new ShippingCheckoutError(
      500,
      "bad_app_url",
      "Checkout requires NEXT_PUBLIC_APP_URL to be an https:// origin (set https://app.oneeyrie.com in Vercel and redeploy)."
    );
  }
}

function toShippingCheckoutError(error: unknown): ShippingCheckoutError {
  if (error instanceof ShippingCheckoutError) return error;

  if (error instanceof Stripe.errors.StripeError) {
    const safeMessage = redactCheckoutSecrets(error.message || "Stripe request failed");
    if (error instanceof Stripe.errors.StripeAuthenticationError) {
      return new ShippingCheckoutError(
        502,
        "stripe_auth",
        "Stripe rejected the API key. Confirm STRIPE_SECRET_KEY is a valid sk_test_… or sk_live_… key in Vercel Production and redeploy."
      );
    }
    return new ShippingCheckoutError(
      502,
      error.code || "stripe_error",
      safeMessage || "Unable to start Stripe Checkout. Please try again."
    );
  }

  const raw =
    error instanceof Error ? error.message : "Unable to start secure checkout";
  return new ShippingCheckoutError(
    500,
    "checkout_error",
    redactCheckoutSecrets(raw) || "Unable to start secure checkout. Please try again."
  );
}

/**
 * Create or reuse a Stripe Checkout Session for a guest shipping request.
 * Amount comes only from server-stored total_amount / rate snapshot — never the browser.
 * Stripe session IDs are stored on the payments table (not the shipping request).
 */
export async function createOrReuseShippingCheckoutSession(
  supabase: SupabaseClient,
  rawToken: string
): Promise<{
  checkoutUrl: string;
  sessionId: string;
  paymentId: number;
  reused: boolean;
  alreadyPaid: boolean;
}> {
  try {
    return await createOrReuseShippingCheckoutSessionInner(supabase, rawToken);
  } catch (error) {
    throw toShippingCheckoutError(error);
  }
}

async function createOrReuseShippingCheckoutSessionInner(
  supabase: SupabaseClient,
  rawToken: string
): Promise<{
  checkoutUrl: string;
  sessionId: string;
  paymentId: number;
  reused: boolean;
  alreadyPaid: boolean;
}> {
  try {
    assertStripeCheckoutEnvReady();
  } catch {
    throw new ShippingCheckoutError(
      503,
      "stripe_env",
      "Stripe Checkout env is not ready on this server. Set STRIPE_SECRET_KEY (sk_test_… or sk_live_…) in Vercel Production and redeploy."
    );
  }

  const token = rawToken.trim();
  if (!token || token.length < 20) {
    throw new ShippingCheckoutError(404, "unavailable", "Request unavailable");
  }

  const tokenHash = hashShippingGuestToken(token);
  const { data: row, error } = await supabase
    .from("lost_found_shipping_requests")
    .select("*")
    .eq("secure_token_hash", tokenHash)
    .maybeSingle();

  if (error || !row) {
    throw new ShippingCheckoutError(404, "unavailable", "Request unavailable");
  }
  if (row.cancelled_at) {
    throw new ShippingCheckoutError(410, "unavailable", "Request unavailable");
  }

  const organizationId = Number(row.organization_id);
  const propertyId = Number(row.property_id);
  const lostItemId = Number(row.lost_item_id);
  const requestId = Number(row.id);

  const paymentStatus = String(row.payment_status || "pending");
  if (paymentStatus === "paid" || row.successful_payment_id) {
    const successful =
      (await findSuccessfulPaymentForShippingRequest(supabase, requestId)) ||
      null;
    return {
      checkoutUrl: "",
      sessionId: successful?.provider_checkout_session_id || "",
      paymentId: successful?.id || Number(row.successful_payment_id) || 0,
      reused: false,
      alreadyPaid: true,
    };
  }

  if (
    paymentStatus === "pending" &&
    isTokenExpired(String(row.token_expires_at))
  ) {
    throw new ShippingCheckoutError(410, "expired", "This shipping request has expired.");
  }

  if (String(row.shipment_status) !== "awaiting_payment") {
    throw new ShippingCheckoutError(
      400,
      "not_ready",
      "Confirm your address and select a shipping option before checkout."
    );
  }

  const providerRateId = row.provider_rate_id
    ? String(row.provider_rate_id)
    : "";
  if (!providerRateId) {
    throw new ShippingCheckoutError(
      400,
      "missing_rate",
      "Select a shipping option before continuing to checkout."
    );
  }

  if (row.rate_expires_at && isTokenExpired(String(row.rate_expires_at))) {
    throw new ShippingCheckoutError(
      400,
      "rate_expired",
      "Your shipping rates have expired. Refresh rates and select an option again."
    );
  }

  const snapshot = Array.isArray(row.rate_snapshot_json)
    ? (row.rate_snapshot_json as Array<Record<string, unknown>>)
    : [];
  const selected = snapshot.find(
    (rate) => String(rate.providerRateId) === providerRateId
  );
  if (!selected) {
    throw new ShippingCheckoutError(
      400,
      "missing_rate",
      "Selected shipping rate is no longer available. Refresh rates and try again."
    );
  }

  const snapshotAmount = Number(selected.amount);
  const storedAmount = Number(row.total_amount ?? row.quoted_shipping_amount);
  if (!Number.isFinite(snapshotAmount) || snapshotAmount <= 0) {
    throw new ShippingCheckoutError(400, "invalid_amount", "Invalid shipping amount.");
  }
  if (!Number.isFinite(storedAmount) || storedAmount <= 0) {
    throw new ShippingCheckoutError(400, "invalid_amount", "Invalid shipping amount.");
  }
  if (Math.abs(snapshotAmount - storedAmount) > 0.009) {
    throw new ShippingCheckoutError(
      400,
      "amount_mismatch",
      "Shipping amount could not be verified. Refresh rates and try again."
    );
  }

  // Centralized revenue readiness: fee columns may exist, but V1 charges
  // carrier shipping only. Never add platform/handling/packaging fees yet.
  const feesEnabled = Boolean(row.fees_enabled);
  if (feesEnabled) {
    throw new ShippingCheckoutError(
      503,
      "fees_not_active",
      "Additional fees are not enabled for this release. Contact support."
    );
  }
  const feeCentsTotal =
    Number(row.platform_fee_cents || 0) +
    Number(row.handling_fee_cents || 0) +
    Number(row.packaging_fee_cents || 0);
  if (feeCentsTotal > 0) {
    throw new ShippingCheckoutError(
      503,
      "fees_not_active",
      "Additional fees are not enabled for this release. Contact support."
    );
  }

  const currency = String(row.currency || selected.currency || "usd").toLowerCase();
  if (currency !== "usd") {
    throw new ShippingCheckoutError(
      400,
      "unsupported_currency",
      "Only USD checkout is supported in this release."
    );
  }

  const carrier = String(row.selected_carrier || selected.carrier || "Carrier");
  const service = String(row.selected_service || selected.service || "Service");

  let propertyName = "Hotel";
  const { data: property } = await supabase
    .from("properties")
    .select("name")
    .eq("id", propertyId)
    .eq("organization_id", organizationId)
    .maybeSingle();
  if (property?.name) propertyName = String(property.name);

  const stripe = getStripeServerClient();

  // Reuse an open Checkout Session from the latest open payment attempt.
  const openPayment = await findOpenPaymentForShippingRequest(supabase, requestId);
  if (openPayment?.provider_checkout_session_id) {
    try {
      const existing = await stripe.checkout.sessions.retrieve(
        openPayment.provider_checkout_session_id
      );
      if (existing.status === "open" && existing.url) {
        return {
          checkoutUrl: existing.url,
          sessionId: existing.id,
          paymentId: openPayment.id,
          reused: true,
          alreadyPaid: false,
        };
      }
      if (existing.payment_status === "paid") {
        return {
          checkoutUrl: "",
          sessionId: existing.id,
          paymentId: openPayment.id,
          reused: false,
          alreadyPaid: true,
        };
      }
      // Session closed/expired — mark attempt and continue to a new payment row.
      await updatePaymentStatus(supabase, openPayment.id, {
        status: existing.status === "expired" ? "expired" : "cancelled",
        failureReason:
          existing.status === "expired"
            ? "Checkout session expired before payment"
            : "Checkout session no longer open",
      });
    } catch {
      await updatePaymentStatus(supabase, openPayment.id, {
        status: "expired",
        failureReason: "Checkout session missing or invalid",
      });
    }
  }

  const payment = await createShippingPaymentAttempt(supabase, {
    organizationId,
    propertyId,
    shippingRequestId: requestId,
    amount: storedAmount,
    currency: "usd",
    metadata: {
      oe_flow: "lost_found_shipping",
      oe_shipping_request_id: requestId,
      oe_provider_rate_id: providerRateId,
      oe_carrier: carrier,
      oe_service: service,
    },
  });

  const baseUrl = getAppBaseUrl();
  assertCheckoutAppBaseUrl(baseUrl);
  const successUrl = `${baseUrl}/shipping-request/${encodeURIComponent(
    token
  )}/payment-processing?session_id={CHECKOUT_SESSION_ID}`;
  const cancelUrl = `${baseUrl}/shipping-request/${encodeURIComponent(
    token
  )}/payment-cancelled`;

  const lineName = "Lost Item Return Shipping";
  const lineDescription = `${carrier} ${service} return shipping from ${propertyName}`;
  const amountCents = payment.amount_cents;

  const idempotencyKey = `lf-checkout-payment-${payment.id}`;

  const session = await stripe.checkout.sessions.create(
    {
      mode: "payment",
      success_url: successUrl,
      cancel_url: cancelUrl,
      client_reference_id: `lf_pay_${payment.id}`,
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: "usd",
            unit_amount: amountCents,
            product_data: {
              name: lineName,
              description: lineDescription.slice(0, 500),
            },
          },
        },
      ],
      metadata: {
        oe_flow: "lost_found_shipping",
        oe_payment_id: String(payment.id),
        oe_shipping_request_id: String(requestId),
        oe_organization_id: String(organizationId),
        oe_property_id: String(propertyId),
        oe_lost_item_id: String(lostItemId),
        oe_provider_rate_id: providerRateId,
        oe_amount_cents: String(amountCents),
        oe_currency: "usd",
      },
      payment_intent_data: {
        metadata: {
          oe_flow: "lost_found_shipping",
          oe_payment_id: String(payment.id),
          oe_shipping_request_id: String(requestId),
          oe_organization_id: String(organizationId),
          oe_property_id: String(propertyId),
          oe_lost_item_id: String(lostItemId),
        },
      },
    },
    { idempotencyKey }
  );

  if (!session.url) {
    await updatePaymentStatus(supabase, payment.id, {
      status: "failed",
      failureReason: "Stripe Checkout session missing URL",
    });
    throw new ShippingCheckoutError(
      502,
      "stripe_error",
      "Unable to start secure checkout. Please try again."
    );
  }

  await markPaymentCheckoutOpen(supabase, payment.id, session.id);

  await appendShippingEvent(supabase, {
    organizationId,
    propertyId,
    lostItemId,
    shippingRequestId: requestId,
    eventType: SHIPPING_TIMELINE_EVENTS.paymentStarted,
    eventSource: "guest",
    eventData: {
      notes: "Guest started secure checkout",
      sessionRef: redactStripeId(session.id),
      paymentId: payment.id,
      amountCents,
      currency: "usd",
      carrier,
      service,
    },
  });

  await appendShippingEvent(supabase, {
    organizationId,
    propertyId,
    lostItemId,
    shippingRequestId: requestId,
    eventType: SHIPPING_TIMELINE_EVENTS.checkoutSessionCreated,
    eventSource: "system",
    eventData: {
      notes: "Stripe Checkout session created (test mode)",
      sessionRef: redactStripeId(session.id),
      paymentId: payment.id,
      amountCents,
      currency: "usd",
      reused: false,
    },
  });

  return {
    checkoutUrl: session.url,
    sessionId: session.id,
    paymentId: payment.id,
    reused: false,
    alreadyPaid: false,
  };
}

export async function recordCheckoutCancelled(
  supabase: SupabaseClient,
  rawToken: string
): Promise<void> {
  const token = rawToken.trim();
  if (!token || token.length < 20) return;

  const tokenHash = hashShippingGuestToken(token);
  const { data: row } = await supabase
    .from("lost_found_shipping_requests")
    .select(
      "id, organization_id, property_id, lost_item_id, payment_status, cancelled_at, successful_payment_id"
    )
    .eq("secure_token_hash", tokenHash)
    .maybeSingle();

  if (!row || row.cancelled_at) return;
  if (String(row.payment_status) === "paid") return;

  const requestId = Number(row.id);
  const openPayment = await findOpenPaymentForShippingRequest(supabase, requestId);
  const sessionRef = redactStripeId(openPayment?.provider_checkout_session_id);

  await appendShippingEvent(supabase, {
    organizationId: Number(row.organization_id),
    propertyId: Number(row.property_id),
    lostItemId: Number(row.lost_item_id),
    shippingRequestId: requestId,
    eventType: SHIPPING_TIMELINE_EVENTS.checkoutCancelled,
    eventSource: "guest",
    eventData: {
      notes: "Guest returned from cancelled Stripe Checkout",
      sessionRef,
      paymentId: openPayment?.id ?? null,
    },
  });
}
