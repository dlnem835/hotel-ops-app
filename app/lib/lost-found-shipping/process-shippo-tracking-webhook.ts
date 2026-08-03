import "server-only";

import { createHash, createHmac, timingSafeEqual } from "crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getShippoWebhookSecret } from "@/app/lib/shipping/env";
import type { TrackingStatus } from "@/app/lib/shipping/types";
import {
  appendShippingEvent,
  type ShippingRequestRow,
} from "@/app/lib/lost-found-shipping/shipping-requests";
import {
  canApplyAutomatedLostItemStatus,
  LOST_ITEM_STATUS,
  resolveShippoTrackingStatus,
  trackingStatusToOperationalLostItemStatus,
  type AutomatedLostItemStatusTarget,
} from "@/app/lib/lost-found-shipping/status";
import { logTrackingSync } from "@/app/lib/lost-found-shipping/tracking-log";
import { SHIPPING_TIMELINE_EVENTS } from "@/app/lib/lost-found-shipping/timeline";
import { laterTokenExpiry } from "@/app/lib/lost-found-shipping/token";
import { normalizeCarrierSlug } from "@/app/lib/shipping/register-shippo-tracking";

export class ShippoWebhookVerifyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ShippoWebhookVerifyError";
  }
}

export type ShippoTrackingWebhookResult = {
  ok: boolean;
  duplicate: boolean;
  handled: boolean;
  message: string;
  shippingRequestId: number | null;
  appliedLostItemStatus: string | null;
};

export type ParsedTrackPayload = {
  trackingNumber: string;
  carrier: string | null;
  rawStatus: string;
  substatusCode: string | null;
  substatusText: string | null;
  trackingStatus: TrackingStatus;
  statusDetails: string | null;
  statusDate: string | null;
  trackingUrl: string | null;
  estimatedDelivery: string | null;
  objectId: string | null;
  /** Shippo transaction object id when present (preferred match key). */
  transactionId: string | null;
  eventType: string;
};

