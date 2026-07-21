import { NextResponse } from "next/server";
import {
  organizationAdminErrorResponse,
  OrganizationAdminRequestError,
  resolveOrganizationAdminRequest,
} from "@/app/lib/org-admin/server/resolve-organization-admin-request";
import { fetchAdminOrganizationDetail } from "@/app/lib/platform-admin/server/admin-organizations";
import { updateOrganizationProfileAsOrgAdmin } from "@/app/lib/org-admin/server/update-organization-profile";

function parseOrganizationId(value: string): number | null {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const organizationId = parseOrganizationId(id);
    if (organizationId == null) {
      throw new OrganizationAdminRequestError(400, "Invalid organization id");
    }

    const { supabase } = await resolveOrganizationAdminRequest(
      request,
      organizationId
    );

    const organization = await fetchAdminOrganizationDetail(supabase, organizationId);
    if (!organization) {
      throw new OrganizationAdminRequestError(404, "Organization not found");
    }

    return NextResponse.json(organization);
  } catch (error) {
    return organizationAdminErrorResponse(error);
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const organizationId = parseOrganizationId(id);
    if (organizationId == null) {
      throw new OrganizationAdminRequestError(400, "Invalid organization id");
    }

    const { supabase, user } = await resolveOrganizationAdminRequest(
      request,
      organizationId
    );

    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const organization = await updateOrganizationProfileAsOrgAdmin(
      supabase,
      user.id,
      organizationId,
      body
    );

    return NextResponse.json(organization);
  } catch (error) {
    return organizationAdminErrorResponse(error);
  }
}
