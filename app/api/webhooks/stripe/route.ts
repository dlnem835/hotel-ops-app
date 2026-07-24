import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import {
  processStripeWebhookEvent,
  StripeWebhookVerifyError,
} from "@/app/lib/payments/process-stripe-webhook";

export const runtime = "nodejs";

function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

/**
 * Stripe webhook endpoint (test mode for Checkpoint C2).
 * Signature verified with STRIPE_WEBHOOK_SECRET. Never trusts browser redirects.
 */
export async function POST(request: Request) {
  const signature = request.headers.get("stripe-signature");
  const rawBody = await request.text();

  try {
    const supabase = getServiceClient();
    const result = await processStripeWebhookEvent(
      supabase,
      rawBody,
      signature
    );
    return NextResponse.json({
      received: true,
      duplicate: result.duplicate,
      handled: result.handled,
      eventType: result.eventType,
    });
  } catch (error: unknown) {
    if (error instanceof StripeWebhookVerifyError) {
      return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
    }
    const message =
      error instanceof Error ? error.message : "Webhook processing failed";
    // Never echo secrets or full Stripe payloads.
    const safe = /whsec_|sk_test|sk_live|STRIPE_/i.test(message)
      ? "Webhook processing failed"
      : message;
    return NextResponse.json({ error: safe }, { status: 500 });
  }
}
