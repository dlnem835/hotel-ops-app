import type { SupabaseClient } from "@supabase/supabase-js";
import { resolveAppUrl } from "@/app/lib/email/auth-email-config";
import { getShippingProviderMode } from "@/app/lib/shipping/env";
import {
  getPackagePreset,
  isPackagePresetKey,
} from "@/app/lib/shipping/package-presets";
import type { ShippingAddress } from "@/app/lib/shipping/types";
import { TenantRequestError } from "@/app/lib/tenant/server/resolve-tenant-request";
import { assertLostItemInTenant } from "@/app/lost-and-found/lib/lost-found-server-db";
import {
  centsToAmount,
  redactStripeId,
} from "@/app/lib/payments/types";
import { findPaymentById } from "@/app/lib/payments/payment-records";
import {
  fetchPropertyShippingSettings,
  isShippingSettingsReady,
  resolveShipFromForProperty,
} from "./property-shipping-settings";
import { LOST_ITEM_STATUS } from "./status";
import { SHIPPING_TIMELINE_EVENTS } from "./timeline";
import { isGenericCarrierLabel } from "./carrier-display";
import {
  generateShippingGuestToken,
  hashShippingGuestToken,
  tokenExpiresAt,
} from "./token";

function storedCarrierLabel(value: unknown): string | null {
  if (value == null) return null;
  const text = String(value).trim();
  if (isGenericCarrierLabel(text)) return null;
  return text;
}

export type LostFoundShippingScope = {
  organizationId: number;
  propertyId: number;
};

export type CreateShippingRequestInput = {
  lostItemId: number;
  guestName: string;
  guestEmail: string;
  guestPhone?: string;
  itemDescriptionPublic: string;
  internalNotes?: string;
  packagePreset: string;
  weightOz: number;
  lengthIn: number;
  widthIn: number;
  heightIn: number;
  createdBy: string;
};

export type ShippingRequestRow = Record<string, unknown>;

export async function appendShippingEvent(
  supabase: SupabaseClient,
  input: {
    organizationId: number;
    propertyId: number;
    lostItemId: number;
    shippingRequestId: number | string;
    eventType: string;
    eventSource?: string;
    eventData?: Record<string, unknown>;
    createdBy?: string | null;
  }
) {
  const { error } = await supabase.from("lost_found_shipping_events").insert({
    organization_id: input.organizationId,
    property_id: input.propertyId,
    lost_item_id: input.lostItemId,
    shipping_request_id: input.shippingRequestId,
    event_type: input.eventType,
    event_source: input.eventSource || "system",
    event_data: input.eventData || {},
    created_by: input.createdBy || null,
  });
  if (error) throw new Error(error.message);
}

export type ShippingTimelineEntry = {
  id: number;
  eventType: string;
  eventSource: string;
  eventData: Record<string, unknown>;
  createdAt: string;
  createdBy: string | null;
  actorLabel: string;
};

export async function listShippingTimelineForRequest(
  supabase: SupabaseClient,
  scope: LostFoundShippingScope,
  shippingRequestId: number
): Promise<ShippingTimelineEntry[]> {
  const { data, error } = await supabase
    .from("lost_found_shipping_events")
    .select("id, event_type, event_source, event_data, created_at, created_by")
    .eq("organization_id", scope.organizationId)
    .eq("property_id", scope.propertyId)
    .eq("shipping_request_id", shippingRequestId)
    .order("created_at", { ascending: true });

  if (error) throw new Error(error.message);

  return (data || []).map((row) => {
    const source = String(row.event_source || "system");
    const createdBy = row.created_by ? String(row.created_by) : null;
    let actorLabel = "System";
    if (source === "staff") {
      actorLabel = "Staff";
    } else if (source === "guest") {
      actorLabel = "Guest";
    } else if (source === "stripe") {
      actorLabel = "Stripe";
    } else if (source === "shippo") {
      actorLabel = "Shippo";
    } else if (source === "carrier") {
      actorLabel = "Carrier";
    } else if (source === "system") {
      actorLabel = "System";
    }
    return {
      id: Number(row.id),
      eventType: String(row.event_type || ""),
      eventSource: source,
      eventData:
        row.event_data && typeof row.event_data === "object"
          ? (row.event_data as Record<string, unknown>)
          : {},
      createdAt: String(row.created_at),
      createdBy,
      actorLabel,
    };
  });
}

