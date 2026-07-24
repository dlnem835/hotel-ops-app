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
  fetchPropertyShippingSettings,
  isShippingSettingsReady,
  settingsToShipFromAddress,
} from "./property-shipping-settings";
import { LOST_ITEM_STATUS } from "./status";
import { SHIPPING_TIMELINE_EVENTS } from "./timeline";
import {
  generateShippingGuestToken,
  hashShippingGuestToken,
  tokenExpiresAt,
} from "./token";

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
      actorLabel = createdBy ? "User" : "User (Staff)";
    } else if (source === "guest") {
      actorLabel = "Guest";
    } else if (source === "stripe" || source === "shippo" || source === "system") {
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
    selectedCarrier: row.selected_carrier ? String(row.selected_carrier) : null,
    selectedService: row.selected_service ? String(row.selected_service) : null,
    totalAmount: row.total_amount == null ? null : Number(row.total_amount),
    currency: String(row.currency || "usd"),
    trackingNumber: row.tracking_number ? String(row.tracking_number) : null,
    trackingUrl: row.tracking_url ? String(row.tracking_url) : null,
    labelStoragePath: row.label_storage_path
      ? String(row.label_storage_path)
      : null,
    errorMessage: row.error_message ? String(row.error_message) : null,
    tokenExpiresAt: String(row.token_expires_at),
    createdAt: String(row.created_at),
    paidAt: row.paid_at ? String(row.paid_at) : null,
    labelCreatedAt: row.label_created_at ? String(row.label_created_at) : null,
    shippedAt: row.shipped_at ? String(row.shipped_at) : null,
    deliveredAt: row.delivered_at ? String(row.delivered_at) : null,
    cancelledAt: row.cancelled_at ? String(row.cancelled_at) : null,
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
  return (data || []).map((row) =>
    toStaffShippingRequestView(row as ShippingRequestRow)
  );
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
      "Complete Property Shipping Settings before sending an automated shipping request."
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

  const shipFrom = settingsToShipFromAddress(settings);
  const rawToken = generateShippingGuestToken();
  const tokenHash = hashShippingGuestToken(rawToken);
  const expiresAt = tokenExpiresAt(settings.tokenTtlHours).toISOString();

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
      status: LOST_ITEM_STATUS.awaitingGuestPayment,
      label_requested_at: new Date().toISOString(),
      label_sent_at: new Date().toISOString(),
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
      notes: "Automated shipping request created",
    },
    createdBy: input.createdBy,
  });

  const guestUrl = `${resolveAppUrl()}/shipping-request/${rawToken}`;

  return {
    request: toStaffShippingRequestView(data as ShippingRequestRow),
    guestUrl,
  };
}

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
  itemDescription: string;
  guestName: string;
  guestEmail: string;
  tokenExpiresAt: string;
  selectedCarrier: string | null;
  selectedService: string | null;
  totalAmount: number | null;
  currency: string;
  trackingNumber: string | null;
  trackingUrl: string | null;
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

  if (shipmentStatus === "delivered") state = "delivered";
  else if (shipmentStatus === "in_transit") state = "in_transit";
  else if (
    fulfillmentStatus === "label_ready" ||
    shipmentStatus === "label_ready"
  ) {
    state = "label_created";
  } else if (paymentStatus === "paid" && fulfillmentStatus === "pending") {
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
  const propertyId = Number(row.property_id);
  const organizationId = Number(row.organization_id);
  if (Number.isFinite(propertyId) && Number.isFinite(organizationId)) {
    const { data: property } = await supabase
      .from("properties")
      .select("name")
      .eq("id", propertyId)
      .eq("organization_id", organizationId)
      .maybeSingle();
    if (property?.name) propertyName = String(property.name);
  }

  return {
    state,
    propertyName,
    itemDescription: String(row.item_description_public || "Your item"),
    guestName: String(row.guest_name || ""),
    guestEmail: String(row.guest_email || ""),
    tokenExpiresAt: expiresAt,
    selectedCarrier: row.selected_carrier ? String(row.selected_carrier) : null,
    selectedService: row.selected_service ? String(row.selected_service) : null,
    totalAmount: row.total_amount == null ? null : Number(row.total_amount),
    currency: String(row.currency || "usd"),
    trackingNumber: row.tracking_number ? String(row.tracking_number) : null,
    trackingUrl: row.tracking_url ? String(row.tracking_url) : null,
  };
}

function unavailable(): GuestShippingRequestView {
  return {
    state: "unavailable",
    propertyName: "",
    itemDescription: "",
    guestName: "",
    guestEmail: "",
    tokenExpiresAt: "",
    selectedCarrier: null,
    selectedService: null,
    totalAmount: null,
    currency: "usd",
    trackingNumber: null,
    trackingUrl: null,
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
