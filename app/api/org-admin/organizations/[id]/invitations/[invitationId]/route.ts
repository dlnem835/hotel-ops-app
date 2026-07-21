import { NextResponse } from "next/server";
import {
  organizationAdminErrorResponse,
  OrganizationAdminRequestError,
  resolveOrganizationAdminRequest,
} from "@/app/lib/org-admin/server/resolve-organization-admin-request";
import { manageAdministratorInvitation } from "@/app/lib/platform-admin/server/manage-administrator-invitation";
import {
  isOrganizationAdminInvitationAction,
  ORGANIZATION_ADMIN_ACTION_CAPABILITIES,
} from "@/app/lib/org-admin/server/org-admin-capabilities";
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
    const { id, invitationId } = await context.params;
    const organizationId = parseOrganizationId(id);
    if (organizationId == null) {
      throw new OrganizationAdminRequestError(400, "Invalid organization id");
    }
    if (!invitationId) {
      throw new OrganizationAdminRequestError(400, "Invalid invitation id");
    }

    const { supabase, user } = await resolveOrganizationAdminRequest(
      request,
      organizationId
    );

    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const action = String(body.action ?? "");

    // Customers may only perform people-management actions. Provisioning and
    // platform-only actions (transfer, permanent delete, dismiss) are rejected.
    if (!isOrganizationAdminInvitationAction(action)) {
      throw new OrganizationAdminRequestError(
        403,
        "This action is not available to organization administrators"
      );
    }

    const confirmName =
      typeof body.confirmName === "string" ? body.confirmName : undefined;
    const newEmail = typeof body.newEmail === "string" ? body.newEmail : undefined;

    const result = await manageAdministratorInvitation(
      supabase,
      user.id,
      organizationId,
      invitationId,
      action,
      {
        actor: ORGANIZATION_ADMIN_ACTION_CAPABILITIES,
        confirmName,
        newEmail,
      }
    );

    if (action === "change_email") {
      return NextResponse.json({
        success: true as const,
        email: result.email ?? null,
        invitation: result.invitation,
        message: result.message ?? null,
      });
    }

    return NextResponse.json({
      invitation: result.invitation,
      ...(result.message ? { message: result.message } : {}),
    });
  } catch (error) {
    if (error instanceof OrganizationAdminRequestError) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: error.status }
      );
    }
    return organizationAdminErrorResponse(error);
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const { id, invitationId } = await context.params;
    const organizationId = parseOrganizationId(id);
    if (organizationId == null) {
      throw new OrganizationAdminRequestError(400, "Invalid organization id");
    }
    if (!invitationId) {
      throw new OrganizationAdminRequestError(400, "Invalid invitation id");
    }

    const { supabase, user } = await resolveOrganizationAdminRequest(
      request,
      organizationId
    );

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
    return organizationAdminErrorResponse(error);
  }
}
