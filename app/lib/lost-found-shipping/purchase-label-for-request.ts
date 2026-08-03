import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { getShippingProvider } from "@/app/lib/shipping/get-shipping-provider";
import { getShippingProviderMode } from "@/app/lib/shipping/env";
import { getStripeCheckoutStatus } from "@/app/lib/payments/stripe-env";
import type { ShippingAddress, ShippingPackage } from "@/app/lib/shipping/types";
import {
  appendShippingEvent,
  parseShipFromJson,
  type ShippingRequestRow,
} from "@/app/lib/lost-found-shipping/shipping-requests";
import { markShippingLabelReady } from "@/app/lib/lost-found-shipping/process-shippo-tracking-webhook";
import { SHIPPING_TIMELINE_EVENTS } from "@/app/lib/lost-found-shipping/timeline";
import { ensureShippoTrackUpdatedWebhook } from "@/app/lib/shipping/shippo-ensure-webhooks";
import { logFulfillment } from "@/app/lib/payments/fulfillment-log";
import { redactStripeId } from "@/app/lib/payments/types";

const LOCK_STALE_MS = 2 * 60 * 1000;

function isPlaceholderCarrierOrService(value: string | null | undefined): boolean {
  const trimmed = String(value || "").trim();
  return !trimmed || /^(carrier|service)$/i.test(trimmed);
}

/** Prefer Shippo purchase fields, then selected_* columns, then rate snapshot. */
function resolveCarrierService(
  purchased: { carrier?: string | null; service?: string | null },
  row: ShippingRequestRow,
  providerRateId: string
): { carrier: string; service: string } {
  const snapshot = Array.isArray(row.rate_snapshot_json)
    ? (row.rate_snapshot_json as Array<Record<string, unknown>>)
    : [];
  const fromSnapshot = snapshot.find(
    (rate) => String(rate.providerRateId || "") === providerRateId
  );

  const carrierCandidates = [
    purchased.carrier,
    row.selected_carrier,
    fromSnapshot?.carrier,
  ];
  const serviceCandidates = [
    purchased.service,
    row.selected_service,
    fromSnapshot?.service,
  ];

  const carrier =
    carrierCandidates
      .map((value) => String(value || "").trim())
      .find((value) => !isPlaceholderCarrierOrService(value)) || "";
  const service =
    serviceCandidates
      .map((value) => String(value || "").trim())
      .find((value) => !isPlaceholderCarrierOrService(value)) || "";

  return { carrier, service };
}

function asPackage(row: ShippingRequestRow): ShippingPackage | null {
  const lengthIn = Number(row.length_in);
  const widthIn = Number(row.width_in);
  const heightIn = Number(row.height_in);
  const weightOz = Number(row.weight_oz);
  if (
    ![lengthIn, widthIn, heightIn, weightOz].every((n) => Number.isFinite(n) && n > 0)
  ) {
    return null;
  }
  return { lengthIn, widthIn, heightIn, weightOz };
}

async function uploadLabelPdfIfPossible(
  supabase: SupabaseClient,
  input: {
    organizationId: number;
    propertyId: number;
    shippingRequestId: number;
    labelUrl: string | null | undefined;
  }
): Promise<string | null> {
  if (!input.labelUrl) return null;
  try {
    const response = await fetch(input.labelUrl);
    if (!response.ok) return null;
    const bytes = Buffer.from(await response.arrayBuffer());
    const path = `${input.organizationId}/${input.propertyId}/${input.shippingRequestId}/label.pdf`;
    const { error } = await supabase.storage
      .from("lost-found-shipping-labels")
      .upload(path, bytes, {
        contentType: "application/pdf",
        upsert: true,
      });
    if (error) return null;
    return path;
  } catch {
    return null;
  }
}

/**
 * Purchase a shipping label for a paid request (idempotent).
 * Sets fulfillment/shipment to label_ready, Ready to Ship on the lost item,
 * and ensures the Shippo track_updated webhook is registered.
 */
