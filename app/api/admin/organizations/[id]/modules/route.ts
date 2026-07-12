import { NextResponse } from "next/server";
import {
  platformAdminErrorResponse,
  PlatformAdminRequestError,
  resolvePlatformAdminRequest,
} from "@/app/lib/platform-admin/server/resolve-platform-admin-request";
import {
  fetchOrganizationModules,
  parseOrganizationModuleUpdates,
  updateOrganizationModules,
} from "@/app/lib/platform-admin/server/organization-modules";

type RouteContext = {
  params: Promise<{ id: string }>;
};

function parseOrganizationId(value: string): number | null {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

export async function GET(request: Request, context: RouteContext) {
  try {
    const { supabase } = await resolvePlatformAdminRequest(request);
    const { id } = await context.params;
    const organizationId = parseOrganizationId(id);

    if (organizationId == null) {
      throw new PlatformAdminRequestError(400, "Invalid organization id");
    }

    const { data: organization, error: orgError } = await supabase
      .from("organizations")
      .select("id")
      .eq("id", organizationId)
      .maybeSingle();

    if (orgError) {
      throw new Error(orgError.message);
    }
    if (!organization) {
      throw new PlatformAdminRequestError(404, "Organization not found");
    }

    const modules = await fetchOrganizationModules(supabase, organizationId);
    return NextResponse.json({ modules });
  } catch (error) {
    return platformAdminErrorResponse(error);
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const { supabase, user } = await resolvePlatformAdminRequest(request);
    const { id } = await context.params;
    const organizationId = parseOrganizationId(id);

    if (organizationId == null) {
      throw new PlatformAdminRequestError(400, "Invalid organization id");
    }

    const body = (await request.json()) as Record<string, unknown>;
    const updates = parseOrganizationModuleUpdates(body);
    const modules = await updateOrganizationModules(
      supabase,
      user.id,
      organizationId,
      updates
    );

    return NextResponse.json({ modules });
  } catch (error) {
    return platformAdminErrorResponse(error);
  }
}
