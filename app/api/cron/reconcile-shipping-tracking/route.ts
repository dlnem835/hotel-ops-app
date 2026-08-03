import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { reconcileActiveShippingTracking } from "@/app/lib/lost-found-shipping/reconcile-active-tracking";
import { logTrackingSync } from "@/app/lib/lost-found-shipping/tracking-log";
import { getShippingProviderMode } from "@/app/lib/shipping/env";

export const runtime = "nodejs";
export const maxDuration = 60;

function isAuthorizedCronRequest(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const authHeader = request.headers.get("authorization");
  return authHeader === `Bearer ${secret}`;
}

function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

/**
 * Idempotent Shippo tracking reconciliation for paid shipments still
 * Ready to Ship / in transit. Never purchases labels.
 */
export async function GET(request: Request) {
  if (!isAuthorizedCronRequest(request)) {
    logTrackingSync("warn", "reconcile.unauthorized", {});
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (getShippingProviderMode() !== "shippo") {
    return NextResponse.json({
      ok: true,
      skipped: true,
      message: "SHIPPING_PROVIDER is not shippo",
    });
  }

  try {
    const supabase = getServiceClient();
    const result = await reconcileActiveShippingTracking(supabase);
    return NextResponse.json(result);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Tracking reconcile failed";
    logTrackingSync("error", "reconcile.cron_failed", { message });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
