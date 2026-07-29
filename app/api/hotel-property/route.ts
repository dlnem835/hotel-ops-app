import { NextResponse } from "next/server";
import { HotelPropertyInput } from "@/app/settings/lib/hotel-property-types";
import {
  assertCanManageTeamMembers,
} from "@/app/settings/lib/team-members-db";
import {
  fetchHotelProperty,
  updateHotelProperty,
} from "@/app/settings/lib/hotel-property-db";
import {
  resolveTenantRequest,
  tenantErrorResponse,
} from "@/app/lib/tenant/server/resolve-tenant-request";

function normalizeInput(body: Record<string, unknown>): HotelPropertyInput {
  const nested =
    body.address && typeof body.address === "object"
      ? (body.address as Record<string, unknown>)
      : null;

  return {
    hotelName: String(body.hotelName ?? body.hotel_name ?? "").trim(),
    addressLine1: String(
      body.addressLine1 ?? body.address_line1 ?? nested?.line1 ?? ""
    ).trim(),
    addressLine2: String(
      body.addressLine2 ?? body.address_line2 ?? nested?.line2 ?? ""
    ).trim(),
    addressCity: String(
      body.addressCity ?? body.address_city ?? nested?.city ?? ""
    ).trim(),
    addressState: String(
      body.addressState ?? body.address_state ?? nested?.state ?? ""
    ).trim(),
    addressPostal: String(
      body.addressPostal ?? body.address_postal ?? nested?.postal ?? ""
    ).trim(),
    addressCountry: String(
      body.addressCountry ?? body.address_country ?? nested?.country ?? "US"
    ).trim() || "US",
    phoneNumber: String(body.phoneNumber ?? body.phone_number ?? "").trim(),
  };
}

export async function GET(request: Request) {
  try {
    const { supabase, organizationId, propertyId } = await resolveTenantRequest(
      request
    );
    const property = await fetchHotelProperty(supabase, {
      organizationId,
      propertyId,
    });
    return NextResponse.json({ property });
  } catch (error: unknown) {
    return tenantErrorResponse(error);
  }
}

export async function PATCH(request: Request) {
  try {
    const { supabase, user, organizationId, propertyId } =
      await resolveTenantRequest(request);
    const scope = { organizationId, propertyId };
    await assertCanManageTeamMembers(supabase, user.id, scope);

    const body = (await request.json()) as Record<string, unknown>;
    const input = normalizeInput(body);
    const property = await updateHotelProperty(supabase, scope, input);

    return NextResponse.json({ property });
  } catch (error: unknown) {
    return tenantErrorResponse(error);
  }
}
