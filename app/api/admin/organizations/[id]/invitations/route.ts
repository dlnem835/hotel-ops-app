import { NextResponse } from "next/server";
import {
  platformAdminErrorResponse,
  PlatformAdminRequestError,
  resolvePlatformAdminRequest,
} from "@/app/lib/platform-admin/server/resolve-platform-admin-request";
import {
  createAdministratorInvitation,
  fetchOrganizationInvitations,
} from "@/app/lib/platform-admin/server/create-gm-invitation";

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

    const invitations = await fetchOrganizationInvitations(supabase, organizationId);
    return NextResponse.json({ invitations });
  } catch (error) {
    return platformAdminErrorResponse(error);
  }
}

export async function POST(request: Request, context: RouteContext) {
  try {
    const { supabase, user } = await resolvePlatformAdminRequest(request);
    const { id } = await context.params;
    const organizationId = parseOrganizationId(id);

    if (organizationId == null) {
      throw new PlatformAdminRequestError(400, "Invalid organization id");
    }

    const body = (await request.json()) as Record<string, unknown>;
    // Platform Admins may set the One Eyrie-only Organization Administration entitlement.
    const invitation = await createAdministratorInvitation(
      supabase,
      user.id,
      organizationId,
      body,
      { allowOrgAdminEntitlement: true }
    );

    return NextResponse.json(invitation, { status: 201 });
  } catch (error) {
    return platformAdminErrorResponse(error);
  }
}
