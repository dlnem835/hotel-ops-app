import { NextResponse } from "next/server";

/**
 * Legacy unauthenticated Stripe/shipping env probe.
 *
 * Disabled: advertised checkout mode, webhook-secret presence, and shipping
 * env gaps. Inbound payments remain POST /api/webhooks/stripe.
 */
export async function GET() {
  return NextResponse.json(
    { error: "This endpoint is no longer available." },
    { status: 410 }
  );
}
