import { NextResponse } from "next/server";
import {
  platformAdminErrorResponse,
  PlatformAdminRequestError,
  resolvePlatformAdminRequest,
} from "@/app/lib/platform-admin/server/resolve-platform-admin-request";
import {
  ADMINISTRATOR_INVITATION_ACTIONS,
  manageAdministratorInvitation,
  type AdministratorInvitationAction,
} from "@/app/lib/platform-admin/server/manage-administrator-invitation";
import {
  parseUpdateAdministratorInput,
  updateAdministrator,
} from "@/app/lib/platform-admin/server/update-administrator";

type RouteContext = {
  params: Promise<{ id: string; invitationId: string }>;
};

function parseOrganizationId(value: string): number | null {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

export async function POST(request: Request, context: RouteContext) {
  try {
    const { supabase, user, platformAdmin } = await resolvePlatformAdminRequest(request);
    const { id, invitationId } = await context.params;
    const organizationId = parseOrganizationId(id);

    if (organizationId == null) {
      throw new PlatformAdminRequestError(400, "Invalid organization id");
    }
    if (!invitationId) {
      throw new PlatformAdminRequestError(400, "Invalid invitation id");
    }

    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const action = String(body.action ?? "") as AdministratorInvitationAction;

    if (!ADMINISTRATOR_INVITATION_ACTIONS.includes(action)) {
      throw new PlatformAdminRequestError(400, "Unsupported action");
    }

    const confirmName =
      typeof body.confirmName === "string" ? body.confirmName : undefined;

    const invitation = await manageAdministratorInvitation(
      supabase,
      user.id,
      organizationId,
      invitationId,
      action,
      { platformAdmin, confirmName }
    );

    return NextResponse.json({ invitation });
  } catch (error) {
    return platformAdminErrorResponse(error);
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const { supabase, user } = await resolvePlatformAdminRequest(request);
    const { id, invitationId } = await context.params;
    const organizationId = parseOrganizationId(id);

    if (organizationId == null) {
      throw new PlatformAdminRequestError(400, "Invalid organization id");
    }
    if (!invitationId) {
      throw new PlatformAdminRequestError(400, "Invalid invitation id");
    }

    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const input = parseUpdateAdministratorInput(body);
    const invitation = await updateAdministrator(
      supabase,
      user.id,
      organizationId,
      invitationId,
      input
    );

    return NextResponse.json({ invitation });
  } catch (error) {
    return platformAdminErrorResponse(error);
  }
}
