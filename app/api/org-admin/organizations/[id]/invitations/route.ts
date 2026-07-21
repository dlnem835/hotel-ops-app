import { NextResponse } from "next/server";
import {
  organizationAdminErrorResponse,
  OrganizationAdminRequestError,
  resolveOrganizationAdminRequest,
} from "@/app/lib/org-admin/server/resolve-organization-admin-request";
import {
  createAdministratorInvitation,
  fetchOrganizationInvitations,
} from "@/app/lib/platform-admin/server/create-gm-invitation";

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

    const invitations = await fetchOrganizationInvitations(supabase, organizationId);
    return NextResponse.json({ invitations });
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

    const { supabase, user } = await resolveOrganizationAdminRequest(
      request,
      organizationId
    );

    const body = (await request.json()) as Record<string, unknown>;
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
