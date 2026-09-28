import { NextResponse } from "next/server";

/**
 * Legacy tokenless checkout reconcile.
 *
 * Disabled: a Stripe session id alone could fulfill payment and retry a label
 * with no guest token. Active guest recovery is
 * POST /api/shipping-request/[token]/checkout/reconcile.
 */
export async function POST() {
  return NextResponse.json(
    { error: "This endpoint is no longer available." },
    { status: 410 }
  );
}
