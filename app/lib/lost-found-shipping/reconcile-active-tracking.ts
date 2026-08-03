import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Track } from "shippo";
import { getShippoClient } from "@/app/lib/shipping/shippo-client";
import { getShippingProviderMode } from "@/app/lib/shipping/env";
import { resolveCarrierSlugForTracking } from "@/app/lib/shipping/register-shippo-tracking";
import {
  applyCarrierTrackingUpdate,
  type ParsedTrackPayload,
} from "@/app/lib/lost-found-shipping/process-shippo-tracking-webhook";
import { resolveShippoTrackingStatus } from "@/app/lib/lost-found-shipping/status";
import { logTrackingSync } from "@/app/lib/lost-found-shipping/tracking-log";
import type { ShippingRequestRow } from "@/app/lib/lost-found-shipping/shipping-requests";

const BATCH_LIMIT = 25;

export type ReconcileTrackingResult = {
  ok: boolean;
  scanned: number;
  updated: number;
  unchanged: number;
  failed: number;
  skipped: number;
  results: Array<{
    shippingRequestId: number;
    trackingNumber: string;
    ok: boolean;
    message: string;
    appliedLostItemStatus: string | null;
  }>;
};

function trackToParsedPayload(
  track: Track,
  fallbackCarrier: string | null
): ParsedTrackPayload | null {
  const trackingNumber = String(track.trackingNumber || "").trim();
  if (!trackingNumber) return null;

  const status = track.trackingStatus;
  const rawStatus = String(status?.status || "UNKNOWN").trim();
  const substatusCode = status?.substatus?.code
    ? String(status.substatus.code)
    : null;
  const substatusText = status?.substatus?.text
    ? String(status.substatus.text)
    : null;
  const statusDate = status?.statusDate
    ? status.statusDate instanceof Date
      ? status.statusDate.toISOString()
      : String(status.statusDate)
    : null;
  const estimatedDelivery = track.eta
    ? track.eta instanceof Date
      ? track.eta.toISOString()
      : String(track.eta)
    : null;

  return {
    trackingNumber,
    carrier: track.carrier
      ? String(track.carrier)
      : fallbackCarrier,
    rawStatus,
    substatusCode,
    substatusText,
    trackingStatus: resolveShippoTrackingStatus(rawStatus, substatusCode),
    statusDetails: status?.statusDetails
      ? String(status.statusDetails)
      : null,
    statusDate,
    trackingUrl: null,
    estimatedDelivery,
    objectId: status?.objectId ? String(status.objectId) : null,
    transactionId: track.transaction ? String(track.transaction) : null,
    eventType: "track_reconcile",
  };
}

/**
 * Poll Shippo for active Ready-to-Ship / in-transit shipments when webhooks
 * may have been missed. Idempotent: reuses applyCarrierTrackingUpdate and
 * never purchases labels.
 */
export async function reconcileActiveShippingTracking(
  supabase: SupabaseClient
): Promise<ReconcileTrackingResult> {
  if (getShippingProviderMode() !== "shippo") {
    return {
      ok: true,
      scanned: 0,
      updated: 0,
      unchanged: 0,
      failed: 0,
      skipped: 0,
      results: [],
    };
  }

  logTrackingSync("info", "reconcile.start", { batchLimit: BATCH_LIMIT });

  const { data: rows, error } = await supabase
    .from("lost_found_shipping_requests")
    .select("*")
    .eq("payment_status", "paid")
    .is("cancelled_at", null)
    .not("tracking_number", "is", null)
    .in("shipment_status", ["label_ready", "in_transit", "exception"])
    .order("updated_at", { ascending: true })
    .limit(BATCH_LIMIT);

  if (error) {
    logTrackingSync("error", "reconcile.query_failed", { message: error.message });
    throw new Error(error.message);
  }

  const client = getShippoClient();
  const results: ReconcileTrackingResult["results"] = [];
  let updated = 0;
  let unchanged = 0;
  let failed = 0;
  let skipped = 0;

  for (const raw of rows || []) {
    const row = raw as ShippingRequestRow;
    const shippingRequestId = Number(row.id);
    const trackingNumber = String(row.tracking_number || "").trim();
    const carrier = resolveCarrierSlugForTracking({
      carrier:
        row.selected_carrier != null ? String(row.selected_carrier) : null,
      trackingNumber,
    });

    if (!trackingNumber || !carrier) {
      skipped += 1;
      results.push({
        shippingRequestId,
        trackingNumber,
        ok: false,
        message: "Missing tracking number or carrier slug",
        appliedLostItemStatus: null,
      });
      continue;
    }

    try {
      const track = await client.trackingStatus.get(trackingNumber, carrier);
      const parsed = trackToParsedPayload(track, carrier);
      if (!parsed) {
        skipped += 1;
        results.push({
          shippingRequestId,
          trackingNumber,
          ok: false,
          message: "Shippo track response missing tracking number",
          appliedLostItemStatus: null,
        });
        continue;
      }

      const previousRaw = row.carrier_tracking_raw
        ? String(row.carrier_tracking_raw)
        : null;
      const previousStatus = row.carrier_tracking_status
        ? String(row.carrier_tracking_status)
        : null;

      if (
        previousRaw === parsed.rawStatus &&
        previousStatus === parsed.trackingStatus &&
        String(row.carrier_tracking_substatus || "") ===
          String(parsed.substatusCode || "")
      ) {
        unchanged += 1;
        logTrackingSync("info", "reconcile.unchanged", {
          shippingRequestId,
          trackingNumber,
          carrier,
          shippoStatus: parsed.rawStatus,
        });
        results.push({
          shippingRequestId,
          trackingNumber,
          ok: true,
          message: "Already up to date",
          appliedLostItemStatus: null,
        });
        continue;
      }

      logTrackingSync("info", "reconcile.polling", {
        shippingRequestId,
        trackingNumber,
        carrier,
        previousShippoStatus: previousRaw,
        newShippoStatus: parsed.rawStatus,
        substatus: parsed.substatusCode,
      });

      const applied = await applyCarrierTrackingUpdate(supabase, row, parsed);
      updated += 1;
      results.push({
        shippingRequestId,
        trackingNumber,
        ok: true,
        message: "Tracking reconciled",
        appliedLostItemStatus: applied.appliedLostItemStatus,
      });
    } catch (err) {
      failed += 1;
      const message = err instanceof Error ? err.message : String(err);
      logTrackingSync("error", "reconcile.row_failed", {
        shippingRequestId,
        trackingNumber,
        carrier,
        message,
      });
      results.push({
        shippingRequestId,
        trackingNumber,
        ok: false,
        message,
        appliedLostItemStatus: null,
      });
    }
  }

  const summary = {
    ok: failed === 0,
    scanned: (rows || []).length,
    updated,
    unchanged,
    failed,
    skipped,
    results,
  };
  logTrackingSync("info", "reconcile.complete", {
    scanned: summary.scanned,
    updated,
    unchanged,
    failed,
    skipped,
  });
  return summary;
}
