import { NextResponse } from "next/server";

/**
 * Legacy staff endpoint that emailed guests a prepaid-label upload link.
 *
 * Disabled: current Lost & Found shipping uses the tokenized
 * /shipping-request/[token] flow. Historical prepaid labels remain
 * reprintable via the staff historical-label API.
 */
export async function POST() {
  return NextResponse.json(
    {
      error:
        "Manual shipping-label email is no longer available. Use Send Shipping Request.",
    },
    { status: 410 }
  );
}
