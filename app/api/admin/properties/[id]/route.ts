import { NextResponse } from "next/server";
import {
  platformAdminErrorResponse,
  PlatformAdminRequestError,
  resolvePlatformAdminRequest,
} from "@/app/lib/platform-admin/server/resolve-platform-admin-request";
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
    const { supabase } = await resolvePlatformAdminRequest(request);
    const { id } = await context.params;
    const propertyId = parsePropertyId(id);

    if (propertyId == null) {
      throw new PlatformAdminRequestError(400, "Invalid property id");
    }

    const property = await fetchAdminPropertyDetail(supabase, propertyId);
    if (!property) {
      throw new PlatformAdminRequestError(404, "Property not found");
    }

    return NextResponse.json(property);
  } catch (error) {
    return platformAdminErrorResponse(error);
  }
}
