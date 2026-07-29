import { NextResponse } from "next/server";
import {
  fetchPropertyShippingSettings,
  upsertPropertyShippingSettings,
  type PropertyShippingSettingsInput,
} from "@/app/lib/lost-found-shipping/property-shipping-settings";
import { assertCanManageTeamMembers } from "@/app/settings/lib/team-members-db";
import {
  resolveTenantRequest,
  tenantErrorResponse,
} from "@/app/lib/tenant/server/resolve-tenant-request";

function normalizeInput(body: Record<string, unknown>): PropertyShippingSettingsInput {
  const num = (value: unknown) => {
    if (value === null || value === undefined || value === "") return null;
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  };

  const hasAddress =
    body.shipFromLine1 !== undefined ||
    body.ship_from_line1 !== undefined ||
    body.shipFromCity !== undefined ||
    body.ship_from_city !== undefined ||
    body.shipFromState !== undefined ||
    body.ship_from_state !== undefined ||
    body.shipFromPostal !== undefined ||
    body.ship_from_postal !== undefined;

  return {
    shippingEnabled: Boolean(body.shippingEnabled ?? body.shipping_enabled),
    senderName: String(body.senderName ?? body.sender_name ?? "").trim(),
    ...(hasAddress
      ? {
          shipFromLine1: String(
            body.shipFromLine1 ?? body.ship_from_line1 ?? ""
          ).trim(),
          shipFromLine2: String(
            body.shipFromLine2 ?? body.ship_from_line2 ?? ""
          ).trim(),
          shipFromCity: String(
            body.shipFromCity ?? body.ship_from_city ?? ""
          ).trim(),
          shipFromState: String(
            body.shipFromState ?? body.ship_from_state ?? ""
          ).trim(),
          shipFromPostal: String(
            body.shipFromPostal ?? body.ship_from_postal ?? ""
          ).trim(),
          shipFromCountry: String(
            body.shipFromCountry ?? body.ship_from_country ?? "US"
          ).trim(),
        }
      : {}),
    propertyPhone: String(body.propertyPhone ?? body.property_phone ?? "").trim(),
    propertyEmail: String(body.propertyEmail ?? body.property_email ?? "").trim(),
    defaultPackagePreset: String(
      body.defaultPackagePreset ?? body.default_package_preset ?? "small_box"
    ).trim(),
    defaultLengthIn: num(body.defaultLengthIn ?? body.default_length_in),
    defaultWidthIn: num(body.defaultWidthIn ?? body.default_width_in),
    defaultHeightIn: num(body.defaultHeightIn ?? body.default_height_in),
    defaultWeightOz: num(body.defaultWeightOz ?? body.default_weight_oz),
    defaultSenderContact: String(
      body.defaultSenderContact ?? body.default_sender_contact ?? ""
    ).trim(),
    tokenTtlHours: Number(body.tokenTtlHours ?? body.token_ttl_hours ?? 168) || 168,
  };
}

export async function GET(request: Request) {
  try {
    const { supabase, organizationId, propertyId } = await resolveTenantRequest(
      request
    );
    const settings = await fetchPropertyShippingSettings(supabase, {
      organizationId,
      propertyId,
    });
    return NextResponse.json({ settings });
  } catch (error: unknown) {
    return tenantErrorResponse(error);
  }
}

export async function PUT(request: Request) {
  try {
    const { supabase, user, organizationId, propertyId } =
      await resolveTenantRequest(request);
    const scope = { organizationId, propertyId };
    await assertCanManageTeamMembers(supabase, user.id, scope);

    const body = (await request.json()) as Record<string, unknown>;
    const settings = await upsertPropertyShippingSettings(
      supabase,
      scope,
      normalizeInput(body)
    );
    return NextResponse.json({ settings });
  } catch (error: unknown) {
    return tenantErrorResponse(error);
  }
}