/** Append guest_opened at most once per request. */
export async function recordGuestOpenedIfNeeded(
  supabase: SupabaseClient,
  row: ShippingRequestRow
): Promise<void> {
  const requestId = Number(row.id);
  const { data: existing } = await supabase
    .from("lost_found_shipping_events")
    .select("id")
    .eq("shipping_request_id", requestId)
    .eq("event_type", SHIPPING_TIMELINE_EVENTS.guestOpened)
    .limit(1)
    .maybeSingle();

  if (existing) return;

  await appendShippingEvent(supabase, {
    organizationId: Number(row.organization_id),
    propertyId: Number(row.property_id),
    lostItemId: Number(row.lost_item_id),
    shippingRequestId: requestId,
    eventType: SHIPPING_TIMELINE_EVENTS.guestOpened,
    eventSource: "guest",
    eventData: { notes: "Guest opened the secure shipping link" },
  });
}

export function toStaffShippingRequestView(row: ShippingRequestRow) {
  const recipient = parseShipFromJson(row.recipient_address_json);
  return {
    id: Number(row.id),
    lostItemId: Number(row.lost_item_id),
    guestName: String(row.guest_name || ""),
    guestEmail: String(row.guest_email || ""),
    guestPhone: String(row.guest_phone || ""),
    itemDescriptionPublic: String(row.item_description_public || ""),
    packagePreset: String(row.package_preset || ""),
    weightOz: row.weight_oz == null ? null : Number(row.weight_oz),
    lengthIn: row.length_in == null ? null : Number(row.length_in),
    widthIn: row.width_in == null ? null : Number(row.width_in),
    heightIn: row.height_in == null ? null : Number(row.height_in),
    paymentStatus: String(row.payment_status || "pending"),
    fulfillmentStatus: String(row.fulfillment_status || "pending"),
    shipmentStatus: String(row.shipment_status || "awaiting_guest"),
    providerRateId: row.provider_rate_id ? String(row.provider_rate_id) : null,
    selectedCarrier: storedCarrierLabel(row.selected_carrier),
    selectedService: storedCarrierLabel(row.selected_service),
    totalAmount: row.total_amount == null ? null : Number(row.total_amount),
    currency: String(row.currency || "usd"),
    destinationCity: recipient?.city || null,
    destinationState: recipient?.state || null,
    trackingNumber: row.tracking_number ? String(row.tracking_number) : null,
    trackingUrl: row.tracking_url ? String(row.tracking_url) : null,
    carrierTrackingStatus: row.carrier_tracking_status
      ? String(row.carrier_tracking_status)
      : null,
    carrierTrackingRaw: row.carrier_tracking_raw
      ? String(row.carrier_tracking_raw)
      : null,
    shippingExceptionCode: row.shipping_exception_code
      ? String(row.shipping_exception_code)
      : null,
    shippingExceptionMessage: row.shipping_exception_message
      ? String(row.shipping_exception_message)
      : null,
    shippingExceptionAt: row.shipping_exception_at
      ? String(row.shipping_exception_at)
      : null,
    returnedToSender: Boolean(row.returned_to_sender),
    labelPrintedAt: row.label_printed_at ? String(row.label_printed_at) : null,
    estimatedDeliveryAt: row.estimated_delivery_at
      ? String(row.estimated_delivery_at)
      : null,
    labelStoragePath: row.label_storage_path
      ? String(row.label_storage_path)
      : null,
    errorMessage: row.error_message ? String(row.error_message) : null,
    tokenExpiresAt: String(row.token_expires_at),
    rateExpiresAt: row.rate_expires_at ? String(row.rate_expires_at) : null,
    createdAt: String(row.created_at),
    paidAt: row.paid_at ? String(row.paid_at) : null,
    labelCreatedAt: row.label_created_at ? String(row.label_created_at) : null,
    shippedAt: row.shipped_at ? String(row.shipped_at) : null,
    deliveredAt: row.delivered_at ? String(row.delivered_at) : null,
    cancelledAt: row.cancelled_at ? String(row.cancelled_at) : null,
    successfulPaymentId: row.successful_payment_id
      ? Number(row.successful_payment_id)
      : null,
    /** Populated when caller attaches successful payment details. */
    amountPaid: null as number | null,
    stripePaymentRef: null as string | null,
    providerReceiptUrl: null as string | null,
  };
}

