import type { SupabaseClient, User } from "@supabase/supabase-js";
import { writeAdminAuditLog } from "@/app/lib/platform-admin/server/admin-audit-log";
import { resolveGmModulePermissions } from "@/app/lib/platform-admin/server/gm-module-permissions";
import { PlatformAdminRequestError } from "@/app/lib/platform-admin/server/resolve-platform-admin-request";

type InvitationRow = {
  id: string;
  organization_id: number;
  property_id: number;
  email: string;
  first_name: string;
  last_name: string;
  org_role: string;
  property_role: string;
  job_title: string;
  status: string;
  auth_user_id: string | null;
};

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

async function loadEnabledOrganizationModuleKeys(
  supabase: SupabaseClient,
  organizationId: number
): Promise<string[]> {
  const { data, error } = await supabase
    .from("organization_modules")
    .select("module_key")
    .eq("organization_id", organizationId)
    .eq("enabled", true);

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []).map((row) => String(row.module_key));
}

async function findPendingInvitationForUser(
  supabase: SupabaseClient,
  user: User
): Promise<InvitationRow | null> {
  const metadataInvitationId = user.user_metadata?.oe_invitation_id;
  if (typeof metadataInvitationId === "string" && metadataInvitationId.trim()) {
    const { data, error } = await supabase
      .from("organization_invitations")
      .select(
        "id, organization_id, property_id, email, first_name, last_name, org_role, property_role, job_title, status, auth_user_id"
      )
      .eq("id", metadataInvitationId)
      .eq("status", "pending")
      .maybeSingle();

    if (error) {
      throw new Error(error.message);
    }
    if (data) {
      return data as InvitationRow;
    }
  }

  const email = user.email ? normalizeEmail(user.email) : null;
  if (!email) {
    return null;
  }

  const { data, error } = await supabase
    .from("organization_invitations")
    .select(
      "id, organization_id, property_id, email, first_name, last_name, org_role, property_role, job_title, status, auth_user_id"
    )
    .eq("status", "pending")
    .eq("email", email)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return (data as InvitationRow | null) ?? null;
}

export type CompleteGmInvitationResult = {
  completed: boolean;
  invitationId: string | null;
  organizationId: number | null;
  propertyId: number | null;
};

export async function completeGmInvitationForUser(
  supabase: SupabaseClient,
  user: User
): Promise<CompleteGmInvitationResult> {
  const invitation = await findPendingInvitationForUser(supabase, user);
  if (!invitation) {
    return {
      completed: false,
      invitationId: null,
      organizationId: null,
      propertyId: null,
    };
  }

  if (
    invitation.auth_user_id &&
    invitation.auth_user_id !== user.id
  ) {
    throw new PlatformAdminRequestError(
      403,
      "Invitation is assigned to a different user"
    );
  }

  const userEmail = user.email ? normalizeEmail(user.email) : null;
  if (userEmail && normalizeEmail(invitation.email) !== userEmail) {
    throw new PlatformAdminRequestError(
      403,
      "Invitation email does not match signed-in user"
    );
  }

  const enabledModuleKeys = await loadEnabledOrganizationModuleKeys(
    supabase,
    invitation.organization_id
  );
  const modulePermissions = resolveGmModulePermissions(enabledModuleKeys);

  const { data: existingTeamMember, error: existingTeamMemberError } = await supabase
    .from("team_members")
    .select("id")
    .eq("auth_user_id", user.id)
    .eq("organization_id", invitation.organization_id)
    .eq("property_id", invitation.property_id)
    .maybeSingle();

  if (existingTeamMemberError) {
    throw new Error(existingTeamMemberError.message);
  }

  if (!existingTeamMember) {
    const { error: teamMemberError } = await supabase.from("team_members").insert({
      first_name: invitation.first_name,
      last_name: invitation.last_name,
      email: invitation.email,
      phone: "",
      department: null,
      job_title: invitation.job_title,
      role: invitation.job_title,
      is_administrator: true,
      module_permissions: modulePermissions,
      status: "Active",
      can_login: true,
      username: null,
      auth_email: invitation.email,
      auth_user_id: user.id,
      organization_id: invitation.organization_id,
      property_id: invitation.property_id,
      default_property_id: invitation.property_id,
    });

    if (teamMemberError) {
      throw new Error(teamMemberError.message);
    }
  }

  const { error: orgUserError } = await supabase.from("organization_users").upsert(
    {
      organization_id: invitation.organization_id,
      user_id: user.id,
      role: invitation.org_role,
      active: true,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "organization_id,user_id" }
  );

  if (orgUserError) {
    throw new Error(orgUserError.message);
  }

  const { error: propertyUserError } = await supabase.from("user_properties").upsert(
    {
      user_id: user.id,
      property_id: invitation.property_id,
      role: invitation.property_role,
      is_default: true,
      active: true,
      module_permissions: modulePermissions,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id,property_id" }
  );

  if (propertyUserError) {
    throw new Error(propertyUserError.message);
  }

  const acceptedAt = new Date().toISOString();
  const { error: invitationUpdateError } = await supabase
    .from("organization_invitations")
    .update({
      status: "accepted",
      auth_user_id: user.id,
      accepted_at: acceptedAt,
      updated_at: acceptedAt,
    })
    .eq("id", invitation.id)
    .eq("status", "pending");

  if (invitationUpdateError) {
    throw new Error(invitationUpdateError.message);
  }

  await writeAdminAuditLog(supabase, {
    actorUserId: user.id,
    action: "invitation.accepted",
    targetType: "organization_invitation",
    targetId: invitation.id,
    organizationId: invitation.organization_id,
    propertyId: invitation.property_id,
    metadata: {
      email: invitation.email,
      firstName: invitation.first_name,
      lastName: invitation.last_name,
    },
  });

  return {
    completed: true,
    invitationId: invitation.id,
    organizationId: invitation.organization_id,
    propertyId: invitation.property_id,
  };
}
