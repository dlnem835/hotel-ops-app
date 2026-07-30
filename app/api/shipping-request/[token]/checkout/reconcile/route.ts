import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { fulfillPaidCheckoutSession } from "@/app/lib/payments/fulfill-paid-checkout-session";
import {
  findPaymentByCheckoutSessionId,
} from "@/app/lib/payments/payment-records";
import { getStripeServerClient } from "@/app/lib/payments/stripe-server";
import { getStripeCheckoutStatus } from "@/app/lib/payments/stripe-env";
import {
  hashShippingGuestToken,
} from "@/app/lib/lost-found-shipping/token";
import { redactStripeId } from "@/app/lib/payments/types";

type RouteContext = { params: Promise<{ token: string }> };

function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

/**
 * Success-URL backup: verify Checkout Session with Stripe API and fulfill paid state.
 * Idempotent with webhooks — never trusts the browser alone.
 */
export async function POST(request: Request, context: RouteContext) {
  try {
    const { token } = await context.params;
    const body = (await request.json().catch(() => ({}))) as {
      sessionId?: string;
    };
    const sessionId = String(body.sessionId || "").trim();
    if (!sessionId.startsWith("cs_")) {
      return NextResponse.json(
        { error: "Missing checkout session id.", code: "missing_session" },
        { status: 400 }
      );
    }

    const tokenHash = hashShippingGuestToken(String(token || "").trim());
    const supabase = getServiceClient();

    const { data: row } = await supabase
      .from("lost_found_shipping_requests")
      .select("id, organization_id, property_id, payment_status, fulfillment_status, tracking_number")
      .eq("secure_token_hash", tokenHash)
      .maybeSingle();

    if (!row) {
      return NextResponse.json(
        { error: "Request unavailable", code: "unavailable" },
        { status: 404 }
      );
    }

    const payment = await findPaymentByCheckoutSessionId(supabase, sessionId);
    if (!payment || payment.shipping_request_id !== Number(row.id)) {
      return NextResponse.json(
        {
          error: "Checkout session does not match this shipping request.",
          code: "session_mismatch",
        },
        { status: 404 }
      );
    }

    if (
      payment.status === "paid" &&
      String(row.payment_status) === "paid"
    ) {
      return NextResponse.json({
        status: "paid",
        paymentId: payment.id,
        labelReady:
          String(row.fulfillment_status) === "label_ready" ||
          Boolean(row.tracking_number),
        sessionRef: redactStripeId(sessionId),
        reconciled: false,
        duplicate: true,
      });
    }

    const stripeStatus = getStripeCheckoutStatus();
    if (!stripeStatus.available) {
      return NextResponse.json(
        {
          error: "Stripe is not configured on this server.",
          code: "stripe_env",
        },
        { status: 503 }
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
      });
    }

    const result = await fulfillPaidCheckoutSession(supabase, session, {
      providerEventId: `reconcile:${session.id}`,
      eventType: "checkout.session.reconcile",
      source: "reconcile",
    });

    const { data: refreshed } = await supabase
      .from("lost_found_shipping_requests")
      .select("payment_status, fulfillment_status, tracking_number")
      .eq("id", Number(row.id))
      .maybeSingle();

    return NextResponse.json({
      status:
        String(refreshed?.payment_status) === "paid" ? "paid" : "pending",
      paymentId: result.paymentId,
      labelReady:
        String(refreshed?.fulfillment_status) === "label_ready" ||
        Boolean(refreshed?.tracking_number),
      labelPurchased: result.labelPurchased,
      message: result.message,
      sessionRef: redactStripeId(sessionId),
      reconciled: true,
      duplicate: result.duplicate,
    });
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Unable to reconcile checkout";
    const safe = /sk_live|sk_test|whsec_/i.test(message)
      ? "Unable to reconcile checkout"
      : message;
    console.error("[checkout-reconcile]", safe);
    return NextResponse.json(
      { error: safe, code: "reconcile_error" },
      { status: 500 }
    );
  }
}