export async function listShippingRequestsForItem(
  supabase: SupabaseClient,
  scope: LostFoundShippingScope,
  lostItemId: number
) {
  await assertLostItemInTenant(supabase, lostItemId, scope);
  const { data, error } = await supabase
    .from("lost_found_shipping_requests")
    .select("*")
    .eq("organization_id", scope.organizationId)
    .eq("property_id", scope.propertyId)
    .eq("lost_item_id", lostItemId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);

  const views = [];
  for (const row of data || []) {
    const view = toStaffShippingRequestView(row as ShippingRequestRow);
    if (view.successfulPaymentId) {
      try {
        const payment = await findPaymentById(supabase, view.successfulPaymentId);
        if (
          payment &&
          payment.organization_id === scope.organizationId &&
          payment.property_id === scope.propertyId
        ) {
          view.amountPaid = centsToAmount(payment.amount_cents);
          view.stripePaymentRef =
            redactStripeId(payment.provider_payment_intent_id) ||
            redactStripeId(payment.provider_checkout_session_id);
          const receipt =
            payment.metadata_json &&
            typeof payment.metadata_json.provider_receipt_url === "string"
              ? String(payment.metadata_json.provider_receipt_url)
              : null;
          view.providerReceiptUrl = receipt;
          if (!view.paidAt && payment.paid_at) {
            view.paidAt = payment.paid_at;
          }
        }
      } catch {
        // Keep business fields even if payment lookup fails.
      }
    }
    views.push(view);
  }
  return views;
}