export async function purchaseLabelForPaidShippingRequest(
  supabase: SupabaseClient,
  shippingRequestId: number
): Promise<{
  ok: boolean;
  skipped: boolean;
  message: string;
  trackingNumber: string | null;
}> {
  const { data, error } = await supabase
    .from("lost_found_shipping_requests")
    .select("*")
    .eq("id", shippingRequestId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) {
    return {
      ok: false,
      skipped: true,
      message: "Shipping request not found",
      trackingNumber: null,
    };
  }

  const row = data as ShippingRequestRow;
  const organizationId = Number(row.organization_id);
  const propertyId = Number(row.property_id);
  const lostItemId = Number(row.lost_item_id);

  logFulfillment("info", "label.purchase_start", {
    shippingRequestId,
    organizationId,
    propertyId,
    lostItemId,
    paymentStatus: row.payment_status,
    fulfillmentStatus: row.fulfillment_status,
    providerRateId: row.provider_rate_id
      ? redactStripeId(String(row.provider_rate_id))
      : null,
  });

  if (String(row.payment_status) !== "paid") {
    logFulfillment("warn", "label.skip_not_paid", { shippingRequestId });
    return {
      ok: false,
      skipped: true,
      message: "Payment not paid yet",
      trackingNumber: null,
    };
  }

  const providerRateId = String(row.provider_rate_id || "").trim();
  const stripeMode = getStripeCheckoutStatus().mode;
  if (stripeMode === "live" && providerRateId.startsWith("mock_")) {
    await markNeedsManualReview(
      supabase,
      row,
      "Live payment used a mock shipping rate. Set SHIPPING_PROVIDER=shippo, refresh rates, and purchase the label from staff tools."
    );
    logFulfillment("error", "label.blocked_live_mock_rate", {
      shippingRequestId,
      providerRateId,
    });
    return {
      ok: false,
      skipped: false,
      message: "Live payment cannot purchase a mock shipping label",
      trackingNumber: null,
    };
  }

  if (
    String(row.fulfillment_status) === "label_ready" &&
    row.tracking_number
  ) {
    await ensureShippoTrackUpdatedWebhook().catch(() => undefined);
    return {
      ok: true,
      skipped: true,
      message: "Label already purchased",
      trackingNumber: String(row.tracking_number),
    };
  }

  if (row.cancelled_at) {
    return {
      ok: false,
      skipped: true,
      message: "Request cancelled",
      trackingNumber: null,
    };
  }

  if (!providerRateId) {
    await markNeedsManualReview(supabase, row, "Missing provider rate id for label purchase");
    return {
      ok: false,
      skipped: false,
      message: "Missing provider rate id",
      trackingNumber: null,
    };
  }

  const shipFrom = parseShipFromJson(row.ship_from_address_json);
  const shipTo = parseShipFromJson(row.recipient_address_json);
  const parcel = asPackage(row);
  if (!shipFrom?.line1 || !shipTo?.line1 || !parcel) {
    await markNeedsManualReview(
      supabase,
      row,
      "Incomplete ship-from, destination, or package for label purchase"
    );
    return {
      ok: false,
      skipped: false,
      message: "Incomplete address or package",
      trackingNumber: null,
    };
  }

  const now = Date.now();
  const lockAt = row.label_purchase_lock_at
    ? new Date(String(row.label_purchase_lock_at)).getTime()
    : 0;
  if (lockAt && now - lockAt < LOCK_STALE_MS) {
    return {
      ok: true,
      skipped: true,
      message: "Label purchase already in progress",
      trackingNumber: row.tracking_number ? String(row.tracking_number) : null,
    };
  }

  const idempotencyKey =
    String(row.label_purchase_idempotency_key || "").trim() ||
    `lf-ship-${shippingRequestId}-pay-${row.successful_payment_id || "paid"}`;

  const { data: locked, error: lockError } = await supabase
    .from("lost_found_shipping_requests")
    .update({
      label_purchase_lock_at: new Date(now).toISOString(),
      label_purchase_idempotency_key: idempotencyKey,
      updated_at: new Date(now).toISOString(),
    })
    .eq("id", shippingRequestId)
    .eq("organization_id", organizationId)
    .eq("property_id", propertyId)
    .eq("payment_status", "paid")
    .neq("fulfillment_status", "label_ready")
    .select("id")
    .maybeSingle();

  if (lockError) throw new Error(lockError.message);
  if (!locked) {
    return {
      ok: true,
      skipped: true,
      message: "Could not acquire label purchase lock (already ready or raced)",
      trackingNumber: null,
    };
  }

  try {
    const provider = getShippingProvider();
    logFulfillment("info", "label.provider_purchase_call", {
      shippingRequestId,
      providerMode: getShippingProviderMode(),
      providerRateId: redactStripeId(providerRateId),
      idempotencyKey: idempotencyKey.slice(0, 80),
    });
    const purchased = await provider.purchaseLabel({
      shipFrom: shipFrom as ShippingAddress,
      shipTo: shipTo as ShippingAddress,
      parcel,
      providerRateId,
      idempotencyKey,
    });

    logFulfillment("info", "label.provider_purchase_ok", {
      shippingRequestId,
      trackingNumber: purchased.trackingNumber,
      carrier: purchased.carrier,
      service: purchased.service,
      providerTransactionId: redactStripeId(purchased.providerTransactionId),
      hasLabelUrl: Boolean(purchased.labelUrl),
    });

    const labelStoragePath = await uploadLabelPdfIfPossible(supabase, {
      organizationId,
      propertyId,
      shippingRequestId,
      labelUrl: purchased.labelUrl,
    });

    logFulfillment("info", "label.storage_result", {
      shippingRequestId,
      labelStoragePath: labelStoragePath || null,
    });

    const resolved = resolveCarrierService(purchased, row, providerRateId);

    await markShippingLabelReady(supabase, {
      shippingRequestId,
      organizationId,
      propertyId,
      lostItemId,
      trackingNumber: purchased.trackingNumber,
      trackingUrl: purchased.trackingUrl,
      labelStoragePath,
      providerTransactionId: purchased.providerTransactionId,
      selectedCarrier: resolved.carrier,
      selectedService: resolved.service,
      eventSource: getShippingProviderMode() === "shippo" ? "shippo" : "system",
    });

    // Seed pre-transit carrier status so guest sees Preparing for Shipment.
    await supabase
      .from("lost_found_shipping_requests")
      .update({
        carrier_tracking_status: "pre_transit",
        carrier_tracking_raw: "PRE_TRANSIT",
        carrier_tracking_updated_at: new Date().toISOString(),
        label_purchase_lock_at: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", shippingRequestId);

    if (getShippingProviderMode() === "shippo") {
      await ensureShippoTrackUpdatedWebhook();
    }

    logFulfillment("info", "label.purchase_complete", {
      shippingRequestId,
      trackingNumber: purchased.trackingNumber,
      lostItemStatus: "Ready to Ship",
    });

    return {
      ok: true,
      skipped: false,
      message: "Label purchased",
      trackingNumber: purchased.trackingNumber,
    };
  } catch (purchaseError) {
    const message =
      purchaseError instanceof Error
        ? purchaseError.message
        : "Label purchase failed";

    logFulfillment("error", "label.purchase_failed", {
      shippingRequestId,
      organizationId,
      propertyId,
      message,
    });

    await supabase
      .from("lost_found_shipping_requests")
      .update({
        // Keep payment_status=paid; leave shipment awaiting label (not awaiting payment).
        fulfillment_status: "needs_manual_review",
        error_message: message.slice(0, 500),
        label_purchase_lock_at: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", shippingRequestId)
      .eq("organization_id", organizationId)
      .eq("property_id", propertyId)
      .eq("payment_status", "paid");

    await appendShippingEvent(supabase, {
      organizationId,
      propertyId,
      lostItemId,
      shippingRequestId,
      eventType: SHIPPING_TIMELINE_EVENTS.labelPurchaseFailed,
      eventSource: "system",
      eventData: { notes: message },
    });

    return {
      ok: false,
      skipped: false,
      message,
      trackingNumber: null,
    };
  }
}

async function markNeedsManualReview(
  supabase: SupabaseClient,
  row: ShippingRequestRow,
  notes: string
) {
  await supabase
    .from("lost_found_shipping_requests")
    .update({
      fulfillment_status: "needs_manual_review",
      error_message: notes.slice(0, 500),
      updated_at: new Date().toISOString(),
    })
    .eq("id", Number(row.id))
    .eq("organization_id", Number(row.organization_id))
    .eq("property_id", Number(row.property_id));

  await appendShippingEvent(supabase, {
    organizationId: Number(row.organization_id),
    propertyId: Number(row.property_id),
    lostItemId: Number(row.lost_item_id),
    shippingRequestId: Number(row.id),
    eventType: SHIPPING_TIMELINE_EVENTS.manualReview,
    eventSource: "system",
    eventData: { notes },
  });
}