function safeEqualString(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

/**
 * Verify Shippo webhook using supported methods:
 * 1) Query token (?token=) matching SHIPPO_WEBHOOK_SECRET
 * 2) HMAC header Shippo-Auth-Signature / X-Shippo-Signature (t=...,v1=...)
 */
export function verifyShippoWebhookRequest(input: {
  rawBody: string;
  url: URL;
  signatureHeader: string | null;
}): void {
  const secret = getShippoWebhookSecret();
  if (!secret) {
    logTrackingSync("error", "webhook.auth_missing_secret", {});
    throw new ShippoWebhookVerifyError(
      "SHIPPO_WEBHOOK_SECRET is not configured"
    );
  }

  const queryToken =
    input.url.searchParams.get("token") ||
    input.url.searchParams.get("shippo_token");
  if (queryToken && safeEqualString(queryToken, secret)) {
    logTrackingSync("info", "webhook.auth_ok", { method: "query_token" });
    return;
  }

  const sigHeader =
    input.signatureHeader ||
    "";
  if (!sigHeader) {
    logTrackingSync("warn", "webhook.auth_failed", {
      reason: "missing_token_or_signature",
    });
    throw new ShippoWebhookVerifyError(
      "Missing Shippo webhook token or signature"
    );
  }

  // Format: t=<unix>,v1=<hex>
  const parts = Object.fromEntries(
    sigHeader.split(",").map((part) => {
      const [key, ...rest] = part.trim().split("=");
      return [key, rest.join("=")];
    })
  );
  const timestamp = parts.t;
  const signature = parts.v1;
  if (!timestamp || !signature) {
    // Some setups send a bare token in the header
    if (safeEqualString(sigHeader.trim(), secret)) {
      logTrackingSync("info", "webhook.auth_ok", { method: "header_token" });
      return;
    }
    logTrackingSync("warn", "webhook.auth_failed", {
      reason: "invalid_signature_format",
    });
    throw new ShippoWebhookVerifyError("Invalid Shippo signature format");
  }

  const signedPayload = `${timestamp}.${input.rawBody}`;
  const expected = createHmac("sha256", secret)
    .update(signedPayload, "utf8")
    .digest("hex");

  if (!safeEqualString(expected, signature)) {
    logTrackingSync("warn", "webhook.auth_failed", {
      reason: "hmac_mismatch",
    });
    throw new ShippoWebhookVerifyError("Invalid Shippo webhook signature");
  }
  logTrackingSync("info", "webhook.auth_ok", { method: "hmac" });
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return null;
}

function nestedTrackingStatus(
  track: Record<string, unknown>
): Record<string, unknown> | null {
  return (
    asRecord(track.tracking_status) ||
    asRecord(track.trackingStatus) ||
    null
  );
}

export function parseShippoTrackPayload(body: unknown): ParsedTrackPayload | null {
  const root = asRecord(body);
  if (!root) return null;

  const eventType = String(root.event || root.type || "track_updated");
  const data =
    asRecord(root.data) ||
    asRecord(root.result) ||
    root;

  const trackingNumber = String(
    data.tracking_number || data.trackingNumber || ""
  ).trim();
  if (!trackingNumber) return null;

  const statusObj = nestedTrackingStatus(data);
  const rawStatus = String(
    statusObj?.status || data.status || "UNKNOWN"
  ).trim();

  const substatusObj =
    asRecord(statusObj?.substatus) ||
    asRecord(statusObj?.subStatus) ||
    null;
  const substatusCode = substatusObj?.code
    ? String(substatusObj.code)
    : substatusObj?.Code
      ? String(substatusObj.Code)
      : null;
  const substatusText = substatusObj?.text
    ? String(substatusObj.text)
    : substatusObj?.Text
      ? String(substatusObj.Text)
      : null;

  const statusDetails = statusObj?.status_details
    ? String(statusObj.status_details)
    : statusObj?.statusDetails
      ? String(statusObj.statusDetails)
      : null;
  const statusDateRaw =
    statusObj?.status_date ||
    statusObj?.statusDate ||
    null;
  const statusDate = statusDateRaw
    ? statusDateRaw instanceof Date
      ? statusDateRaw.toISOString()
      : String(statusDateRaw)
    : null;

  const eta =
    data.eta ||
    data.estimated_delivery ||
    data.estimatedDelivery ||
    null;
  const estimatedDelivery = eta
    ? eta instanceof Date
      ? eta.toISOString()
      : String(eta)
    : null;

  const transactionId = data.transaction
    ? String(data.transaction)
    : data.transaction_id
      ? String(data.transaction_id)
      : data.transactionId
        ? String(data.transactionId)
        : null;

  return {
    trackingNumber,
    carrier: data.carrier ? String(data.carrier) : null,
    rawStatus,
    substatusCode,
    substatusText,
    trackingStatus: resolveShippoTrackingStatus(rawStatus, substatusCode),
    statusDetails,
    statusDate,
    trackingUrl: data.tracking_url_provider
      ? String(data.tracking_url_provider)
      : data.trackingUrlProvider
        ? String(data.trackingUrlProvider)
        : null,
    estimatedDelivery,
    objectId: data.object_id
      ? String(data.object_id)
      : data.objectId
        ? String(data.objectId)
        : null,
    transactionId,
    eventType,
  };
}

export async function claimShippingWebhookEvent(
  supabase: SupabaseClient,
  input: {
    provider: string;
    providerEventId: string;
    eventType: string;
    shippingRequestId?: number | null;
    organizationId?: number | null;
    propertyId?: number | null;
    payloadHash?: string | null;
  }
): Promise<{ claimed: boolean }> {
  const { error } = await supabase.from("shipping_webhook_receipts").insert({
    provider: input.provider,
    provider_event_id: input.providerEventId,
    event_type: input.eventType,
    shipping_request_id: input.shippingRequestId ?? null,
    organization_id: input.organizationId ?? null,
    property_id: input.propertyId ?? null,
    payload_hash: input.payloadHash ?? null,
  });

  if (!error) return { claimed: true };
  if (
    error.code === "23505" ||
    /duplicate|unique/i.test(error.message || "")
  ) {
    return { claimed: false };
  }
  throw new Error(error.message);
}

function buildProviderEventId(
  parsed: ParsedTrackPayload,
  rawBody: string
): string {
  if (parsed.objectId && parsed.statusDate) {
    return `shippo:${parsed.objectId}:${parsed.rawStatus}:${parsed.statusDate}`;
  }
  const hash = createHash("sha256").update(rawBody).digest("hex").slice(0, 32);
  return `shippo:${parsed.trackingNumber}:${parsed.rawStatus}:${parsed.statusDate || hash}`;
}

function isStaleTrackingEvent(
  lastEventAt: string | null | undefined,
  incomingAt: string | null
): boolean {
  if (!incomingAt || !lastEventAt) return false;
  const last = new Date(lastEventAt).getTime();
  const next = new Date(incomingAt).getTime();
  if (Number.isNaN(last) || Number.isNaN(next)) return false;
  return next < last;
}

/**
 * Resolve the shipping request for a Shippo track event.
 * Prefer provider_transaction_id (unique per label). Tracking number is a
 * fallback only when exactly one non-cancelled row matches — never pick the
 * newest among multiples (cross-property collision risk on a shared Shippo account).
 */
async function resolveShippingRequestForTrack(
  supabase: SupabaseClient,
  parsed: ParsedTrackPayload
): Promise<{
  request: ShippingRequestRow | null;
  ambiguous: boolean;
  matchKey: "provider_transaction_id" | "tracking_number" | null;
}> {
  if (parsed.transactionId) {
    const { data, error } = await supabase
      .from("lost_found_shipping_requests")
      .select("*")
      .eq("provider_transaction_id", parsed.transactionId)
      .is("cancelled_at", null)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (data) {
      return {
        request: data as ShippingRequestRow,
        ambiguous: false,
        matchKey: "provider_transaction_id",
      };
    }
  }

  const { data: rows, error } = await supabase
    .from("lost_found_shipping_requests")
    .select("*")
    .eq("tracking_number", parsed.trackingNumber)
    .is("cancelled_at", null);

  if (error) throw new Error(error.message);
  let matches = (rows || []) as ShippingRequestRow[];
  if (matches.length === 0) {
    return { request: null, ambiguous: false, matchKey: null };
  }

  // When multiple rows share a tracking number, prefer matching carrier.
  if (matches.length > 1 && parsed.carrier) {
    const wanted = normalizeCarrierSlug(parsed.carrier);
    if (wanted) {
      const byCarrier = matches.filter((row) => {
        const rowCarrier = normalizeCarrierSlug(
          row.selected_carrier != null ? String(row.selected_carrier) : null
        );
        return rowCarrier === wanted;
      });
      if (byCarrier.length === 1) {
        return {
          request: byCarrier[0],
          ambiguous: false,
          matchKey: "tracking_number",
        };
      }
      if (byCarrier.length > 1) matches = byCarrier;
    }
  }

  if (matches.length > 1) {
    logTrackingSync("error", "webhook.ambiguous_tracking_match", {
      trackingNumber: parsed.trackingNumber,
      carrier: parsed.carrier,
      requestIds: matches.map((r) => Number(r.id)),
      propertyIds: matches.map((r) => Number(r.property_id)),
      organizationIds: matches.map((r) => Number(r.organization_id)),
    });
    return { request: null, ambiguous: true, matchKey: null };
  }

  return {
    request: matches[0],
    ambiguous: false,
    matchKey: "tracking_number",
  };
}

async function applyLostItemStatusIfAllowed(
  supabase: SupabaseClient,
  row: ShippingRequestRow,
  nextStatus: AutomatedLostItemStatusTarget
): Promise<{ applied: string | null; previous: string | null }> {
  const lostItemId = Number(row.lost_item_id);
  const { data: item, error } = await supabase
    .from("lost_items")
    .select("id, status")
    .eq("id", lostItemId)
    .eq("organization_id", Number(row.organization_id))
    .eq("property_id", Number(row.property_id))
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!item) return { applied: null, previous: null };

  const current = String(item.status || "");
  if (!canApplyAutomatedLostItemStatus(current, nextStatus)) {
    return { applied: null, previous: current };
  }

  const { error: updateError } = await supabase
    .from("lost_items")
    .update({ status: nextStatus })
    .eq("id", lostItemId)
    .eq("organization_id", Number(row.organization_id))
    .eq("property_id", Number(row.property_id));

  if (updateError) throw new Error(updateError.message);
  return { applied: nextStatus, previous: current };
}

