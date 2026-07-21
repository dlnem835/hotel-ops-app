import { NextResponse } from "next/server";
import {
  organizationAdminErrorResponse,
  OrganizationAdminRequestError,
  rejectOrgAdminEntitlementField,
  resolveOrganizationAdminRequest,
} from "@/app/lib/org-admin/server/resolve-organization-admin-request";
import {
  createAdministratorInvitation,
  fetchOrganizationInvitations,
} from "@/app/lib/platform-admin/server/create-gm-invitation";
import { scopeInvitationsToProperties } from "@/app/lib/org-admin/server/scope-organization-detail";

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

    const invitations = await fetchOrganizationInvitations(supabase, organizationId);
    return NextResponse.json({
      invitations: orgWide
        ? invitations
        : scopeInvitationsToProperties(invitations, assignedPropertyIds),
    });
  } catch (error) {
    return organizationAdminErrorResponse(error);
  }
}

export async function POST(request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const organizationId = parseOrganizationId(id);
    if (organizationId == null) {
      throw new OrganizationAdminRequestError(400, "Invalid organization id");
    }

    const { supabase, user, orgWide, assignedPropertyIds } =
      await resolveOrganizationAdminRequest(request, organizationId);

    const body = (await request.json()) as Record<string, unknown>;
    // Customers may never grant the One Eyrie-only Organization Administration entitlement.
    rejectOrgAdminEntitlementField(body);

    // Selected-properties administrators may only invite into their own hotels.
    if (!orgWide) {
      const requested = Array.isArray(body.propertyIds ?? body.property_ids)
        ? (body.propertyIds ?? body.property_ids)
        : [];
      const ids = (requested as unknown[]).map((v) => Number.parseInt(String(v), 10));
      const single = Number.parseInt(
        String(body.propertyId ?? body.property_id ?? ""),
        10
      );
      const allRequested = [...ids, ...(Number.isInteger(single) ? [single] : [])];
      const outOfScope = allRequested.some(
        (id) => Number.isInteger(id) && !assignedPropertyIds.includes(id)
      );
      if (allRequested.length === 0 || outOfScope) {
        throw new OrganizationAdminRequestError(
          403,
          "You can only invite leaders to your assigned properties"
        );
      }
    }

    const invitation = await createAdministratorInvitation(
      supabase,
      user.id,
      organizationId,
      body
    );

    return NextResponse.json(invitation, { status: 201 });
  } catch (error) {
    return organizationAdminErrorResponse(error);
  }
}
