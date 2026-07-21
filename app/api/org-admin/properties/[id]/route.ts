import { NextResponse } from "next/server";
import {
  organizationAdminErrorResponse,
  OrganizationAdminRequestError,
  resolveOrganizationAdminRequestForProperty,
} from "@/app/lib/org-admin/server/resolve-organization-admin-request";
import { fetchAdminPropertyDetail } from "@/app/lib/platform-admin/server/admin-organizations";

function parsePropertyId(value: string): number | null {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const propertyId = parsePropertyId(id);
    if (propertyId == null) {
      throw new OrganizationAdminRequestError(400, "Invalid property id");
    }

    const { supabase } = await resolveOrganizationAdminRequestForProperty(
      request,
      propertyId
    );

    const property = await fetchAdminPropertyDetail(supabase, propertyId);
    if (!property) {
      throw new OrganizationAdminRequestError(404, "Property not found");
    }

    return NextResponse.json(property);
  } catch (error) {
    return organizationAdminErrorResponse(error);
  }
}