export async function createShippingRequest(
  supabase: SupabaseClient,
  scope: LostFoundShippingScope,
  input: CreateShippingRequestInput
): Promise<{ request: ReturnType<typeof toStaffShippingRequestView>; guestUrl: string }> {
  await assertLostItemInTenant(supabase, input.lostItemId, scope);

  const settings = await fetchPropertyShippingSettings(supabase, scope);
  if (!isShippingSettingsReady(settings)) {
    throw new TenantRequestError(
      400,
      settings.propertyAddressComplete
        ? "Complete Property Shipping Settings before sending an automated shipping request."
        : "Complete the property address in Hotel Building Information before sending an automated shipping request."
    );
  }

  const guestEmail = input.guestEmail.trim().toLowerCase();
  if (!guestEmail.includes("@")) {
    throw new TenantRequestError(400, "A valid guest email is required.");
  }

  const weightOz = Number(input.weightOz);
  const lengthIn = Number(input.lengthIn);
  const widthIn = Number(input.widthIn);
  const heightIn = Number(input.heightIn);
  if (![weightOz, lengthIn, widthIn, heightIn].every((n) => Number.isFinite(n) && n > 0)) {
    throw new TenantRequestError(
      400,
      "Package weight and dimensions must be positive numbers (oz / inches)."
    );
  }

  const presetKey = isPackagePresetKey(input.packagePreset)
    ? input.packagePreset
    : "custom";
  getPackagePreset(presetKey);

  const shipFrom = await resolveShipFromForProperty(supabase, scope, settings);
  const rawToken = generateShippingGuestToken();
  const tokenHash = hashShippingGuestToken(rawToken);
  const expiresAt = tokenExpiresAt(settings.tokenTtlHours).toISOString();
  const guestUrl = `${resolveAppUrl()}/shipping-request/${rawToken}`;

  const { data, error } = await supabase
    .from("lost_found_shipping_requests")
    .insert({
      organization_id: scope.organizationId,
      property_id: scope.propertyId,
      lost_item_id: input.lostItemId,
      secure_token_hash: tokenHash,
      token_expires_at: expiresAt,
      guest_name: input.guestName.trim(),
      guest_email: guestEmail,
      guest_phone: (input.guestPhone || "").trim(),
      item_description_public: input.itemDescriptionPublic.trim(),
      internal_notes: (input.internalNotes || "").trim(),
      ship_from_address_json: shipFrom,
      package_preset: presetKey,
      weight_oz: weightOz,
      length_in: lengthIn,
      width_in: widthIn,
      height_in: heightIn,
      shipping_provider: getShippingProviderMode(),
      payment_status: "pending",
      fulfillment_status: "pending",
      shipment_status: "awaiting_guest",
      currency: "usd",
      created_by: input.createdBy,
    })
    .select("*")
    .single();

  if (error) {
    if (/one_active_per_item|duplicate key/i.test(error.message)) {
      throw new TenantRequestError(
        409,
        "An active shipping request already exists for this item."
      );
    }
    throw new Error(error.message);
  }

  const requestId = Number((data as ShippingRequestRow).id);

  await supabase
    .from("lost_items")
    .update({
      status: LOST_ITEM_STATUS.awaitingGuestAction,
      label_requested_at: new Date().toISOString(),
    })
    .eq("id", input.lostItemId)
    .eq("organization_id", scope.organizationId)
    .eq("property_id", scope.propertyId);

  await appendShippingEvent(supabase, {
    organizationId: scope.organizationId,
    propertyId: scope.propertyId,
    lostItemId: input.lostItemId,
    shippingRequestId: requestId,
    eventType: SHIPPING_TIMELINE_EVENTS.requestCreated,
    eventSource: "staff",
    eventData: {
      guestEmailDomain: guestEmail.includes("@")
        ? guestEmail.split("@")[1]
        : null,
      packagePreset: presetKey,
      tokenExpiresAt: expiresAt,
      guestUrl,
      notes: "Automated shipping request created",
    },
    createdBy: input.createdBy,
  });

  await appendShippingEvent(supabase, {
    organizationId: scope.organizationId,
    propertyId: scope.propertyId,
    lostItemId: input.lostItemId,
    shippingRequestId: requestId,
    eventType: SHIPPING_TIMELINE_EVENTS.guestLinkIssued,
    eventSource: "system",
    eventData: {
      notes: "Guest shipping link created with request",
      guestUrl,
      tokenExpiresAt: expiresAt,
    },
    createdBy: input.createdBy,
  });

  return {
    request: toStaffShippingRequestView(data as ShippingRequestRow),
    guestUrl,
  };
}

/**
 * Recover the One Eyrie guest tracking URL previously issued for a request.
 * Tokens are stored hashed; the plaintext URL is kept in shipping event data.
 */
export async function getStoredGuestShippingUrl(
  supabase: SupabaseClient,
  shippingRequestId: number
): Promise<string | null> {
  const { data, error } = await supabase
    .from("lost_found_shipping_events")
    .select("event_data")
    .eq("shipping_request_id", shippingRequestId)
    .order("created_at", { ascending: false })
    .limit(80);

  if (error) throw new Error(error.message);

  for (const row of data || []) {
    const eventData =
      row.event_data && typeof row.event_data === "object"
        ? (row.event_data as Record<string, unknown>)
        : null;
    const guestUrl = eventData?.guestUrl;
    if (
      typeof guestUrl === "string" &&
      guestUrl.includes("/shipping-request/")
    ) {
      return guestUrl.trim();
    }
  }
  return null;
}

/**
 * Issue (or re-issue) a guest shipping URL for staff copy/open.
 * Rotates the secure token so prior links stop working (pre-payment only).
 */
