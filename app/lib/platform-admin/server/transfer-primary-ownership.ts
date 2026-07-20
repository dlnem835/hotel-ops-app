import type { SupabaseClient } from "@supabase/supabase-js";
import { writeAdminAuditLog } from "@/app/lib/platform-admin/server/admin-audit-log";
import { PlatformAdminRequestError } from "@/app/lib/platform-admin/server/resolve-platform-admin-request";
import { fetchOrganizationInvitations } from "@/app/lib/platform-admin/server/create-gm-invitation";
import { getAccountSetupState } from "@/app/lib/account-setup/server/account-setup-state";
import { isOrgWideRole, ORG_ROLE } from "@/app/lib/platform-admin/roles";
import type {
  AdminOrganizationInvitation,
  PlatformAdminRecord,
  TransferOwnershipSuccessor,
} from "@/app/lib/platform-admin/types";
import { TRANSFER_OWNERSHIP_CONFIRM_PHRASE } from "@/app/lib/platform-admin/types";

export { TRANSFER_OWNERSHIP_CONFIRM_PHRASE };

export const TRANSFER_OWNERSHIP_SUCCESS_MESSAGE =
  "Primary ownership transferred successfully.";

export type { TransferOwnershipSuccessor };

function assertPlatformOwner(platformAdmin: PlatformAdminRecord): void {
  if (platformAdmin.role !== "platform_owner") {
    throw new PlatformAdminRequestError(
      403,
      "Forbidden — platform owner access required"
    );
  }
}

/**
 * Eligible successors: accepted, active, org-wide (not Primary), setup complete,
 * linked Auth user, same organization.
 */
export async function listPrimaryOwnershipSuccessors(
  supabase: SupabaseClient,
  organizationId: number
): Promise<TransferOwnershipSuccessor[]> {
  const invitations = await fetchOrganizationInvitations(supabase, organizationId);
  const candidates = invitations.filter(
    (row) =>
      row.status === "accepted" &&
      !row.isPrimary &&
      row.active !== false &&
      Boolean(row.authUserId) &&
      isOrgWideRole(row.orgRole)
  );

  const eligible: TransferOwnershipSuccessor[] = [];
  for (const row of candidates) {
    const authUserId = row.authUserId as string;
    const setup = await getAccountSetupState(authUserId, supabase);
    if (setup.incomplete) continue;

    const { data: authData, error: authError } =
      await supabase.auth.admin.getUserById(authUserId);
    if (authError || !authData.user) continue;
    if (authData.user.banned_until) {
      const bannedUntil = new Date(authData.user.banned_until).getTime();
      if (Number.isFinite(bannedUntil) && bannedUntil > Date.now()) continue;
    }

    eligible.push({
      invitationId: row.id,
      authUserId,
      firstName: row.firstName,
      lastName: row.lastName,
      email: row.email,
      username: row.username,
      roleLabel: row.roleLabel,
      jobTitle: row.jobTitle,
      status: row.active === false ? "disabled" : row.status,
    });
  }

  return eligible.sort((a, b) =>
    `${a.lastName} ${a.firstName}`.localeCompare(`${b.lastName} ${b.firstName}`)
  );
}

async function loadPrimaryInvitation(
  supabase: SupabaseClient,
  organizationId: number
): Promise<{
  id: string;
  auth_user_id: string;
  email: string;
  first_name: string;
  last_name: string;
}> {
  const { data, error } = await supabase
    .from("organization_invitations")
    .select("id, auth_user_id, email, first_name, last_name, status, is_primary")
    .eq("organization_id", organizationId)
    .eq("is_primary", true)
    .eq("status", "accepted")
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data?.auth_user_id) {
    throw new PlatformAdminRequestError(
      409,
      "This organization does not have an accepted Primary Owner"
    );
  }

  return {
    id: String(data.id),
    auth_user_id: String(data.auth_user_id),
    email: String(data.email),
    first_name: String(data.first_name),
    last_name: String(data.last_name),
  };
}

/**
 * Atomically transfer Primary Owner designation to an eligible org-wide admin.
 * Former owner becomes Organization Admin (org_admin) and keeps org-wide access.
 */