/**
 * Apply a Shippo (or compatible) tracking update to a shipping request + lost item.
 * Stores carrier detail separately; upgrades operational status without downgrade.
 */
export async function applyCarrierTrackingUpdate(
  supabase: SupabaseClient,
  row: ShippingRequestRow,
  parsed: ParsedTrackPayload
): Promise<{ appliedLostItemStatus: string | null }> {
  const requestId = Number(row.id);
  const nowIso = new Date().toISOString();
  const previousCarrierStatus = row.carrier_tracking_status
    ? String(row.carrier_tracking_status)
    : null;
  const previousRaw = row.carrier_tracking_raw
    ? String(row.carrier_tracking_raw)
    : null;

  if (
    isStaleTrackingEvent(
      row.last_tracking_event_at ? String(row.last_tracking_event_at) : null,
      parsed.statusDate
    )
  ) {
    logTrackingSync("info", "tracking.update_ignored_stale", {
      shippingRequestId: requestId,
      trackingNumber: parsed.trackingNumber,
      carrier: parsed.carrier,
      previousShippoStatus: previousRaw,
      newShippoStatus: parsed.rawStatus,
      substatus: parsed.substatusCode,
    });
    await appendShippingEvent(supabase, {
      organizationId: Number(row.organization_id),
      propertyId: Number(row.property_id),
      lostItemId: Number(row.lost_item_id),
      shippingRequestId: requestId,
      eventType: SHIPPING_TIMELINE_EVENTS.trackingUpdateIgnoredStale,
      eventSource: "shippo",
      eventData: {
        notes: "Ignored stale tracking webhook (older than last event)",
        rawStatus: parsed.rawStatus,
        substatusCode: parsed.substatusCode,
        statusDate: parsed.statusDate,
        trackingNumber: parsed.trackingNumber,
      },
    });
    return { appliedLostItemStatus: null };
  }

  const isException = parsed.trackingStatus === "exception";
  const isUnknown = parsed.trackingStatus === "unknown";
  const isReturned = parsed.trackingStatus === "returned";

  const shipmentStatusPatch =
    parsed.trackingStatus === "delivered"
      ? "delivered"
      : parsed.trackingStatus === "in_transit" || isReturned
        ? "in_transit"
        : parsed.trackingStatus === "pre_transit"
          ? "label_ready"
          : isException
            ? "exception"
            : null;

  const patch: Record<string, unknown> = {
    carrier_tracking_status: parsed.trackingStatus,
    carrier_tracking_raw: parsed.rawStatus,
    carrier_tracking_substatus: parsed.substatusCode,
    carrier_tracking_updated_at: nowIso,
    last_tracking_event_at: parsed.statusDate || nowIso,
    updated_at: nowIso,
  };

  if (parsed.trackingUrl && !row.tracking_url) {
    patch.tracking_url = parsed.trackingUrl;
  }
  if (parsed.estimatedDelivery) {
    patch.estimated_delivery_at = parsed.estimatedDelivery;
  }
  // Backfill real carrier when DB still has Shippo placeholder "Carrier".
  if (parsed.carrier) {
    const incoming = String(parsed.carrier).trim();
    const current = row.selected_carrier
      ? String(row.selected_carrier).trim()
      : "";
    if (
      incoming &&
      !/^(carrier|service)$/i.test(incoming) &&
      (!current || /^(carrier|service)$/i.test(current))
    ) {
      patch.selected_carrier = incoming;
    }
  }
  if (shipmentStatusPatch) {
    // Never downgrade shipment_status from delivered / in_transit via delayed pre_transit
    const currentShipment = String(row.shipment_status || "");
    const shipmentRank: Record<string, number> = {
      awaiting_guest: 1,
      awaiting_payment: 2,
      label_ready: 3,
      exception: 3,
      in_transit: 4,
      delivered: 5,
      cancelled: 0,
    };
    const currentRank = shipmentRank[currentShipment] ?? 0;
    const nextRank = shipmentRank[shipmentStatusPatch] ?? 0;
    if (nextRank >= currentRank && currentShipment !== "cancelled") {
      patch.shipment_status = shipmentStatusPatch;
    }
  }

  if (parsed.trackingStatus === "in_transit" || isReturned) {
    if (!row.shipped_at) patch.shipped_at = parsed.statusDate || nowIso;
  }
  if (parsed.trackingStatus === "delivered") {
    patch.delivered_at = parsed.statusDate || nowIso;
    patch.shipping_exception_code = null;
    patch.shipping_exception_message = null;
    patch.shipping_exception_at = null;
    patch.returned_to_sender = false;
  }

  if (isReturned) {
    patch.returned_to_sender = true;
    patch.shipping_exception_code = "returned_to_sender";
    patch.shipping_exception_message =
      parsed.statusDetails ||
      parsed.substatusText ||
      "Carrier reported returned to sender";
    patch.shipping_exception_at = parsed.statusDate || nowIso;
  } else if (isException) {
    patch.shipping_exception_code = "carrier_exception";
    patch.shipping_exception_message =
      parsed.statusDetails ||
      parsed.substatusText ||
      `Carrier status: ${parsed.rawStatus}`;
    patch.shipping_exception_at = parsed.statusDate || nowIso;
  }

  const { error: updateError } = await supabase
    .from("lost_found_shipping_requests")
    .update(patch)
    .eq("id", requestId)
    .eq("organization_id", Number(row.organization_id))
    .eq("property_id", Number(row.property_id));

  if (updateError) {
    logTrackingSync("error", "tracking.db_update_failed", {
      shippingRequestId: requestId,
      trackingNumber: parsed.trackingNumber,
      message: updateError.message,
    });
    throw new Error(updateError.message);
  }

  logTrackingSync("info", "tracking.db_update_ok", {
    shippingRequestId: requestId,
    trackingNumber: parsed.trackingNumber,
    carrier: parsed.carrier,
    previousShippoStatus: previousRaw,
    newShippoStatus: parsed.rawStatus,
    previousCarrierStatus,
    newCarrierStatus: parsed.trackingStatus,
    substatus: parsed.substatusCode,
    shipmentStatusPatch,
    isUnknown,
  });

  let timelineEvent: string = SHIPPING_TIMELINE_EVENTS.trackingUpdateReceived;
  if (parsed.trackingStatus === "delivered") {
    timelineEvent = SHIPPING_TIMELINE_EVENTS.packageDelivered;
  } else if (parsed.trackingStatus === "in_transit") {
    timelineEvent = SHIPPING_TIMELINE_EVENTS.packageShipped;
  } else if (isReturned) {
    timelineEvent = SHIPPING_TIMELINE_EVENTS.returnedToSender;
  } else if (isException) {
    timelineEvent = SHIPPING_TIMELINE_EVENTS.shippingException;
  }

  await appendShippingEvent(supabase, {
    organizationId: Number(row.organization_id),
    propertyId: Number(row.property_id),
    lostItemId: Number(row.lost_item_id),
    shippingRequestId: requestId,
    eventType: timelineEvent,
    eventSource: "shippo",
    eventData: {
      notes:
        parsed.statusDetails ||
        parsed.substatusText ||
        `Carrier status: ${parsed.rawStatus}`,
      trackingNumber: parsed.trackingNumber,
      carrier: parsed.carrier,
      rawStatus: parsed.rawStatus,
      substatusCode: parsed.substatusCode,
      substatusText: parsed.substatusText,
      trackingStatus: parsed.trackingStatus,
      statusDate: parsed.statusDate,
      returnedToSender: isReturned,
      exception: isException || isReturned,
      organizationId: Number(row.organization_id),
      propertyId: Number(row.property_id),
      providerTransactionId: parsed.transactionId,
    },
  });

  let proposed = trackingStatusToOperationalLostItemStatus(
    parsed.trackingStatus
  );
  // Exceptions / unknown: keep current operational status; flag exception only.
  if (isException || isUnknown) {
    proposed = null;
  }
  if (isReturned) {
    proposed = LOST_ITEM_STATUS.shipped;
  }

  let applied: string | null = null;
  let previousLostItemStatus: string | null = null;
  if (proposed) {
    const result = await applyLostItemStatusIfAllowed(supabase, row, proposed);
    applied = result.applied;
    previousLostItemStatus = result.previous;
  } else {
    const { data: item } = await supabase
      .from("lost_items")
      .select("status")
      .eq("id", Number(row.lost_item_id))
      .maybeSingle();
    previousLostItemStatus = item?.status ? String(item.status) : null;
  }

  logTrackingSync("info", "tracking.lost_item_status", {
    shippingRequestId: requestId,
    trackingNumber: parsed.trackingNumber,
    previousLostItemStatus,
    newLostItemStatus: applied,
    proposed,
  });

  return { appliedLostItemStatus: applied };
}

