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
import type { AdminOrganizationInvitation } from "@/app/lib/platform-admin/types";

const INVITATION_TTL_DAYS = 7;

export type AdministratorInvitationAction =
  | "resend"
  | "cancel"
  | "disable"
  | "enable"
  | "remove"
  | "send_password_reset";

export const ADMINISTRATOR_INVITATION_ACTIONS: AdministratorInvitationAction[] = [
  "resend",
  "cancel",
  "disable",
  "enable",
  "remove",
  "send_password_reset",
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
};

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function resolveSiteUrl(): string {
  return (
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.SMOKE_BASE_URL ||
    "http://localhost:3000"
  ).replace(/\/$/, "");
}

function resolveInviteRedirectUrl(): string {
  return `${resolveSiteUrl()}/auth/callback`;
}

function resolvePasswordResetRedirectUrl(): string {
  return `${resolveSiteUrl()}/login`;
}

async function loadInvitation(
  supabase: SupabaseClient,
  organizationId: number,
  invitationId: string
): Promise<ManageInvitationRow> {
  const { data, error } = await supabase
    .from("organization_invitations")
    .select(
      "id, organization_id, property_id, email, first_name, last_name, job_title, status, is_primary, auth_user_id"
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
      `The Primary Administrator cannot be ${verb}. Transfer the Primary Administrator role first.`
    );
  }
}

async function auditInvitation(
  supabase: SupabaseClient,
  actorUserId: string,
  action: string,
  invitation: ManageInvitationRow
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
    },
  });
}

export async function manageAdministratorInvitation(
  supabase: SupabaseClient,
  actorUserId: string,
  organizationId: number,
  invitationId: string,
  action: AdministratorInvitationAction
): Promise<AdminOrganizationInvitation | null> {
  const invitation = await loadInvitation(supabase, organizationId, invitationId);
  const timestamp = new Date().toISOString();

  switch (action) {
    case "resend": {
      assertPending(invitation, "resent");
      const expiresAt = new Date(
        Date.now() + INVITATION_TTL_DAYS * 24 * 60 * 60 * 1000
      ).toISOString();

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
        }
      );

      // A benign "already registered" simply means the account exists; the
      // pending invitation remains valid, so we do not fail the resend.
      if (inviteError) {
        const message = inviteError.message.toLowerCase();
        const benign =
          message.includes("already") ||
          message.includes("registered") ||
          message.includes("exists") ||
          message.includes("rate limit");
        if (!benign) {
          throw new PlatformAdminRequestError(
            502,
            `Supabase invitation failed: ${inviteError.message}`
          );
        }
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
      assertAccepted(invitation, "removed");
      assertNotPrimary(invitation, "removed");
      if (invitation.auth_user_id) {
        await setMembershipActive(
          supabase,
          organizationId,
          invitation.auth_user_id,
          false
        );
      }
      const { error } = await supabase
        .from("organization_invitations")
        .update({ status: "revoked", updated_at: timestamp })
        .eq("id", invitation.id);
      if (error) {
        throw new Error(error.message);
      }
      await auditInvitation(supabase, actorUserId, "administrator.removed", invitation);
      break;
    }

    case "send_password_reset": {
      assertAccepted(invitation, "sent a password reset to");
      if (!invitation.auth_user_id) {
        throw new PlatformAdminRequestError(409, "Administrator has no linked account");
      }
      const { error: resetError } = await sendPasswordResetOrGenerateLink(
        supabase,
        normalizeEmail(invitation.email),
        { redirectTo: resolvePasswordResetRedirectUrl() }
      );
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

    default: {
      throw new PlatformAdminRequestError(400, "Unsupported action");
    }
  }

  const invitations = await fetchOrganizationInvitations(supabase, organizationId);
  return invitations.find((row) => row.id === invitation.id) ?? null;
}
