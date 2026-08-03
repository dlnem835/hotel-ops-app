import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { TenantRequestError } from "@/app/lib/tenant/server/resolve-tenant-request";
import { assertLostItemInTenant } from "@/app/lost-and-found/lib/lost-found-server-db";
import {
  getPackagePreset,
  isPackagePresetKey,
} from "@/app/lib/shipping/package-presets";
import {
  dispatchGuestShippingEmail,
  GuestShippingEmailConfigError,
} from "@/app/lib/lost-found-shipping/dispatch-guest-shipping-email";
import {
  logAuthEmailConfigError,
  resolveAuthEmailConfig,
} from "@/app/lib/email/auth-email-config";
import {
  appendShippingEvent,
  createShippingRequest,
  issueGuestShippingLink,
  type LostFoundShippingScope,
  type ShippingRequestRow,
} from "@/app/lib/lost-found-shipping/shipping-requests";
import {
  fetchPropertyShippingSettings,
  isShippingSettingsReady,
} from "@/app/lib/lost-found-shipping/property-shipping-settings";
import { LOST_ITEM_STATUS } from "@/app/lib/lost-found-shipping/status";
import { SHIPPING_TIMELINE_EVENTS } from "@/app/lib/lost-found-shipping/timeline";

function isValidEmail(value: string): boolean {
  const email = value.trim().toLowerCase();
  return email.includes("@") && email.includes(".") && email.length >= 5;
}

function isReusableForGuestEmail(row: ShippingRequestRow): boolean {
  if (row.cancelled_at) return false;
  const payment = String(row.payment_status || "");
  const fulfillment = String(row.fulfillment_status || "");
  if (payment === "paid") return false;
  if (fulfillment === "label_ready" || fulfillment === "needs_manual_review") {
    return false;
  }
  return payment === "pending" || payment === "failed" || payment === "expired";
}