export async function processShippoTrackingWebhook(
  supabase: SupabaseClient,
  rawBody: string,
  requestUrl: URL,
  signatureHeader: string | null
): Promise<ShippoTrackingWebhookResult> {
  logTrackingSync("info", "webhook.received", {
    bodyBytes: rawBody.length,
    hasSignature: Boolean(signatureHeader),
  });

  verifyShippoWebhookRequest({
    rawBody,
    url: requestUrl,
    signatureHeader,
  });

  let body: unknown;
  try {
    body = JSON.parse(rawBody);
  } catch {
    logTrackingSync("error", "webhook.invalid_json", {});
    throw new ShippoWebhookVerifyError("Invalid JSON body");
  }

  const parsed = parseShippoTrackPayload(body);
  if (!parsed) {
    logTrackingSync("warn", "webhook.no_tracking_payload", {});
    return {
      ok: true,
      duplicate: false,
      handled: false,
      message: "No tracking payload to process",
      shippingRequestId: null,
      appliedLostItemStatus: null,
    };
  }

  logTrackingSync("info", "webhook.parsed", {
    trackingNumber: parsed.trackingNumber,
    carrier: parsed.carrier,
    newShippoStatus: parsed.rawStatus,
    substatus: parsed.substatusCode,
    trackingStatus: parsed.trackingStatus,
    transactionId: parsed.transactionId,
  });

  const resolved = await resolveShippingRequestForTrack(supabase, parsed);
  if (resolved.ambiguous) {
    logTrackingSync("error", "webhook.unmatched_ambiguous", {
      trackingNumber: parsed.trackingNumber,
      carrier: parsed.carrier,
    });
    return {
      ok: true,
      duplicate: false,
      handled: false,
      message: `Ambiguous tracking match for ${parsed.trackingNumber}; refusing update`,
      shippingRequestId: null,
      appliedLostItemStatus: null,
    };
  }
  if (!resolved.request) {
    logTrackingSync("warn", "webhook.unmatched", {
      trackingNumber: parsed.trackingNumber,
      carrier: parsed.carrier,
      transactionId: parsed.transactionId,
    });
    return {
      ok: true,
      duplicate: false,
      handled: false,
      message: `No shipping request for tracking ${parsed.trackingNumber}`,
      shippingRequestId: null,
      appliedLostItemStatus: null,
    };
  }

  const row = resolved.request;
  logTrackingSync("info", "webhook.request_matched", {
    shippingRequestId: Number(row.id),
    matchKey: resolved.matchKey,
    trackingNumber: parsed.trackingNumber,
    carrier: parsed.carrier,
    previousShippoStatus: row.carrier_tracking_raw
      ? String(row.carrier_tracking_raw)
      : null,
    newShippoStatus: parsed.rawStatus,
  });

  const providerEventId = buildProviderEventId(parsed, rawBody);
  const payloadHash = createHash("sha256").update(rawBody).digest("hex");
  const claim = await claimShippingWebhookEvent(supabase, {
    provider: "shippo",
    providerEventId,
    eventType: parsed.eventType,
    shippingRequestId: Number(row.id),
    organizationId: Number(row.organization_id),
    propertyId: Number(row.property_id),
    payloadHash,
  });

  if (!claim.claimed) {
    logTrackingSync("info", "webhook.duplicate", {
      shippingRequestId: Number(row.id),
      trackingNumber: parsed.trackingNumber,
      providerEventId,
    });
    return {
      ok: true,
      duplicate: true,
      handled: false,
      message: "Duplicate webhook event",
      shippingRequestId: Number(row.id),
      appliedLostItemStatus: null,
    };
  }

  const result = await applyCarrierTrackingUpdate(supabase, row, parsed);

  logTrackingSync("info", "webhook.handled", {
    shippingRequestId: Number(row.id),
    trackingNumber: parsed.trackingNumber,
    carrier: parsed.carrier,
    newShippoStatus: parsed.rawStatus,
    newLostItemStatus: result.appliedLostItemStatus,
    matchKey: resolved.matchKey,
  });

  return {
    ok: true,
    duplicate: false,
    handled: true,
    message: `Tracking update applied (matched by ${resolved.matchKey})`,
    shippingRequestId: Number(row.id),
    appliedLostItemStatus: result.appliedLostItemStatus,
  };
}