export async function issueGuestShippingLink(
  supabase: SupabaseClient,
  scope: LostFoundShippingScope,
  input: { shippingRequestId: number; lostItemId: number; createdBy: string }
): Promise<{ guestUrl: string }> {
  await assertLostItemInTenant(supabase, input.lostItemId, scope);

  const { data: row, error } = await supabase
    .from("lost_found_shipping_requests")
    .select("*")
    .eq("id", input.shippingRequestId)
    .eq("lost_item_id", input.lostItemId)
    .eq("organization_id", scope.organizationId)
    .eq("property_id", scope.propertyId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!row) {
    throw new TenantRequestError(404, "Shipping request not found.");
  }
  if (row.cancelled_at) {
    throw new TenantRequestError(410, "Shipping request is cancelled.");
  }
  // Return the previously issued One Eyrie guest URL when available.
  if (String(row.payment_status) === "paid") {
    const stored = await getStoredGuestShippingUrl(
      supabase,
      input.shippingRequestId
    );
    if (stored) {
      return { guestUrl: stored };
    }
    throw new TenantRequestError(
      400,
      "Guest link cannot be re-issued after payment. Use the original link from the guest email."
    );
  }

  const settings = await fetchPropertyShippingSettings(supabase, scope);
  const ttlHours = Number(settings?.tokenTtlHours || 168);
  const rawToken = generateShippingGuestToken();
  const tokenHash = hashShippingGuestToken(rawToken);
  const expiresAt = tokenExpiresAt(ttlHours).toISOString();
  const guestUrl = `${resolveAppUrl()}/shipping-request/${rawToken}`;

  const { error: updateError } = await supabase
    .from("lost_found_shipping_requests")
    .update({
      secure_token_hash: tokenHash,
      token_expires_at: expiresAt,
      updated_at: new Date().toISOString(),
    })
    .eq("id", input.shippingRequestId)
    .eq("organization_id", scope.organizationId)
    .eq("property_id", scope.propertyId);

  if (updateError) throw new Error(updateError.message);

  await appendShippingEvent(supabase, {
    organizationId: scope.organizationId,
    propertyId: scope.propertyId,
    lostItemId: input.lostItemId,
    shippingRequestId: input.shippingRequestId,
    eventType: SHIPPING_TIMELINE_EVENTS.guestLinkIssued,
    eventSource: "staff",
    eventData: {
      notes: "Staff issued a guest shipping link",
      tokenExpiresAt: expiresAt,
      guestUrl,
    },
    createdBy: input.createdBy,
  });

  return { guestUrl };
}

export type GuestShippingPackageView = {
  lengthIn: number | null;
  widthIn: number | null;
  heightIn: number | null;
  weightOz: number | null;
  preset: string | null;
};

export type GuestShippingRequestView = {
  state:
    | "awaiting_guest"
    | "awaiting_payment"
    | "payment_processing"
    | "label_created"
    | "in_transit"
    | "delivered"
    | "expired"
    | "unavailable";
  propertyName: string;
  propertyBrand: string | null;
  /** Reserved for future property logo uploads; null until configured. */
  propertyLogoUrl: string | null;
  /** Property phone for branded guest experience (optional). */
  propertyPhone: string | null;
  /** Property mailing address line for branding (not ship-from). */
  propertyAddress: string | null;
  itemName: string;
  itemDescription: string;
  roomNumber: string | null;
  foundDate: string | null;
  /** Reserved for future item photos; null until available. */
  photoUrl: string | null;
  guestName: string;
  guestEmail: string;
  tokenExpiresAt: string;
  selectedProviderRateId: string | null;
  selectedCarrier: string | null;
  selectedService: string | null;
  totalAmount: number | null;
  currency: string;
  recipientSummary: string | null;
  recipientAddress: ShippingAddress | null;
  package: GuestShippingPackageView;
  rateExpiresAt: string | null;
  trackingNumber: string | null;
  trackingUrl: string | null;
  carrierTrackingStatus: string | null;
  latestCarrierUpdate: string | null;
  estimatedDeliveryAt: string | null;
  shippedAt: string | null;
  deliveredAt: string | null;
  returnedToSender: boolean;
  shippingExceptionMessage: string | null;
  /** Staff/internal fulfillment state — used for guest copy when label failed. */
  fulfillmentStatus: string | null;
};

