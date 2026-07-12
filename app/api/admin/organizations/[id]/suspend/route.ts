import { NextResponse } from "next/server";
import {
  platformAdminErrorResponse,
  PlatformAdminRequestError,
  resolvePlatformAdminRequest,
} from "@/app/lib/platform-admin/server/resolve-platform-admin-request";
import { suspendAdminOrganization } from "@/app/lib/platform-admin/server/organization-lifecycle";

type RouteContext = {
  params: Promise<{ id: string }>;
};

function parseOrganizationId(value: string): number | null {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

export async function POST(request: Request, context: RouteContext) {
  try {
    const { supabase, user } = await resolvePlatformAdminRequest(request);
    const { id } = await context.params;
    const organizationId = parseOrganizationId(id);

    if (organizationId == null) {
      throw new PlatformAdminRequestError(400, "Invalid organization id");
    }

    const organization = await suspendAdminOrganization(supabase, user.id, organizationId);
    return NextResponse.json(organization);
  } catch (error) {
    return platformAdminErrorResponse(error);
  }
}