async function findLatestOpenRequest(
  supabase: SupabaseClient,
  scope: LostFoundShippingScope,
  lostItemId: number
): Promise<ShippingRequestRow | null> {
  const { data, error } = await supabase
    .from("lost_found_shipping_requests")
    .select("*")
    .eq("organization_id", scope.organizationId)
    .eq("property_id", scope.propertyId)
    .eq("lost_item_id", lostItemId)
    .is("cancelled_at", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return (data as ShippingRequestRow | null) || null;
}

async function loadPropertyEmailBranding(
  supabase: SupabaseClient,
  scope: LostFoundShippingScope
): Promise<{
  propertyName: string;
  propertyPhone: string;
  propertyReturnEmail: string;
  propertyAddressLine: string;
}> {
  const settings = await fetchPropertyShippingSettings(supabase, scope);
  const { data: property } = await supabase
    .from("properties")
    .select(
      "name, phone_number, address, address_line1, address_line2, address_city, address_state, address_postal"
    )
    .eq("id", scope.propertyId)
    .eq("organization_id", scope.organizationId)
    .maybeSingle();

  const propertyName =
    String(property?.name || "").trim() ||
    settings.senderName ||
    "Hotel";
  // Guest-facing phone always from the property record for this property_id.
  const propertyPhone = String(property?.phone_number || "").trim();
  // Return email is operational only — not shown on guest portal / guest email body.
  const propertyReturnEmail = settings.propertyEmail || "";

  let propertyAddressLine = String(property?.address || "").trim();
  if (!propertyAddressLine && property?.address_line1) {
    propertyAddressLine = [
      property.address_line1,
      property.address_line2,
      [property.address_city, property.address_state].filter(Boolean).join(", "),
      property.address_postal,
    ]
      .filter((part) => part && String(part).trim())
      .join(", ");
  }
  if (!propertyAddressLine) {
    propertyAddressLine = [
      settings.shipFromLine1,
      settings.shipFromLine2,
      [settings.shipFromCity, settings.shipFromState].filter(Boolean).join(", "),
      settings.shipFromPostal,
    ]
      .filter((part) => part && String(part).trim())
      .join(", ");
  }

  return {
    propertyName,
    propertyPhone,
    propertyReturnEmail,
    propertyAddressLine,
  };
}

export type SendGuestShippingRequestInput = {
  lostItemId: number;
  guestEmail: string;
  guestName?: string;
  guestPhone?: string;
  itemDescriptionPublic?: string;
  internalNotes?: string;
  packagePreset?: string;
  weightOz?: number;
  lengthIn?: number;
  widthIn?: number;
  heightIn?: number;
  createdBy: string;
};

export type SendGuestShippingRequestResult = {
  requestId: number;
  guestUrl: string;
  created: boolean;
  resent: boolean;
  emailMessageId: string | null;
  emailFrom: string;
  guestEmail: string;
};

/**
 * Create or reuse a property-scoped automated shipping request, then email the
 * guest via Resend. UI "sent" must only be shown when this resolves successfully.
 */
export async function sendGuestShippingRequest(
  supabase: SupabaseClient,
  scope: LostFoundShippingScope,
  input: SendGuestShippingRequestInput
): Promise<SendGuestShippingRequestResult> {
  await assertLostItemInTenant(supabase, input.lostItemId, scope);

  const guestEmail = input.guestEmail.trim().toLowerCase();
  if (!isValidEmail(guestEmail)) {
    throw new TenantRequestError(400, "Enter a valid guest email address.");
  }

  // Fail fast on missing Resend/sender config before creating or rotating requests.
  const emailConfig = resolveAuthEmailConfig();
  if (!emailConfig.ok) {
    logAuthEmailConfigError(emailConfig.missing);
    throw new GuestShippingEmailConfigError(emailConfig.missing);
  }

  const settings = await fetchPropertyShippingSettings(supabase, scope);
  if (!isShippingSettingsReady(settings)) {
    throw new TenantRequestError(
      400,
      settings.propertyAddressComplete
        ? "Complete Property Shipping Settings before sending a guest shipping request."
        : "Complete the property address in Hotel Building Information before sending a guest shipping request."
    );
  }

  const { data: item, error: itemError } = await supabase
    .from("lost_items")
    .select("id, item_name, guest_last_name, status")
    .eq("id", input.lostItemId)
    .eq("organization_id", scope.organizationId)
    .eq("property_id", scope.propertyId)
    .maybeSingle();

  if (itemError) throw new Error(itemError.message);
  if (!item) throw new TenantRequestError(404, "Lost item not found.");

  const existing = await findLatestOpenRequest(
    supabase,
    scope,
    input.lostItemId
  );

  let requestId: number;
  let guestUrl: string;
  let created = false;
  let resent = false;
  let tokenExpiresAt: string | null = null;
  let guestName =
    (input.guestName || "").trim() ||
    String(item.guest_last_name || "").trim() ||
    "Guest";
  let itemDescription =
    (input.itemDescriptionPublic || "").trim() ||
    String(item.item_name || "").trim() ||
    "Your item";

  if (existing && isReusableForGuestEmail(existing)) {
    requestId = Number(existing.id);
    resent = true;
    const previousEmail = String(existing.guest_email || "").trim().toLowerCase();

    const { error: updateError } = await supabase
      .from("lost_found_shipping_requests")
      .update({
        guest_email: guestEmail,
        guest_name: guestName,
        guest_phone:
          (input.guestPhone || "").trim() ||
          String(existing.guest_phone || ""),
        item_description_public: itemDescription,
        updated_at: new Date().toISOString(),
      })
      .eq("id", requestId)
      .eq("organization_id", scope.organizationId)
      .eq("property_id", scope.propertyId);

    if (updateError) throw new Error(updateError.message);

    if (previousEmail && previousEmail !== guestEmail) {
      await appendShippingEvent(supabase, {
        organizationId: scope.organizationId,
        propertyId: scope.propertyId,
        lostItemId: input.lostItemId,
        shippingRequestId: requestId,
        eventType: SHIPPING_TIMELINE_EVENTS.guestEmailUpdated,
        eventSource: "staff",
        eventData: {
          notes: `Guest email updated from ${previousEmail} to ${guestEmail}`,
          previousEmail,
          newEmail: guestEmail,
        },
        createdBy: input.createdBy,
      });
    }

    const link = await issueGuestShippingLink(supabase, scope, {
      shippingRequestId: requestId,
      lostItemId: input.lostItemId,
      createdBy: input.createdBy,
    });
    guestUrl = link.guestUrl;

    const { data: refreshed } = await supabase
      .from("lost_found_shipping_requests")
      .select("token_expires_at")
      .eq("id", requestId)
      .maybeSingle();
    tokenExpiresAt = refreshed?.token_expires_at
      ? String(refreshed.token_expires_at)
      : null;
  } else if (existing) {
    throw new TenantRequestError(
      409,
      "A shipping request already exists for this item. Open Item Details to manage shipping, tracking, or labels."
    );
  } else {
    const presetRaw =
      input.packagePreset || settings.defaultPackagePreset || "small_box";
    const presetKey = isPackagePresetKey(presetRaw) ? presetRaw : "small_box";
    const preset = getPackagePreset(presetKey);

    const weightOz =
      Number(input.weightOz) ||
      Number(settings.defaultWeightOz) ||
      Number(preset.weightOz) ||
      16;
    const lengthIn =
      Number(input.lengthIn) ||
      Number(settings.defaultLengthIn) ||
      Number(preset.lengthIn) ||
      8;
    const widthIn =
      Number(input.widthIn) ||
      Number(settings.defaultWidthIn) ||
      Number(preset.widthIn) ||
      6;
    const heightIn =
      Number(input.heightIn) ||
      Number(settings.defaultHeightIn) ||
      Number(preset.heightIn) ||
      4;

    const createdRequest = await createShippingRequest(supabase, scope, {
      lostItemId: input.lostItemId,
      guestName,
      guestEmail,
      guestPhone: input.guestPhone || "",
      itemDescriptionPublic: itemDescription,
      internalNotes: input.internalNotes || "",
      packagePreset: presetKey,
      weightOz,
      lengthIn,
      widthIn,
      heightIn,
      createdBy: input.createdBy,
    });

    requestId = Number(createdRequest.request.id);
    guestUrl = createdRequest.guestUrl;
    created = true;
    tokenExpiresAt = createdRequest.request.tokenExpiresAt
      ? String(createdRequest.request.tokenExpiresAt)
      : null;
  }

  const branding = await loadPropertyEmailBranding(supabase, scope);

  // Email must succeed before we report "sent" to staff.
  const emailed = await dispatchGuestShippingEmail({
    to: guestEmail,
    guestName,
    itemName: itemDescription,
    propertyName: branding.propertyName,
    propertyPhone: branding.propertyPhone,
    propertyReturnEmail: branding.propertyReturnEmail,
    propertyAddressLine: branding.propertyAddressLine,
    guestShippingUrl: guestUrl,
    expiresAt: tokenExpiresAt,
  });

  const now = new Date().toISOString();
  await supabase
    .from("lost_items")
    .update({
      status: LOST_ITEM_STATUS.awaitingGuestAction,
      label_requested_at: now,
      label_sent_at: now,
    })
    .eq("id", input.lostItemId)
    .eq("organization_id", scope.organizationId)
    .eq("property_id", scope.propertyId);

  await appendShippingEvent(supabase, {
    organizationId: scope.organizationId,
    propertyId: scope.propertyId,
    lostItemId: input.lostItemId,
    shippingRequestId: requestId,
    eventType: resent
      ? SHIPPING_TIMELINE_EVENTS.requestResent
      : SHIPPING_TIMELINE_EVENTS.requestEmailed,
    eventSource: "staff",
    eventData: {
      notes: resent
        ? `Guest shipping request resent to ${guestEmail}`
        : `Guest shipping request email sent to ${guestEmail}`,
      guestEmail,
      guestEmailDomain: guestEmail.split("@")[1] || null,
      guestUrl,
      resendMessageId: emailed.messageId,
      emailFrom: emailed.from,
      created,
      resent,
    },
    createdBy: input.createdBy,
  });

  return {
    requestId,
    guestUrl,
    created,
    resent,
    emailMessageId: emailed.messageId,
    emailFrom: emailed.from,
    guestEmail,
  };
}
