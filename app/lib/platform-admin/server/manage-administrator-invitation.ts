import type { SupabaseClient } from "@supabase/supabase-js";
import { writeAdminAuditLog } from "@/app/lib/platform-admin/server/admin-audit-log";
import { PlatformAdminRequestError } from "@/app/lib/platform-admin/server/resolve-platform-admin-request";
import {
  fetchOrganizationInvitations,
} from "@/app/lib/platform-admin/server/create-gm-invitation";
import {
  inviteUserOrGenerateLink,
  sendPasswordResetOrGenerateLink,
} from "@/app/lib/platform-admin/server/auth-email-dispatch";
import {
  resolveInviteRedirectUrl,
  resolvePasswordResetRedirectUrl,
} from "@/app/lib/email/auth-email-config";
import type {
  AdminOrganizationInvitation,
  PlatformAdminRecord,
} from "@/app/lib/platform-admin/types";

const INVITATION_TTL_DAYS = 7;

export type AdministratorInvitationAction =
  | "resend"
  | "cancel"
  | "disable"
  | "enable"
  | "remove"
  | "send_password_reset"
  | "change_email";

export const ADMINISTRATOR_INVITATION_ACTIONS: AdministratorInvitationAction[] = [
  "resend",
  "cancel",
  "disable",
  "enable",
  "remove",
  "send_password_reset",
  "change_email",
];

type ManageInvitationRow = {
  id: string;
  organization_id: number;
  property_id: number;
  email: string;
  first_name: string;
  last_name: string;
  job_title: string;
  status: string;
  is_primary: boolean | null;
  auth_user_id: string | null;
  org_role: string | null;
};

type OrgUserSnapshot = {
  user_id: string;
  organization_id: number;
  role: string;
  active: boolean;
};

type UserPropertySnapshot = {
  user_id: string;
  property_id: number;
  role: string;
  is_default: boolean;
  active: boolean;
  module_permissions: Record<string, boolean> | null;
};

type TeamMemberSnapshot = {
  id: string;
  status: string | null;
  can_login: boolean | null;
};

type RemoveMembershipSnapshot = {
  invitationStatus: string;
  orgUser: OrgUserSnapshot | null;
  userProperties: UserPropertySnapshot[];
  teamMembers: TeamMemberSnapshot[];
};

export type ManageAdministratorInvitationOptions = {
  platformAdmin: PlatformAdminRecord;
  confirmName?: string;
  /** Required for `change_email` — normalized before use. */
  newEmail?: string;
};

export type ManageAdministratorInvitationResult = {
  invitation: AdminOrganizationInvitation | null;
  message?: string;
  /** Normalized email after a successful `change_email`. */
  email?: string;
};

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const CHANGE_EMAIL_SUCCESS_MESSAGE =
  "Email updated. Future invitations and password resets will be sent to the new address.";

