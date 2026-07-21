import { NextResponse } from "next/server";
import {
  organizationAdminErrorResponse,
  OrganizationAdminRequestError,
  resolveOrganizationAdminRequest,
} from "@/app/lib/org-admin/server/resolve-organization-admin-request";
import { fetchAdminOrganizationDetail } from "@/app/lib/platform-admin/server/admin-organizations";
import { scopeOrganizationDetailToProperties } from "@/app/lib/org-admin/server/scope-organization-detail";

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

    const { supabase, orgWide, assignedPropertyIds } =
      await resolveOrganizationAdminRequest(request, organizationId);

    const organization = await fetchAdminOrganizationDetail(supabase, organizationId);
    if (!organization) {
      throw new OrganizationAdminRequestError(404, "Organization not found");
    }

    return NextResponse.json(
      orgWide
        ? organization
        : scopeOrganizationDetailToProperties(organization, assignedPropertyIds)
    );
  } catch (error) {
    return organizationAdminErrorResponse(error);
  }
}

/**
 * Organization profile editing is a One Eyrie Platform Administration function
 * (billing/contract/licensing integrity). Customer Admin Portal users may VIEW
 * the organization summary but never edit it — this route rejects all writes.
 * Edits are performed only via the internal /admin portal (/api/admin/*).
 */
export async function PATCH(request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const organizationId = parseOrganizationId(id);
    if (organizationId == null) {
      throw new OrganizationAdminRequestError(400, "Invalid organization id");
    }

    // Still require a valid Admin Portal session so we don't leak the boundary
    // to unauthenticated callers, then refuse the edit.
    await resolveOrganizationAdminRequest(request, organizationId);

    throw new OrganizationAdminRequestError(
      403,
      "Organization details are managed by One Eyrie and cannot be edited here"
    );
  } catch (error) {
    return organizationAdminErrorResponse(error);
  }
}