export async function resolveGuestShippingRequestByToken(
  supabase: SupabaseClient,
  rawToken: string
): Promise<GuestShippingRequestView> {
  const token = rawToken.trim();
  if (!token || token.length < 20) {
    return unavailable();
  }

  const tokenHash = hashShippingGuestToken(token);
  const { data, error } = await supabase
    .from("lost_found_shipping_requests")
    .select("*")
    .eq("secure_token_hash", tokenHash)
    .maybeSingle();

  if (error || !data) {
    return unavailable();
  }

  const row = data as ShippingRequestRow;

  if (row.cancelled_at) return unavailable();

  const expiresAt = String(row.token_expires_at);
  const paymentStatus = String(row.payment_status);
  const fulfillmentStatus = String(row.fulfillment_status);
  const shipmentStatus = String(row.shipment_status);

  let state: GuestShippingRequestView["state"] = "awaiting_guest";

  // Post-payment / in-progress shipment: original guest link is a tracking page.
  // Never treat these as "expired" even if the pre-payment token TTL has passed.
  if (shipmentStatus === "delivered") state = "delivered";
  else if (shipmentStatus === "in_transit") state = "in_transit";
  else if (
    fulfillmentStatus === "label_ready" ||
    shipmentStatus === "label_ready" ||
    Boolean(row.tracking_number)
  ) {
    state = "label_created";
  } else if (
    paymentStatus === "paid" &&
    (fulfillmentStatus === "pending" ||
      fulfillmentStatus === "needs_manual_review")
  ) {
    state = "payment_processing";
  } else if (paymentStatus === "paid") {
    state = "label_created";
  } else if (
    paymentStatus === "pending" &&
    new Date(expiresAt).getTime() <= Date.now()
  ) {
    state = "expired";
  } else if (shipmentStatus === "awaiting_payment") {
    state = "awaiting_payment";
  } else {
    state = "awaiting_guest";
  }

  let propertyName = "Hotel";
  let propertyBrand: string | null = null;
  let propertyPhone: string | null = null;
  let propertyAddress: string | null = null;
  const propertyId = Number(row.property_id);
  const organizationId = Number(row.organization_id);
  if (Number.isFinite(propertyId) && Number.isFinite(organizationId)) {
    // Guest branding is always resolved from the lost item's property_id —
    // never staff active property, URL params, or hardcoded hotel values.
    const { data: property } = await supabase
      .from("properties")
      .select(
        "name, brand, address, address_line1, address_line2, address_city, address_state, address_postal, address_country, phone_number"
      )
      .eq("id", propertyId)
      .eq("organization_id", organizationId)
      .maybeSingle();
    if (property?.name) propertyName = String(property.name);
    if (property?.brand) propertyBrand = String(property.brand);
    // Guest-facing phone: property record only (Platform Property Settings).
    const phone = String(property?.phone_number || "").trim();
    propertyPhone = phone || null;
    if (property?.address) {
      propertyAddress = String(property.address);
    } else if (property?.address_line1) {
      propertyAddress = [
        property.address_line1,
        property.address_line2,
        [property.address_city, property.address_state]
          .filter(Boolean)
          .join(", "),
        property.address_postal,
      ]
        .filter((part) => part && String(part).trim())
        .join(", ");
    }
  }

  let itemName = String(row.item_description_public || "Your item");
  let roomNumber: string | null = null;
  let foundDate: string | null = null;
  const lostItemId = Number(row.lost_item_id);
  if (Number.isFinite(lostItemId)) {
    const { data: lostItem } = await supabase
      .from("lost_items")
      .select("item_name, room_number, created_at, comments")
      .eq("id", lostItemId)
      .eq("organization_id", organizationId)
      .eq("property_id", propertyId)
      .maybeSingle();
    if (lostItem?.item_name) itemName = String(lostItem.item_name);
    if (lostItem?.room_number) roomNumber = String(lostItem.room_number);
    if (lostItem?.created_at) foundDate = String(lostItem.created_at);
  }

  let latestCarrierUpdate: string | null = null;
  const requestId = Number(row.id);
  if (Number.isFinite(requestId)) {
    const { data: latestTrack } = await supabase
      .from("lost_found_shipping_events")
      .select("event_data, event_type, created_at")
      .eq("shipping_request_id", requestId)
      .in("event_type", [
        SHIPPING_TIMELINE_EVENTS.trackingUpdateReceived,
        SHIPPING_TIMELINE_EVENTS.packageShipped,
        SHIPPING_TIMELINE_EVENTS.packageDelivered,
        SHIPPING_TIMELINE_EVENTS.shippingException,
        SHIPPING_TIMELINE_EVENTS.returnedToSender,
        SHIPPING_TIMELINE_EVENTS.trackingAssigned,
        SHIPPING_TIMELINE_EVENTS.labelPurchased,
      ])
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    const eventData =
      latestTrack?.event_data && typeof latestTrack.event_data === "object"
        ? (latestTrack.event_data as Record<string, unknown>)
        : null;
    if (eventData?.notes) latestCarrierUpdate = String(eventData.notes);
  }

  return {
    state,
    propertyName,
    propertyBrand,
    propertyLogoUrl: null,
    propertyPhone,
    propertyAddress,
    itemName,
    itemDescription: String(row.item_description_public || itemName || "Your item"),
    roomNumber,
    foundDate,
    photoUrl: null,
    guestName: String(row.guest_name || ""),
    guestEmail: String(row.guest_email || ""),
    tokenExpiresAt: expiresAt,
    selectedProviderRateId: row.provider_rate_id
      ? String(row.provider_rate_id)
      : null,
    selectedCarrier: storedCarrierLabel(row.selected_carrier),
    selectedService: storedCarrierLabel(row.selected_service),
    totalAmount: row.total_amount == null ? null : Number(row.total_amount),
    currency: String(row.currency || "usd"),
    recipientSummary: formatRecipientSummary(row.recipient_address_json),
    recipientAddress: parseShipFromJson(row.recipient_address_json),
    package: {
      lengthIn: row.length_in == null ? null : Number(row.length_in),
      widthIn: row.width_in == null ? null : Number(row.width_in),
      heightIn: row.height_in == null ? null : Number(row.height_in),
      weightOz: row.weight_oz == null ? null : Number(row.weight_oz),
      preset: row.package_preset ? String(row.package_preset) : null,
    },
    rateExpiresAt: row.rate_expires_at ? String(row.rate_expires_at) : null,
    trackingNumber: row.tracking_number ? String(row.tracking_number) : null,
    trackingUrl: row.tracking_url ? String(row.tracking_url) : null,
    carrierTrackingStatus: row.carrier_tracking_status
      ? String(row.carrier_tracking_status)
      : null,
    latestCarrierUpdate:
      latestCarrierUpdate ||
      (row.shipping_exception_message
        ? String(row.shipping_exception_message)
        : null),
    estimatedDeliveryAt: row.estimated_delivery_at
      ? String(row.estimated_delivery_at)
      : null,
    shippedAt: row.shipped_at ? String(row.shipped_at) : null,
    deliveredAt: row.delivered_at ? String(row.delivered_at) : null,
    returnedToSender: Boolean(row.returned_to_sender),
    shippingExceptionMessage: row.shipping_exception_message
      ? String(row.shipping_exception_message)
      : null,
    fulfillmentStatus: fulfillmentStatus || null,
  };
}

