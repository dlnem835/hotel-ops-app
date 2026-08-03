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
  const carrier = resolveCarrierSlugForTracking({
    carrier: input.carrier,
    trackingNumber,
  });
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
  // Reject Shippo/SDK placeholder labels that were stored as selected_carrier.
  if (value === "carrier" || value === "service") return null;
  if (value.includes("usps") || value.includes("united states postal")) {
    return "usps";
  }
  if (value.includes("ups")) return "ups";
  if (value.includes("fedex")) return "fedex";
  if (value.includes("dhl")) return "dhl_express";
  // Already a Shippo slug (but not a placeholder)
  if (/^[a-z0-9_]+$/.test(value)) return value;
  return null;
}

/**
 * Infer a Shippo carrier slug when selected_carrier is missing/placeholder.
 * USPS IMpb tracking is typically a 20–22 digit number starting with 9.
 */
export function inferCarrierFromTrackingNumber(
  trackingNumber: string | null | undefined
): string | null {
  const value = String(trackingNumber || "").trim();
  if (!value) return null;
  if (/^9\d{19,25}$/.test(value)) return "usps";
  if (/^1Z[A-Z0-9]{16}$/i.test(value)) return "ups";
  // FedEx Express often 12 digits; Ground/Economy can vary — keep conservative.
  if (/^\d{12,15}$/.test(value)) return "fedex";
  return null;
}

export function resolveCarrierSlugForTracking(input: {
  carrier?: string | null;
  trackingNumber?: string | null;
}): string | null {
  return (
    normalizeCarrierSlug(input.carrier) ||
    inferCarrierFromTrackingNumber(input.trackingNumber)
  );
}
