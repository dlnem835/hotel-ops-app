import "server-only";

import { getShippoClient } from "@/app/lib/shipping/shippo-client";
import { logTrackingSync } from "@/app/lib/lost-found-shipping/tracking-log";

/**
 * Register a tracking number with Shippo so track_updated webhooks fire.
 * Labels purchased via Shippo usually auto-track when a webhook exists;
 * this is an idempotent belt-and-suspenders registration with metadata.
 */
export async function registerShippoTracking(input: {
  trackingNumber: string;
  carrier: string | null | undefined;
  metadata?: string | null;
  shippingRequestId?: number | null;
}): Promise<{ ok: boolean; message: string; carrier: string | null }> {
  const trackingNumber = String(input.trackingNumber || "").trim();
  const carrier = normalizeCarrierSlug(input.carrier);
  if (!trackingNumber) {
    return { ok: false, message: "Missing tracking number", carrier: null };
  }
  if (!carrier) {
    logTrackingSync("warn", "track.register_skipped_no_carrier", {
      shippingRequestId: input.shippingRequestId ?? null,
      trackingNumber,
    });
    return {
      ok: false,
      message: "Carrier slug required to register Shippo tracking",
      carrier: null,
    };
  }

  try {
    const client = getShippoClient();
    const metadata = String(
      input.metadata ||
        (input.shippingRequestId != null
          ? `lf_sr_${input.shippingRequestId}`
          : "")
    ).slice(0, 100);

    await client.trackingStatus.create({
      carrier,
      trackingNumber,
      ...(metadata ? { metadata } : {}),
    });

    logTrackingSync("info", "track.register_ok", {
      shippingRequestId: input.shippingRequestId ?? null,
      trackingNumber,
      carrier,
    });
    return { ok: true, message: "Tracking registered with Shippo", carrier };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Track registration failed";
    // Already-registered / duplicate is fine — treat as success for idempotency.
    if (/already|exist|duplicate/i.test(message)) {
      logTrackingSync("info", "track.register_already", {
        shippingRequestId: input.shippingRequestId ?? null,
        trackingNumber,
        carrier,
        message,
      });
      return { ok: true, message, carrier };
    }
    logTrackingSync("error", "track.register_failed", {
      shippingRequestId: input.shippingRequestId ?? null,
      trackingNumber,
      carrier,
      message,
    });
    return { ok: false, message, carrier };
  }
}

export function normalizeCarrierSlug(
  carrier: string | null | undefined
): string | null {
  if (!carrier) return null;
  const value = carrier.trim().toLowerCase();
  if (!value) return null;
  if (value.includes("usps") || value.includes("united states postal")) {
    return "usps";
  }
  if (value.includes("ups")) return "ups";
  if (value.includes("fedex")) return "fedex";
  if (value.includes("dhl")) return "dhl_express";
  // Already a Shippo slug
  if (/^[a-z0-9_]+$/.test(value)) return value;
  return null;
}
