import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { fulfillPaidCheckoutSession } from "@/app/lib/payments/fulfill-paid-checkout-session";
import { findPaymentByCheckoutSessionId } from "@/app/lib/payments/payment-records";
import { getStripeServerClient } from "@/app/lib/payments/stripe-server";
import { getStripeCheckoutStatus } from "@/app/lib/payments/stripe-env";
import { redactStripeId } from "@/app/lib/payments/types";

function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

/**
 * Recover paid Checkout Sessions when the guest token is unavailable.
 * Requires an existing payments row for the session id, then verifies with Stripe.
 * Optional retryLabel re-quotes Shippo and purchases once (never recharges guest).
 */
export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as {
      sessionId?: string;
      retryLabel?: boolean;
    };
    const sessionId = String(body.sessionId || "").trim();
    const retryLabel = Boolean(body.retryLabel);
    if (!sessionId.startsWith("cs_")) {
      return NextResponse.json(
        { error: "Missing checkout session id.", code: "missing_session" },
        { status: 400 }
      );
    }

    if (!getStripeCheckoutStatus().available) {
      return NextResponse.json(
        { error: "Stripe is not configured on this server.", code: "stripe_env" },
        { status: 503 }
      );
    }

    const supabase = getServiceClient();
    const payment = await findPaymentByCheckoutSessionId(supabase, sessionId);
    if (!payment) {
      return NextResponse.json(
        { error: "Unknown checkout session.", code: "unknown_session" },
        { status: 404 }
      );
    }

    const stripe = getStripeServerClient();
    const session = await stripe.checkout.sessions.retrieve(sessionId);

    if (session.payment_status !== "paid") {
      return NextResponse.json({
        status: "pending",
        paymentStatus: session.payment_status,
        sessionStatus: session.status,
        sessionRef: redactStripeId(sessionId),
        paymentId: payment.id,
      });
    }

    const result = await fulfillPaidCheckoutSession(supabase, session, {
      providerEventId: `reconcile:${session.id}`,
      eventType: "checkout.session.reconcile",
      source: "reconcile",
    });

    let labelRetry: {
      ok: boolean;
      skipped: boolean;
      message: string;
      trackingNumber: string | null;
    } | null = null;

    if (retryLabel && payment.shipping_request_id) {
      const { retryLabelForPaidShippingRequest } = await import(
        "@/app/lib/lost-found-shipping/retry-label-for-paid-request"
      );
      labelRetry = await retryLabelForPaidShippingRequest(
        supabase,
        payment.shipping_request_id,
        { actor: "system" }
      );
    }

    let labelReady = false;
    let paymentStatus = "pending";
    if (payment.shipping_request_id) {
      const { data: req } = await supabase
        .from("lost_found_shipping_requests")
        .select("payment_status,fulfillment_status,tracking_number,error_message")
        .eq("id", payment.shipping_request_id)
        .maybeSingle();
      paymentStatus = String(req?.payment_status || "pending");
      labelReady =
        String(req?.fulfillment_status) === "label_ready" ||
        Boolean(req?.tracking_number);
      return NextResponse.json({
        status: paymentStatus === "paid" ? "paid" : "pending",
        paymentId: result.paymentId,
        shippingRequestId: payment.shipping_request_id,
        labelReady,
        labelPurchased: result.labelPurchased || Boolean(labelRetry?.ok && !labelRetry?.skipped),
        labelRetry,
        fulfillmentStatus: req?.fulfillment_status || null,
        errorMessage: req?.error_message || null,
        message: result.message,
        sessionRef: redactStripeId(sessionId),
        duplicate: result.duplicate,
      });
    }

    return NextResponse.json({
      status: result.ok ? "paid" : "error",
      paymentId: result.paymentId,
      message: result.message,
      sessionRef: redactStripeId(sessionId),
      duplicate: result.duplicate,
    });
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Unable to reconcile checkout";
    const safe = /sk_live|sk_test|whsec_/i.test(message)
      ? "Unable to reconcile checkout"
      : message;
    console.error("[checkout-reconcile-session]", safe);
    return NextResponse.json(
      { error: safe, code: "reconcile_error" },
      { status: 500 }
    );
  }
}