function emailDomainForAudit(email: string): string {
  const at = email.lastIndexOf("@");
  if (at < 0) return "(invalid)";
  return email.slice(at + 1).toLowerCase();
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function administratorDisplayName(invitation: ManageInvitationRow): string {
  return `${invitation.first_name} ${invitation.last_name}`.trim();
}

function formatInvitationExpirationDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "7 days";
  return date.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

async function loadInvitation(
  supabase: SupabaseClient,
  organizationId: number,
  invitationId: string
): Promise<ManageInvitationRow> {
  const { data, error } = await supabase
    .from("organization_invitations")
    .select(
      "id, organization_id, property_id, email, first_name, last_name, job_title, status, is_primary, auth_user_id, org_role"
    )
    .eq("id", invitationId)
    .eq("organization_id", organizationId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }
  if (!data) {
    throw new PlatformAdminRequestError(404, "Invitation not found");
  }
  return data as ManageInvitationRow;
}

async function organizationPropertyIds(
  supabase: SupabaseClient,
  organizationId: number
): Promise<number[]> {
  const { data, error } = await supabase
    .from("properties")
    .select("id")
    .eq("organization_id", organizationId);

  if (error) {
    throw new Error(error.message);
  }
  return (data ?? []).map((row) => row.id as number);
}

/** Flips membership access on/off for an accepted administrator within one org. */
async function setMembershipActive(
  supabase: SupabaseClient,
  organizationId: number,
  authUserId: string,
  active: boolean
): Promise<void> {
  const timestamp = new Date().toISOString();

  const { error: orgUserError } = await supabase
    .from("organization_users")
    .update({ active, updated_at: timestamp })
    .eq("organization_id", organizationId)
    .eq("user_id", authUserId);

  if (orgUserError) {
    throw new Error(orgUserError.message);
  }

  const propertyIds = await organizationPropertyIds(supabase, organizationId);
  if (propertyIds.length > 0) {
    const { error: propertyError } = await supabase
      .from("user_properties")
      .update({ active, updated_at: timestamp })
      .eq("user_id", authUserId)
      .in("property_id", propertyIds);

    if (propertyError) {
      throw new Error(propertyError.message);
    }
  }

  const { error: teamMemberError } = await supabase
    .from("team_members")
    .update({
      status: active ? "Active" : "Inactive",
      can_login: active,
    })
    .eq("auth_user_id", authUserId)
    .eq("organization_id", organizationId);

  if (teamMemberError) {
    throw new Error(teamMemberError.message);
  }
}

function assertPending(invitation: ManageInvitationRow, verb: string): void {
  if (invitation.status !== "pending" && invitation.status !== "expired") {
    throw new PlatformAdminRequestError(
      409,
      `Only pending invitations can be ${verb}`
    );
  }
}

function assertAccepted(invitation: ManageInvitationRow, verb: string): void {
  if (invitation.status !== "accepted") {
    throw new PlatformAdminRequestError(
      409,
      `Only accepted administrators can be ${verb}`
    );
  }
}

function assertNotPrimary(invitation: ManageInvitationRow, verb: string): void {
  if (invitation.is_primary) {
    throw new PlatformAdminRequestError(
      409,
      `The Primary Owner cannot be ${verb}. Transfer ownership required.`
    );
  }
}

function assertNotSelfTarget(
  invitation: ManageInvitationRow,
  actorUserId: string,
  verb: string
): void {
  if (invitation.auth_user_id && invitation.auth_user_id === actorUserId) {
    throw new PlatformAdminRequestError(
      403,
      `You cannot ${verb} your own administrator access through this workflow`
    );
  }
}

function assertPlatformOwner(platformAdmin: PlatformAdminRecord): void {
  if (platformAdmin.role !== "platform_owner") {
    throw new PlatformAdminRequestError(
      403,
      "Forbidden — platform owner access required"
    );
  }
}

/**
 * Fail closed unless a valid accepted Primary Owner membership remains for the
 * organization. Used before and after removal so a last org-level admin cannot
 * be stripped when Primary Owner membership is missing or inconsistent.
 */
async function assertValidPrimaryOwnerRemains(
  supabase: SupabaseClient,
  organizationId: number,
  removingInvitationId: string
): Promise<void> {
  const { data: primaryInvitation, error: primaryError } = await supabase
    .from("organization_invitations")
    .select("id, auth_user_id, status, is_primary")
    .eq("organization_id", organizationId)
    .eq("is_primary", true)
    .eq("status", "accepted")
    .maybeSingle();

  if (primaryError) {
    throw new Error(primaryError.message);
  }

  if (
    !primaryInvitation ||
    primaryInvitation.id === removingInvitationId ||
    !primaryInvitation.auth_user_id
  ) {
    throw new PlatformAdminRequestError(
      409,
      "Cannot remove the last eligible organization-level administrator without a valid Primary Owner"
    );
  }

  const { data: primaryOrgUser, error: orgUserError } = await supabase
    .from("organization_users")
    .select("user_id, role, active")
    .eq("organization_id", organizationId)
    .eq("user_id", primaryInvitation.auth_user_id)
    .maybeSingle();

  if (orgUserError) {
    throw new Error(orgUserError.message);
  }

  if (
    !primaryOrgUser ||
    !primaryOrgUser.active ||
    String(primaryOrgUser.role) !== "org_owner"
  ) {
    throw new PlatformAdminRequestError(
      409,
      "Cannot remove administrator — Primary Owner membership is missing or inactive"
    );
  }
}

async function assertRemovalEligibility(
  supabase: SupabaseClient,
  organizationId: number,
  invitation: ManageInvitationRow
): Promise<void> {
  assertNotPrimary(invitation, "removed");
  await assertValidPrimaryOwnerRemains(supabase, organizationId, invitation.id);

  if (!invitation.auth_user_id) {
    throw new PlatformAdminRequestError(409, "Administrator has no linked account");
  }

  const { data: targetOrgUser, error: targetError } = await supabase
    .from("organization_users")
    .select("user_id, role, active")
    .eq("organization_id", organizationId)
    .eq("user_id", invitation.auth_user_id)
    .maybeSingle();

  if (targetError) {
    throw new Error(targetError.message);
  }

  if (!targetOrgUser) {
    throw new PlatformAdminRequestError(
      409,
      "Cannot remove administrator — organization membership is missing"
    );
  }
}

async function captureRemoveSnapshot(
  supabase: SupabaseClient,
  organizationId: number,
  authUserId: string,
  invitationStatus: string,
  propertyIds: number[]
): Promise<RemoveMembershipSnapshot> {
  const { data: orgUser, error: orgUserError } = await supabase
    .from("organization_users")
    .select("user_id, organization_id, role, active")
    .eq("organization_id", organizationId)
    .eq("user_id", authUserId)
    .maybeSingle();

  if (orgUserError) {
    throw new Error(orgUserError.message);
  }

  let userProperties: UserPropertySnapshot[] = [];
  if (propertyIds.length > 0) {
    const { data, error } = await supabase
      .from("user_properties")
      .select("user_id, property_id, role, is_default, active, module_permissions")
      .eq("user_id", authUserId)
      .in("property_id", propertyIds);

    if (error) {
      throw new Error(error.message);
    }
    userProperties = (data ?? []) as UserPropertySnapshot[];
  }

  const { data: teamMembers, error: teamError } = await supabase
    .from("team_members")
    .select("id, status, can_login")
    .eq("auth_user_id", authUserId)
    .eq("organization_id", organizationId);

  if (teamError) {
    throw new Error(teamError.message);
  }

  return {
    invitationStatus,
    orgUser: orgUser
      ? {
          user_id: String(orgUser.user_id),
          organization_id: Number(orgUser.organization_id),
          role: String(orgUser.role),
          active: Boolean(orgUser.active),
        }
      : null,
    userProperties,
    teamMembers: (teamMembers ?? []).map((row) => ({
      id: String(row.id),
      status: row.status == null ? null : String(row.status),
      can_login: row.can_login == null ? null : Boolean(row.can_login),
    })),
  };
}

async function restoreRemoveSnapshot(
  supabase: SupabaseClient,
  invitationId: string,
  authUserId: string,
  snapshot: RemoveMembershipSnapshot
): Promise<void> {
  const timestamp = new Date().toISOString();

  await supabase
    .from("organization_invitations")
    .update({ status: snapshot.invitationStatus, updated_at: timestamp })
    .eq("id", invitationId);

  if (snapshot.orgUser) {
    await supabase.from("organization_users").upsert(
      {
        user_id: snapshot.orgUser.user_id,
        organization_id: snapshot.orgUser.organization_id,
        role: snapshot.orgUser.role,
        active: snapshot.orgUser.active,
        updated_at: timestamp,
      },
      { onConflict: "organization_id,user_id" }
    );
  }

  for (const row of snapshot.userProperties) {
    await supabase.from("user_properties").upsert(
      {
        user_id: row.user_id,
        property_id: row.property_id,
        role: row.role,
        is_default: row.is_default,
        active: row.active,
        module_permissions: row.module_permissions,
        updated_at: timestamp,
      },
      { onConflict: "user_id,property_id" }
    );
  }

  for (const member of snapshot.teamMembers) {
    await supabase
      .from("team_members")
      .update({
        status: member.status,
        can_login: member.can_login,
      })
      .eq("id", member.id)
      .eq("auth_user_id", authUserId);
  }
}

/**
 * Permanently revoke hotel organization access for an accepted administrator.
 * Deletes org/property memberships for this organization only, deactivates
 * related team_members admin login, and leaves Auth users intact (account
 * deletion is a separate future workflow).
 */
async function permanentlyRemoveAdministrator(
  supabase: SupabaseClient,
  actorUserId: string,
  organizationId: number,
  invitation: ManageInvitationRow,
  confirmName: string | undefined
): Promise<void> {
  const trimmedConfirm = (confirmName ?? "").trim();
  const expectedName = administratorDisplayName(invitation);

  if (!trimmedConfirm) {
    throw new PlatformAdminRequestError(
      400,
      "Administrator name confirmation is required"
    );
  }

  if (trimmedConfirm !== expectedName) {
    throw new PlatformAdminRequestError(
      400,
      "Administrator name confirmation does not match"
    );
  }

  await assertRemovalEligibility(supabase, organizationId, invitation);

  const authUserId = invitation.auth_user_id as string;
  const propertyIds = await organizationPropertyIds(supabase, organizationId);
  const snapshot = await captureRemoveSnapshot(
    supabase,
    organizationId,
    authUserId,
    invitation.status,
    propertyIds
  );
  const timestamp = new Date().toISOString();

  try {
    if (propertyIds.length > 0) {
      const { error: propertyDeleteError } = await supabase
        .from("user_properties")
        .delete()
        .eq("user_id", authUserId)
        .in("property_id", propertyIds);

      if (propertyDeleteError) {
        throw new Error(propertyDeleteError.message);
      }
    }

    const { error: orgUserDeleteError } = await supabase
      .from("organization_users")
      .delete()
      .eq("organization_id", organizationId)
      .eq("user_id", authUserId);

    if (orgUserDeleteError) {
      throw new Error(orgUserDeleteError.message);
    }

    const { error: teamMemberError } = await supabase
      .from("team_members")
      .update({
        status: "Inactive",
        can_login: false,
      })
      .eq("auth_user_id", authUserId)
      .eq("organization_id", organizationId);

    if (teamMemberError) {
      throw new Error(teamMemberError.message);
    }

    const { error: invitationError } = await supabase
      .from("organization_invitations")
      .update({ status: "revoked", updated_at: timestamp })
      .eq("id", invitation.id);

    if (invitationError) {
      throw new Error(invitationError.message);
    }

    // Re-check Primary Owner still present after mutation (fail closed).
    await assertValidPrimaryOwnerRemains(supabase, organizationId, invitation.id);
  } catch (error) {
    await restoreRemoveSnapshot(supabase, invitation.id, authUserId, snapshot).catch(
      () => {
        // Best-effort restore; original error is rethrown below.
      }
    );
    throw error;
  }

  await writeAdminAuditLog(supabase, {
    actorUserId,
    action: "administrator.removed",
    targetType: "organization_invitation",
    targetId: invitation.id,
    organizationId: invitation.organization_id,
    propertyId: invitation.property_id,
    metadata: {
      email: invitation.email,
      firstName: invitation.first_name,
      lastName: invitation.last_name,
      isPrimary: Boolean(invitation.is_primary),
      orgRole: invitation.org_role,
      revokedPropertyIds: propertyIds,
      authUserPreserved: true,
      note: "Auth user retained; account deletion is a separate future workflow",
    },
  });
}

async function auditInvitation(
  supabase: SupabaseClient,
  actorUserId: string,
  action: string,
  invitation: ManageInvitationRow,
  metadataExtras?: Record<string, unknown>
): Promise<void> {
  await writeAdminAuditLog(supabase, {
    actorUserId,
    action,
    targetType: "organization_invitation",
    targetId: invitation.id,
    organizationId: invitation.organization_id,
    propertyId: invitation.property_id,
    metadata: {
      email: invitation.email,
      firstName: invitation.first_name,
      lastName: invitation.last_name,
      isPrimary: Boolean(invitation.is_primary),
      ...metadataExtras,
    },
  });
}

async function assertContactEmailAvailableForChange(
  supabase: SupabaseClient,
  invitation: ManageInvitationRow,
  newEmail: string
): Promise<void> {
  const { data: invitationConflicts, error: invitationConflictError } = await supabase
    .from("organization_invitations")
    .select("id, auth_user_id, status")
    .eq("email", newEmail)
    .in("status", ["pending", "accepted", "expired"]);

  if (invitationConflictError) {
    throw new Error(invitationConflictError.message);
  }

  const conflictingInvitation = (invitationConflicts ?? []).find((row) => {
    if (row.id === invitation.id) return false;
    if (
      invitation.auth_user_id &&
      row.auth_user_id &&
      String(row.auth_user_id) === invitation.auth_user_id
    ) {
      return false;
    }
    return true;
  });

  if (conflictingInvitation) {
    throw new PlatformAdminRequestError(
      409,
      "That email is already used by another administrator or invitation"
    );
  }

  const { data: teamByEmail, error: teamByEmailError } = await supabase
    .from("team_members")
    .select("id, auth_user_id")
    .eq("email", newEmail);

  if (teamByEmailError) {
    throw new Error(teamByEmailError.message);
  }

  const { data: teamByAuthEmail, error: teamByAuthEmailError } = await supabase
    .from("team_members")
    .select("id, auth_user_id")
    .eq("auth_email", newEmail);

  if (teamByAuthEmailError) {
    throw new Error(teamByAuthEmailError.message);
  }

  const teamConflicts = [...(teamByEmail ?? []), ...(teamByAuthEmail ?? [])];
  const seenMemberIds = new Set<string>();

  const conflictingMember = teamConflicts.find((row) => {
    const id = String(row.id);
    if (seenMemberIds.has(id)) return false;
    seenMemberIds.add(id);
    if (!row.auth_user_id) return true;
    if (invitation.auth_user_id && String(row.auth_user_id) === invitation.auth_user_id) {
      return false;
    }
    return true;
  });

  if (conflictingMember) {
    throw new PlatformAdminRequestError(
      409,
      "That email is already used by another team member account"
    );
  }
}

function mapAuthEmailUpdateError(errorMessage: string): PlatformAdminRequestError {
  const message = errorMessage.toLowerCase();
  if (
    message.includes("already") ||
    message.includes("registered") ||
    message.includes("exists") ||
    message.includes("unique") ||
    message.includes("duplicate")
  ) {
    return new PlatformAdminRequestError(
      409,
      "That email is already registered to another Auth user"
    );
  }
  return new PlatformAdminRequestError(
    502,
    `Failed to update Auth email: ${errorMessage}`
  );
}

async function revertAuthEmail(
  supabase: SupabaseClient,
  authUserId: string,
  previousAuthEmail: string
): Promise<void> {
  const { error } = await supabase.auth.admin.updateUserById(authUserId, {
    email: previousAuthEmail,
    email_confirm: true,
  });
  if (error) {
    console.error("[platform-admin] Failed to revert Auth email after sync failure", {
      authUserIdPresent: true,
      message: error.message,
    });
  }
}

/**
 * Platform Owner testing helper: update Auth email + synced invitation /
 * team_member contact fields without touching roles or memberships.
 */
async function changeAdministratorEmail(
  supabase: SupabaseClient,
  actorUserId: string,
  invitation: ManageInvitationRow,
  rawNewEmail: string | undefined
): Promise<{ message: string; email: string }> {
  if (!rawNewEmail || !String(rawNewEmail).trim()) {
    throw new PlatformAdminRequestError(400, "New email is required");
  }

  const newEmail = normalizeEmail(rawNewEmail);
  const previousContactEmail = normalizeEmail(invitation.email);

  if (!EMAIL_PATTERN.test(newEmail)) {
    throw new PlatformAdminRequestError(400, "Enter a valid email address");
  }
  if (newEmail === previousContactEmail) {
    throw new PlatformAdminRequestError(
      400,
      "New email must be different from the current email"
    );
  }
  if (!invitation.auth_user_id) {
    throw new PlatformAdminRequestError(
      409,
      "Administrator has no linked Auth account. Email cannot be changed."
    );
  }

  const authUserId = invitation.auth_user_id;

  const { data: authData, error: authLookupError } =
    await supabase.auth.admin.getUserById(authUserId);

  if (authLookupError || !authData?.user) {
    throw new PlatformAdminRequestError(
      409,
      `Linked Auth user not found: ${authLookupError?.message ?? "missing user"}`
    );
  }

  const previousAuthEmail = normalizeEmail(authData.user.email ?? "");
  if (!previousAuthEmail) {
    throw new PlatformAdminRequestError(
      409,
      "Linked Auth user has no email identity"
    );
  }

  // Contact/app uniqueness first — never mutate Auth until these pass.
  await assertContactEmailAvailableForChange(supabase, invitation, newEmail);

  // Auth uniqueness is enforced by updateUserById (avoids slow listUsers scans).
  const { error: authUpdateError } = await supabase.auth.admin.updateUserById(
    authUserId,
    {
      email: newEmail,
      email_confirm: true,
    }
  );

  if (authUpdateError) {
    console.error("[platform-admin] Auth email update failed", {
      invitationId: invitation.id,
      authUserIdPresent: true,
      message: authUpdateError.message,
    });
    throw mapAuthEmailUpdateError(authUpdateError.message);
  }

  console.info("[platform-admin] Auth email update succeeded", {
    invitationId: invitation.id,
    authUserIdPresent: true,
    previousDomain: emailDomainForAudit(previousAuthEmail),
    newDomain: emailDomainForAudit(newEmail),
  });

  try {
    const { error: invitationUpdateError } = await supabase
      .from("organization_invitations")
      .update({ email: newEmail })
      .eq("auth_user_id", authUserId);

    if (invitationUpdateError) {
      throw new PlatformAdminRequestError(
        500,
        `Invitation sync failed: ${invitationUpdateError.message}`
      );
    }

    // Ensure the targeted invitation row is updated even if auth_user_id
    // linkage was inconsistent on sibling rows.
    const { error: invitationRowError } = await supabase
      .from("organization_invitations")
      .update({ email: newEmail })
      .eq("id", invitation.id);

    if (invitationRowError) {
      throw new PlatformAdminRequestError(
        500,
        `Invitation row sync failed: ${invitationRowError.message}`
      );
    }

    const { error: teamMemberUpdateError } = await supabase
      .from("team_members")
      .update({
        email: newEmail,
        auth_email: newEmail,
      })
      .eq("auth_user_id", authUserId);

    if (teamMemberUpdateError) {
      throw new PlatformAdminRequestError(
        500,
        `Team member sync failed: ${teamMemberUpdateError.message}`
      );
    }

    await auditInvitation(supabase, actorUserId, "administrator.email_changed", invitation, {
      previousEmailDomain: emailDomainForAudit(previousContactEmail),
      newEmailDomain: emailDomainForAudit(newEmail),
      previousAuthEmailDomain: emailDomainForAudit(previousAuthEmail),
      authUserIdPresent: true,
      note: "Platform Owner testing helper — Auth + invitation/team_member emails synchronized",
    });
  } catch (syncError) {
    await revertAuthEmail(supabase, authUserId, previousAuthEmail);
    throw syncError;
  }

  return { message: CHANGE_EMAIL_SUCCESS_MESSAGE, email: newEmail };
}

export async function manageAdministratorInvitation(
  supabase: SupabaseClient,
  actorUserId: string,
  organizationId: number,
  invitationId: string,
  action: AdministratorInvitationAction,
  options: ManageAdministratorInvitationOptions
): Promise<ManageAdministratorInvitationResult> {
  const invitation = await loadInvitation(supabase, organizationId, invitationId);
  const timestamp = new Date().toISOString();
  let message: string | undefined;
  let email: string | undefined;

  switch (action) {
    case "resend": {
      assertPending(invitation, "resent");
      const expiresAt = new Date(
        Date.now() + INVITATION_TTL_DAYS * 24 * 60 * 60 * 1000
      ).toISOString();

      const { data: organization } = await supabase
        .from("organizations")
        .select("name")
        .eq("id", organizationId)
        .maybeSingle();

      const { error: inviteError } = await inviteUserOrGenerateLink(
        supabase,
        normalizeEmail(invitation.email),
        {
          redirectTo: resolveInviteRedirectUrl(),
          data: {
            oe_invitation_id: invitation.id,
            first_name: invitation.first_name,
            last_name: invitation.last_name,
            job_title: invitation.job_title,
            is_administrator: true,
          },
          recipientName: administratorDisplayName(invitation),
          inviterName: "A One Eyrie administrator",
          organizationName: organization?.name ?? null,
          expirationDate: formatInvitationExpirationDate(expiresAt),
          invitationId: invitation.id,
        }
      );

      if (inviteError) {
        throw new PlatformAdminRequestError(
          502,
          `Invitation email failed: ${inviteError.message}`
        );
      }

      const { error } = await supabase
        .from("organization_invitations")
        .update({ status: "pending", expires_at: expiresAt, updated_at: timestamp })
        .eq("id", invitation.id);
      if (error) {
        throw new Error(error.message);
      }
      await auditInvitation(supabase, actorUserId, "invitation.resent", invitation);
      break;
    }

    case "cancel": {
      assertPending(invitation, "cancelled");
      const { error } = await supabase
        .from("organization_invitations")
        .update({ status: "cancelled", updated_at: timestamp })
        .eq("id", invitation.id);
      if (error) {
        throw new Error(error.message);
      }
      await auditInvitation(supabase, actorUserId, "invitation.cancelled", invitation);
      break;
    }

    case "disable": {
      assertAccepted(invitation, "disabled");
      assertNotPrimary(invitation, "disabled");
      assertNotSelfTarget(invitation, actorUserId, "disable");
      if (!invitation.auth_user_id) {
        throw new PlatformAdminRequestError(409, "Administrator has no linked account");
      }
      await setMembershipActive(
        supabase,
        organizationId,
        invitation.auth_user_id,
        false
      );
      await auditInvitation(supabase, actorUserId, "administrator.disabled", invitation);
      break;
    }

    case "enable": {
      assertAccepted(invitation, "enabled");
      assertNotPrimary(invitation, "enabled");
      assertNotSelfTarget(invitation, actorUserId, "enable");
      if (!invitation.auth_user_id) {
        throw new PlatformAdminRequestError(409, "Administrator has no linked account");
      }
      await setMembershipActive(
        supabase,
        organizationId,
        invitation.auth_user_id,
        true
      );
      await auditInvitation(supabase, actorUserId, "administrator.enabled", invitation);
      break;
    }

    case "remove": {
      assertPlatformOwner(options.platformAdmin);
      assertAccepted(invitation, "removed");
      assertNotPrimary(invitation, "removed");
      assertNotSelfTarget(invitation, actorUserId, "remove");
      await permanentlyRemoveAdministrator(
        supabase,
        actorUserId,
        organizationId,
        invitation,
        options.confirmName
      );
      break;
    }

    case "send_password_reset": {
      assertAccepted(invitation, "sent a password reset to");
      if (!invitation.auth_user_id) {
        throw new PlatformAdminRequestError(
          409,
          "Administrator has no linked Auth account. Password reset cannot be sent."
        );
      }
      const { error: resetError } = await sendPasswordResetOrGenerateLink(supabase, {
        authUserId: invitation.auth_user_id,
        deliveryEmail: normalizeEmail(invitation.email),
        invitationId: String(invitation.id),
        redirectTo: resolvePasswordResetRedirectUrl(),
        recipientName: `${invitation.first_name} ${invitation.last_name}`.trim(),
      });
      if (resetError) {
        throw new PlatformAdminRequestError(
          502,
          `Password reset email failed: ${resetError.message}`
        );
      }
      await auditInvitation(
        supabase,
        actorUserId,
        "administrator.password_reset_sent",
        invitation
      );
      break;
    }

    case "change_email": {
      // Platform Owner only. Primary Owner protection does NOT apply — email
      // changes are allowed for primary and non-primary administrators.
      assertPlatformOwner(options.platformAdmin);
      if (
        invitation.status !== "accepted" &&
        invitation.status !== "pending" &&
        invitation.status !== "expired"
      ) {
        throw new PlatformAdminRequestError(
          409,
          "Only pending or accepted administrators can have their email changed"
        );
      }
      const changeResult = await changeAdministratorEmail(
        supabase,
        actorUserId,
        invitation,
        options.newEmail
      );
      message = changeResult.message;
      email = changeResult.email;
      break;
    }

    default: {
      throw new PlatformAdminRequestError(400, "Unsupported action");
    }
  }

  const invitations = await fetchOrganizationInvitations(supabase, organizationId);
  return {
    invitation: invitations.find((row) => row.id === invitation.id) ?? null,
    message,
    email,
  };
}
