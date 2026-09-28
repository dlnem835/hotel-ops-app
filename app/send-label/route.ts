import { NextResponse } from "next/server";

/**
 * Legacy unauthenticated outbound-mail sender.
 *
 * Disabled: POST /send-label accepted a client-supplied recipient and item
 * body with no auth. No active workflow calls this route. Current Lost & Found
 * shipping uses /api/lost-and-found/[id]/guest-shipping.
 */
export async function POST() {
  return NextResponse.json(
    {
      error: "This endpoint is no longer available.",
    },
    { status: 410 }
  );
}
