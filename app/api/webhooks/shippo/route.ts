import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import {
  processShippoTrackingWebhook,
  ShippoWebhookVerifyError,
} from "@/app/lib/lost-found-shipping/process-shippo-tracking-webhook";
import { ensureShippoTrackUpdatedWebhook } from "@/app/lib/shipping/shippo-ensure-webhooks";
import { getShippingProviderMode } from "@/app/lib/shipping/env";

export const runtime = "nodejs";

function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

/**
 * GET: ensure Shippo track_updated webhook is registered (idempotent).
 * Safe to hit after deploying env vars; also called automatically after label purchase.
 */
export async function GET() {
  if (getShippingProviderMode() !== "shippo") {
    return NextResponse.json({
      ok: true,
      action: "skipped",
      message: "SHIPPING_PROVIDER is not shippo",
    });
  }
  const result = await ensureShippoTrackUpdatedWebhook();
  return NextResponse.json(result, { status: result.ok ? 200 : 500 });
}

/**
 * Shippo tracking webhook (track_updated).
 * Auth: query ?token=SHIPPO_WEBHOOK_SECRET and/or HMAC Shippo-Auth-Signature.
 * Idempotent via shipping_webhook_receipts. Never trusts browser clients.
 */
export async function POST(request: Request) {
  const rawBody = await request.text();
  const url = new URL(request.url);
  const signature =
    request.headers.get("shippo-auth-signature") ||
    request.headers.get("x-shippo-signature") ||
    request.headers.get("Shippo-Auth-Signature");

  try {
    // Best-effort: keep webhook registration healthy without blocking the event.
    if (getShippingProviderMode() === "shippo") {
      void ensureShippoTrackUpdatedWebhook().catch(() => undefined);
    }

    const supabase = getServiceClient();
    const result = await processShippoTrackingWebhook(
      supabase,
      rawBody,
      url,
      signature
    );
    return NextResponse.json({
      received: true,
      duplicate: result.duplicate,
      handled: result.handled,
      message: result.message,
      shippingRequestId: result.shippingRequestId,
      appliedLostItemStatus: result.appliedLostItemStatus,
    });
  } catch (error: unknown) {
    if (error instanceof ShippoWebhookVerifyError) {
      return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
    }
    const message =
      error instanceof Error ? error.message : "Webhook processing failed";
    const safe = /SHIPPO_|shippo_token|whsec_/i.test(message)
      ? "Webhook processing failed"
      : message;
    return NextResponse.json({ error: safe }, { status: 500 });
  }
}