/**
 * When a shipping label is successfully purchased / attached, set Ready to Ship
 * on the lost item (if allowed) and mirror fulfillment/shipment fields.
 */
export async function markShippingLabelReady(
  supabase: SupabaseClient,
  input: {
    shippingRequestId: number;
    organizationId: number;
    propertyId: number;
    lostItemId: number;
    trackingNumber?: string | null;
    trackingUrl?: string | null;
    labelStoragePath?: string | null;
    providerTransactionId?: string | null;
    selectedCarrier?: string | null;
    selectedService?: string | null;
    eventSource?: string;
  }
): Promise<{ appliedLostItemStatus: string | null }> {
  const nowIso = new Date().toISOString();
  const patch: Record<string, unknown> = {
    fulfillment_status: "label_ready",
    shipment_status: "label_ready",
    label_created_at: nowIso,
    // Keep the original guest URL usable as a tracking page.
    token_expires_at: laterTokenExpiry(null, new Date(nowIso)),
    updated_at: nowIso,
  };
  if (input.trackingNumber) patch.tracking_number = input.trackingNumber;
  if (input.trackingUrl) patch.tracking_url = input.trackingUrl;
  if (input.labelStoragePath) patch.label_storage_path = input.labelStoragePath;
  if (input.providerTransactionId) {
    patch.provider_transaction_id = input.providerTransactionId;
  }
  if (input.selectedCarrier) patch.selected_carrier = input.selectedCarrier;
  if (input.selectedService) patch.selected_service = input.selectedService;

  const { data: row, error } = await supabase
    .from("lost_found_shipping_requests")
    .update(patch)
    .eq("id", input.shippingRequestId)
    .eq("organization_id", input.organizationId)
    .eq("property_id", input.propertyId)
    .select("*")
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!row) return { appliedLostItemStatus: null };

  await appendShippingEvent(supabase, {
    organizationId: input.organizationId,
    propertyId: input.propertyId,
    lostItemId: input.lostItemId,
    shippingRequestId: input.shippingRequestId,
    eventType: SHIPPING_TIMELINE_EVENTS.labelPurchased,
    eventSource: input.eventSource || "system",
    eventData: {
      notes: "Shipping label ready",
      trackingNumber: input.trackingNumber || null,
    },
  });

  if (input.trackingNumber) {
    await appendShippingEvent(supabase, {
      organizationId: input.organizationId,
      propertyId: input.propertyId,
      lostItemId: input.lostItemId,
      shippingRequestId: input.shippingRequestId,
      eventType: SHIPPING_TIMELINE_EVENTS.trackingAssigned,
      eventSource: input.eventSource || "system",
      eventData: { trackingNumber: input.trackingNumber },
    });
  }

  const applied = await applyLostItemStatusIfAllowed(
    supabase,
    row as ShippingRequestRow,
    LOST_ITEM_STATUS.readyToShip
  );

  return { appliedLostItemStatus: applied.applied };
}