export async function transferPrimaryOwnership(
  supabase: SupabaseClient,
  actorUserId: string,
  platformAdmin: PlatformAdminRecord,
  organizationId: number,
  successorInvitationId: string,
  confirmPhrase: string | undefined
): Promise<{
  message: string;
  previousOwner: AdminOrganizationInvitation | null;
  newOwner: AdminOrganizationInvitation | null;
}> {
  assertPlatformOwner(platformAdmin);

  if ((confirmPhrase ?? "").trim() !== TRANSFER_OWNERSHIP_CONFIRM_PHRASE) {
    throw new PlatformAdminRequestError(
      400,
      `Type ${TRANSFER_OWNERSHIP_CONFIRM_PHRASE} to confirm`
    );
  }

  const primary = await loadPrimaryInvitation(supabase, organizationId);
  const successors = await listPrimaryOwnershipSuccessors(supabase, organizationId);
  const successor = successors.find((row) => row.invitationId === successorInvitationId);

  if (!successor) {
    throw new PlatformAdminRequestError(
      409,
      "Selected successor is not eligible for Primary Ownership"
    );
  }

  if (successor.authUserId === primary.auth_user_id) {
    throw new PlatformAdminRequestError(
      409,
      "Successor is already the Primary Owner"
    );
  }

  const timestamp = new Date().toISOString();

  // Clear current primary first so the unique primary invariant holds.
  const { error: demoteInviteError } = await supabase
    .from("organization_invitations")
    .update({
      is_primary: false,
      org_role: ORG_ROLE.organizationAdmin,
      updated_at: timestamp,
    })
    .eq("id", primary.id)
    .eq("is_primary", true)
    .eq("status", "accepted");

  if (demoteInviteError) {
    throw new PlatformAdminRequestError(
      500,
      `Failed to demote current Primary Owner: ${demoteInviteError.message}`
    );
  }

  const { error: demoteMembershipError } = await supabase
    .from("organization_users")
    .update({
      role: ORG_ROLE.organizationAdmin,
      active: true,
      updated_at: timestamp,
    })
    .eq("organization_id", organizationId)
    .eq("user_id", primary.auth_user_id);

  if (demoteMembershipError) {
    // Best-effort rollback of invitation flag.
    await supabase
      .from("organization_invitations")
      .update({
        is_primary: true,
        org_role: ORG_ROLE.primaryOwner,
        updated_at: timestamp,
      })
      .eq("id", primary.id);
    throw new PlatformAdminRequestError(
      500,
      `Failed to update former owner membership: ${demoteMembershipError.message}`
    );
  }

  const { data: promoted, error: promoteInviteError } = await supabase
    .from("organization_invitations")
    .update({
      is_primary: true,
      org_role: ORG_ROLE.primaryOwner,
      updated_at: timestamp,
    })
    .eq("id", successor.invitationId)
    .eq("organization_id", organizationId)
    .eq("status", "accepted")
    .eq("is_primary", false)
    .select("id")
    .maybeSingle();

  if (promoteInviteError || !promoted) {
    await supabase
      .from("organization_invitations")
      .update({
        is_primary: true,
        org_role: ORG_ROLE.primaryOwner,
        updated_at: timestamp,
      })
      .eq("id", primary.id);
    await supabase
      .from("organization_users")
      .update({
        role: ORG_ROLE.primaryOwner,
        updated_at: timestamp,
      })
      .eq("organization_id", organizationId)
      .eq("user_id", primary.auth_user_id);
    throw new PlatformAdminRequestError(
      500,
      `Failed to promote successor: ${promoteInviteError?.message ?? "invitation not updated"}`
    );
  }

  const { error: promoteMembershipError } = await supabase
    .from("organization_users")
    .upsert(
      {
        organization_id: organizationId,
        user_id: successor.authUserId,
        role: ORG_ROLE.primaryOwner,
        active: true,
        updated_at: timestamp,
      },
      { onConflict: "organization_id,user_id" }
    );

  if (promoteMembershipError) {
    throw new PlatformAdminRequestError(
      500,
      `Successor promoted on invitation but membership update failed: ${promoteMembershipError.message}`
    );
  }

  // Fail closed: exactly one accepted primary must remain.
  const { count: primaryCount, error: countError } = await supabase
    .from("organization_invitations")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", organizationId)
    .eq("is_primary", true)
    .eq("status", "accepted");

  if (countError) {
    throw new Error(countError.message);
  }
  if ((primaryCount ?? 0) !== 1) {
    throw new PlatformAdminRequestError(
      500,
      `Ownership transfer left the organization with ${primaryCount ?? 0} Primary Owners`
    );
  }

  await writeAdminAuditLog(supabase, {
    actorUserId,
    action: "administrator.primary_ownership_transferred",
    targetType: "organization",
    targetId: String(organizationId),
    organizationId,
    propertyId: null,
    metadata: {
      organization_id: organizationId,
      previous_owner_user_id: primary.auth_user_id,
      previous_owner_invitation_id: primary.id,
      previous_owner_email: primary.email,
      new_owner_user_id: successor.authUserId,
      new_owner_invitation_id: successor.invitationId,
      new_owner_email: successor.email,
      transferred_by: actorUserId,
      transferred_at: timestamp,
    },
  });

  const invitations = await fetchOrganizationInvitations(supabase, organizationId);
  return {
    message: TRANSFER_OWNERSHIP_SUCCESS_MESSAGE,
    previousOwner: invitations.find((row) => row.id === primary.id) ?? null,
    newOwner: invitations.find((row) => row.id === successor.invitationId) ?? null,
  };
}