function formatRecipientSummary(value: unknown): string | null {
  const address = parseShipFromJson(value);
  if (!address?.line1) return null;
  const line2 = address.line2 ? `, ${address.line2}` : "";
  return `${address.name} · ${address.line1}${line2}, ${address.city}, ${address.state} ${address.postal}`;
}

function unavailable(): GuestShippingRequestView {
  return {
    state: "unavailable",
    propertyName: "",
    propertyBrand: null,
    propertyLogoUrl: null,
    propertyPhone: null,
    propertyAddress: null,
    itemName: "",
    itemDescription: "",
    roomNumber: null,
    foundDate: null,
    photoUrl: null,
    guestName: "",
    guestEmail: "",
    tokenExpiresAt: "",
    selectedProviderRateId: null,
    selectedCarrier: null,
    selectedService: null,
    totalAmount: null,
    currency: "usd",
    recipientSummary: null,
    recipientAddress: null,
    package: {
      lengthIn: null,
      widthIn: null,
      heightIn: null,
      weightOz: null,
      preset: null,
    },
    rateExpiresAt: null,
    trackingNumber: null,
    trackingUrl: null,
    carrierTrackingStatus: null,
    latestCarrierUpdate: null,
    estimatedDeliveryAt: null,
    shippedAt: null,
    deliveredAt: null,
    returnedToSender: false,
    shippingExceptionMessage: null,
    fulfillmentStatus: null,
  };
}

