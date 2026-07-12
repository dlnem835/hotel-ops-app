import { NextResponse } from "next/server";
import {
  platformAdminErrorResponse,
  PlatformAdminRequestError,
  resolvePlatformAdminRequest,
} from "@/app/lib/platform-admin/server/resolve-platform-admin-request";
import { fetchAdminOrganizationDetail } from "@/app/lib/platform-admin/server/admin-organizations";
import { deleteTestAdminOrganization } from "@/app/lib/platform-admin/server/organization-lifecycle";

function parseOrganizationId(value: string): number | null {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(request: Request, context: RouteContext) {
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

export async function DELETE(request: Request, context: RouteContext) {
  try {
    const { supabase, user, platformAdmin } = await resolvePlatformAdminRequest(request);
    const { id } = await context.params;
    const organizationId = parseOrganizationId(id);

    if (organizationId == null) {
      throw new PlatformAdminRequestError(400, "Invalid organization id");
    }

    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const confirmName = String(body.confirmName ?? "");

    await deleteTestAdminOrganization(
      supabase,
      user.id,
      platformAdmin,
      organizationId,
      confirmName
    );

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return platformAdminErrorResponse(error);
  }
}
