import { NextResponse } from "next/server";

/**
 * Legacy guest prepaid-label upload.
 *
 * Disabled: possession of a numeric lost_items.id was enough to upload a file
 * and change the item status. Current Lost & Found shipping uses the
 * tokenized /shipping-request/[token] flow and does not call this route.
 */
export async function POST() {
  return NextResponse.json(
    {
      error:
        "This upload link is no longer available. Please use the shipping request link from your email.",
    },
    { status: 410 }
  );
}
