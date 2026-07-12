import { NextResponse } from "next/server";
import {
  assertCanManageTeamMembers,
  updateTeamMember,
  type TeamMemberInput,
} from "@/app/settings/lib/team-members-db";
import {
  resolveTenantRequest,
  tenantErrorResponse,
} from "@/app/lib/tenant/server/resolve-tenant-request";

function parseTeamMemberInput(body: Record<string, unknown>): TeamMemberInput {
  const jobTitle = String(body.job_title || body.role || "").trim();

  return {
    first_name: String(body.first_name || ""),
    last_name: String(body.last_name || ""),
    email: String(body.email || ""),
    phone: String(body.phone || ""),
    department:
      body.department === undefined
        ? undefined
        : body.department == null
          ? null
          : String(body.department),
    job_title: jobTitle,
    is_administrator: Boolean(body.is_administrator),
    module_permissions:
      (body.module_permissions as Record<string, boolean> | undefined) ?? {},
    status: String(body.status || "Active"),
    can_login: Boolean(body.can_login),
    username: String(body.username || ""),
    tempPassword: String(body.tempPassword || ""),
  };
}

export async function PATCH(request: Request) {
  try {
    const { supabase, user, organizationId, propertyId } =
      await resolveTenantRequest(request);
    const scope = { organizationId, propertyId };
    await assertCanManageTeamMembers(supabase, user.id, scope);

    const body = (await request.json()) as Record<string, unknown>;
    const teamMemberId = String(body.id ?? "").trim();

    if (!teamMemberId) {
      return NextResponse.json({ error: "User id is required" }, { status: 400 });
    }

    const input = parseTeamMemberInput(body);
    const member = await updateTeamMember(supabase, scope, teamMemberId, input);

    return NextResponse.json({ user: member });
  } catch (error: unknown) {
    return tenantErrorResponse(error);
  }
}
