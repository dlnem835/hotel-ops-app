import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import {
  processStripeWebhookEvent,
  StripeWebhookVerifyError,
} from "@/app/lib/payments/process-stripe-webhook";
import { logFulfillment } from "@/app/lib/payments/fulfillment-log";
import { getStripeCheckoutStatus } from "@/app/lib/payments/stripe-env";
import { redactStripeId } from "@/app/lib/payments/types";

export const runtime = "nodejs";

function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

/**
 * Stripe webhook endpoint (test or live — matches STRIPE_SECRET_KEY mode).
 * Signature verified with STRIPE_WEBHOOK_SECRET for that same mode.
 * Never trusts browser redirects.
 */
export async function POST(request: Request) {
  const signature = request.headers.get("stripe-signature");
  const rawBody = await request.text();
  const stripeStatus = getStripeCheckoutStatus();
  const requestId = `wh_${Date.now().toString(36)}`;

  logFulfillment("info", "webhook.received", {
    requestId,
    hasSignature: Boolean(signature),
    bodyBytes: rawBody.length,
    stripeMode: stripeStatus.mode,
    webhookSecretConfigured: Boolean(
      (process.env.STRIPE_WEBHOOK_SECRET || "").trim().startsWith("whsec_")
    ),
  });

  try {
    const supabase = getServiceClient();
    const result = await processStripeWebhookEvent(
      supabase,
      rawBody,
      signature
    );

    logFulfillment("info", "webhook.processed", {
      requestId,
      eventType: result.eventType,
      handled: result.handled,
      duplicate: result.duplicate,
      ok: result.ok,
      paymentId: result.paymentId,
      message: result.message,
      shippingRequestId: result.shippingRequestId ?? null,
      labelPurchased: result.labelPurchased ?? null,
    });

    return NextResponse.json({
      received: true,
      duplicate: result.duplicate,
      handled: result.handled,
      eventType: result.eventType,
      paymentId: result.paymentId,
      shippingRequestId: result.shippingRequestId ?? null,
      labelPurchased: result.labelPurchased ?? false,
    });
  } catch (error: unknown) {
    if (error instanceof StripeWebhookVerifyError) {
      logFulfillment("error", "webhook.signature_failed", {
        requestId,
        reason: error.message,
        hasSignature: Boolean(signature),
        bodyBytes: rawBody.length,
        stripeMode: stripeStatus.mode,
      });
      return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
    }
    const message =
      error instanceof Error ? error.message : "Webhook processing failed";
    const safe = /whsec_|sk_test|sk_live|STRIPE_/i.test(message)
      ? "Webhook processing failed"
      : message;
    logFulfillment("error", "webhook.handler_failed", {
      requestId,
      message: safe,
      stripeMode: stripeStatus.mode,
    });
    return NextResponse.json({ error: safe }, { status: 500 });
  }
}

/** Safe probe — confirms the route is deployed (Stripe uses POST). */
export async function GET() {
  const stripeStatus = getStripeCheckoutStatus();
  return NextResponse.json({
    ok: true,
    endpoint: "/api/webhooks/stripe",
    method: "POST",
    stripeMode: stripeStatus.mode,
    webhookSecretConfigured: Boolean(
      (process.env.STRIPE_WEBHOOK_SECRET || "").trim().startsWith("whsec_")
    ),
    sampleEventRef: redactStripeId("evt_example"),
  });
}