export function parseShipFromJson(value: unknown): ShippingAddress | null {
  if (!value || typeof value !== "object") return null;
  const row = value as Record<string, unknown>;
  return {
    name: String(row.name || ""),
    line1: String(row.line1 || ""),
    line2: row.line2 ? String(row.line2) : undefined,
    city: String(row.city || ""),
    state: String(row.state || ""),
    postal: String(row.postal || ""),
    country: String(row.country || "US"),
    phone: row.phone ? String(row.phone) : undefined,
    email: row.email ? String(row.email) : undefined,
  };
}

/** Staff marks an automated shipping label as printed (audit + timestamp). */
export async function markShippingLabelPrinted(
  supabase: SupabaseClient,
  scope: LostFoundShippingScope,
  input: { shippingRequestId: number; lostItemId: number; createdBy: string }
): Promise<{ labelPrintedAt: string }> {
  await assertLostItemInTenant(supabase, input.lostItemId, scope);

  const { data: row, error } = await supabase
    .from("lost_found_shipping_requests")
    .select("*")
    .eq("id", input.shippingRequestId)
    .eq("lost_item_id", input.lostItemId)
    .eq("organization_id", scope.organizationId)
    .eq("property_id", scope.propertyId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!row) throw new TenantRequestError(404, "Shipping request not found.");
  if (row.cancelled_at) {
    throw new TenantRequestError(410, "Shipping request is cancelled.");
  }

  const hasLabel =
    Boolean(row.label_storage_path) ||
    Boolean(row.label_created_at) ||
    String(row.fulfillment_status) === "label_ready" ||
    String(row.shipment_status) === "label_ready";
  if (!hasLabel) {
    throw new TenantRequestError(400, "No shipping label is available to print.");
  }

  const printedAt = new Date().toISOString();
  const { error: updateError } = await supabase
    .from("lost_found_shipping_requests")
    .update({
      label_printed_at: printedAt,
      updated_at: printedAt,
    })
    .eq("id", input.shippingRequestId)
    .eq("organization_id", scope.organizationId)
    .eq("property_id", scope.propertyId);

  if (updateError) throw new Error(updateError.message);

  await appendShippingEvent(supabase, {
    organizationId: scope.organizationId,
    propertyId: scope.propertyId,
    lostItemId: input.lostItemId,
    shippingRequestId: input.shippingRequestId,
    eventType: SHIPPING_TIMELINE_EVENTS.labelPrinted,
    eventSource: "staff",
    eventData: { notes: "Staff marked shipping label as printed" },
    createdBy: input.createdBy,
  });

  return { labelPrintedAt: printedAt };
}

/** Signed URL for a purchased label PDF (private bucket). */
export async function createShippingLabelSignedUrl(
  supabase: SupabaseClient,
  scope: LostFoundShippingScope,
  input: { shippingRequestId: number; lostItemId: number }
): Promise<{ url: string } | null> {
  await assertLostItemInTenant(supabase, input.lostItemId, scope);

  const { data: row, error } = await supabase
    .from("lost_found_shipping_requests")
    .select("id, label_storage_path")
    .eq("id", input.shippingRequestId)
    .eq("lost_item_id", input.lostItemId)
    .eq("organization_id", scope.organizationId)
    .eq("property_id", scope.propertyId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!row?.label_storage_path) return null;

  const { data: signed, error: signError } = await supabase.storage
    .from("lost-found-shipping-labels")
    .createSignedUrl(String(row.label_storage_path), 120);

  if (signError) throw new Error(signError.message);
  if (!signed?.signedUrl) return null;
  return { url: signed.signedUrl };
}
