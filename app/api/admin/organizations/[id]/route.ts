import { NextResponse } from "next/server";
import {
  platformAdminErrorResponse,
  PlatformAdminRequestError,
  resolvePlatformAdminRequest,
} from "@/app/lib/platform-admin/server/resolve-platform-admin-request";
import { fetchAdminOrganizationDetail } from "@/app/lib/platform-admin/server/admin-organizations";

function parseOrganizationId(value: string): number | null {
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
    const organizationId = parseOrganizationId(id);

    if (organizationId == null) {
      throw new PlatformAdminRequestError(400, "Invalid organization id");
    }

    const organization = await fetchAdminOrganizationDetail(supabase, organizationId);
    if (!organization) {
      throw new PlatformAdminRequestError(404, "Organization not found");
    }

    return NextResponse.json(organization);
  } catch (error) {
    return platformAdminErrorResponse(error);
  }
}
