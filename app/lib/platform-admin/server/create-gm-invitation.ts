import type { SupabaseClient } from "@supabase/supabase-js";
import { writeAdminAuditLog } from "@/app/lib/platform-admin/server/admin-audit-log";
import { resolveGmModulePermissions } from "@/app/lib/platform-admin/server/gm-module-permissions";
import { ORGANIZATION_STATUS_ACTIVE } from "@/app/lib/platform-admin/server/organization-constants";
import { PlatformAdminRequestError } from "@/app/lib/platform-admin/server/resolve-platform-admin-request";
import type { AdminOrganizationInvitation } from "@/app/lib/platform-admin/types";
import {
  administratorRoleLabel,
  administratorScopeLabel,
  resolveInviteRoles,
  type AdministratorInviteRole,
} from "@/app/lib/platform-admin/roles";
import { inviteUserOrGenerateLink } from "@/app/lib/platform-admin/server/auth-email-dispatch";

/** How long a pending invitation stays valid before it is treated as expired. */
const INVITATION_TTL_DAYS = 7;

export type CreateAdministratorInvitationInput = {
  propertyId: number;
  email: string;
  firstName: string;
  lastName: string;
  role: AdministratorInviteRole;
  jobTitle: string;
};

/** Operational job title fallback when the inviter leaves the field blank. */
const DEFAULT_JOB_TITLE = "Administrator";
const JOB_TITLE_MAX_LENGTH = 80;

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function resolveInviteRedirectUrl(): string {
  const siteUrl =
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.SMOKE_BASE_URL ||
    "http://localhost:3000";
  return `${siteUrl.replace(/\/$/, "")}/auth/callback`;
}

function parseCreateAdministratorInvitationInput(
  body: Record<string, unknown>
): CreateAdministratorInvitationInput {
  const propertyId = Number.parseInt(String(body.propertyId ?? ""), 10);
  const email = normalizeEmail(String(body.email ?? ""));
  const firstName = String(body.firstName ?? body.first_name ?? "").trim();
  const lastName = String(body.lastName ?? body.last_name ?? "").trim();
  const rawRole = String(body.role ?? "property_administrator");
  const role: AdministratorInviteRole =
    rawRole === "organization_admin" ? "organization_admin" : "property_administrator";
  // Operational job title is optional and independent of permissions. Blank
  // falls back to "Administrator"; it never influences access.
  const jobTitle =
    String(body.jobTitle ?? body.job_title ?? "")
      .trim()
      .slice(0, JOB_TITLE_MAX_LENGTH) || DEFAULT_JOB_TITLE;

  if (!Number.isInteger(propertyId) || propertyId <= 0) {
    throw new PlatformAdminRequestError(400, "Property id is required");
  }
  if (!email || !isValidEmail(email)) {
    throw new PlatformAdminRequestError(400, "Valid email is required");
  }
  if (!firstName) {
    throw new PlatformAdminRequestError(400, "First name is required");
  }
  if (!lastName) {
    throw new PlatformAdminRequestError(400, "Last name is required");
  }

  return { propertyId, email, firstName, lastName, role, jobTitle };
}

type InvitationSelectRow = {
  id: string | number;
  organization_id: number;
  property_id: number;
  email: string;
  first_name: string;
  last_name: string;
  job_title: string | null;
  status: string;
  is_primary: boolean | null;
  org_role: string | null;
  property_role: string | null;
  auth_user_id: string | null;
  expires_at: string | null;
  created_at: string;
  accepted_at: string | null;
  properties?: { name?: string } | null;
};

const INVITATION_SELECT =
  "id, organization_id, property_id, email, first_name, last_name, job_title, status, is_primary, org_role, property_role, auth_user_id, expires_at, created_at, accepted_at, properties(name)";

function isExpiredPending(row: InvitationSelectRow, now: number): boolean {
  return (
    row.status === "pending" &&
    !!row.expires_at &&
    new Date(row.expires_at).getTime() < now
  );
}

export async function fetchOrganizationInvitations(
  supabase: SupabaseClient,
  organizationId: number
): Promise<AdminOrganizationInvitation[]> {
  const { data, error } = await supabase
    .from("organization_invitations")
    .select(INVITATION_SELECT)
    .eq("organization_id", organizationId)
    .order("is_primary", { ascending: false })
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  const rows = (data ?? []) as unknown as InvitationSelectRow[];
  const now = Date.now();

  // Lazily flip overdue pending invitations to 'expired' so status is truthful
  // without a background job. Only touches rows that just crossed their TTL.
  const newlyExpired = rows.filter((row) => isExpiredPending(row, now));
  if (newlyExpired.length > 0) {
    const ids = newlyExpired.map((row) => row.id);
    await supabase
      .from("organization_invitations")
      .update({ status: "expired", updated_at: new Date().toISOString() })
      .in("id", ids);
    for (const row of newlyExpired) {
      row.status = "expired";
    }
  }

  // Derive membership active state for accepted administrators from
  // organization_users (the access gate). Disabled/removed admins read inactive.
  const acceptedAuthUserIds = Array.from(
    new Set(
      rows
        .filter((row) => row.status === "accepted" && row.auth_user_id)
        .map((row) => row.auth_user_id as string)
    )
  );

  const activeByUserId = new Map<string, boolean>();
  const propertyIdsByUserId = new Map<string, number[]>();
  const modulePermissionsByUserId = new Map<string, Record<string, boolean>>();

  if (acceptedAuthUserIds.length > 0) {
    const { data: memberships, error: membershipError } = await supabase
      .from("organization_users")
      .select("user_id, active")
      .eq("organization_id", organizationId)
      .in("user_id", acceptedAuthUserIds);

    if (membershipError) {
      throw new Error(membershipError.message);
    }
    for (const membership of memberships ?? []) {
      activeByUserId.set(String(membership.user_id), Boolean(membership.active));
    }

    const { data: orgProperties, error: orgPropertiesError } = await supabase
      .from("properties")
      .select("id")
      .eq("organization_id", organizationId);

    if (orgPropertiesError) {
      throw new Error(orgPropertiesError.message);
    }

    const orgPropertyIds = (orgProperties ?? []).map((row) => Number(row.id));
    if (orgPropertyIds.length > 0) {
      const { data: propertyMemberships, error: propertyMembershipError } =
        await supabase
          .from("user_properties")
          .select("user_id, property_id, active, module_permissions, is_default")
          .in("user_id", acceptedAuthUserIds)
          .in("property_id", orgPropertyIds)
          .eq("active", true);

      if (propertyMembershipError) {
        throw new Error(propertyMembershipError.message);
      }

      for (const membership of propertyMemberships ?? []) {
        const userId = String(membership.user_id);
        const propertyId = Number(membership.property_id);
        const current = propertyIdsByUserId.get(userId) ?? [];
        current.push(propertyId);
        propertyIdsByUserId.set(userId, current);

        if (
          !modulePermissionsByUserId.has(userId) ||
          Boolean(membership.is_default)
        ) {
          const raw = membership.module_permissions;
          if (raw && typeof raw === "object" && !Array.isArray(raw)) {
            modulePermissionsByUserId.set(
              userId,
              raw as Record<string, boolean>
            );
          }
        }
      }
    }
  }

  return rows.map((row) => {
    const isPrimary = Boolean(row.is_primary);
    const orgRole = String(row.org_role ?? "org_member");
    const propertyRole = String(row.property_role ?? "property_admin");
    const authUserId = row.auth_user_id ?? null;
    const active =
      row.status === "accepted" && authUserId
        ? activeByUserId.get(authUserId) ?? true
        : null;
    const assignedPropertyIds =
      row.status === "accepted" && authUserId
        ? propertyIdsByUserId.get(authUserId) ?? [row.property_id]
        : [row.property_id];

    return {
      id: String(row.id),
      organizationId: row.organization_id,
      propertyId: row.property_id,
      propertyName: row.properties?.name ?? null,
      email: String(row.email),
      firstName: String(row.first_name),
      lastName: String(row.last_name),
      jobTitle: String(row.job_title ?? "Administrator"),
      status: String(row.status),
      isPrimary,
      orgRole,
      propertyRole,
      roleLabel: administratorRoleLabel({ isPrimary, orgRole }),
      scopeLabel: administratorScopeLabel(orgRole, assignedPropertyIds.length),
      assignedPropertyIds,
      modulePermissions:
        row.status === "accepted" && authUserId
          ? modulePermissionsByUserId.get(authUserId) ?? null
          : null,
      active,
      authUserId,
      expiresAt: row.expires_at ?? null,
      createdAt: String(row.created_at),
      acceptedAt: row.accepted_at ? String(row.accepted_at) : null,
    };
  });
}

/**
 * An administrator invitation can be sent whenever the organization is active
 * and has at least one property. There is intentionally NO single-admin limit —
 * multiple administrators per organization/property are supported.
 */
export function canInviteAdministrator(input: {
  organizationStatus: string;
  propertyCount: number;
}): boolean {
  if (input.organizationStatus !== ORGANIZATION_STATUS_ACTIVE) {
    return false;
  }
  return input.propertyCount > 0;
}

async function organizationHasPrimaryAdministrator(
  supabase: SupabaseClient,
  organizationId: number
): Promise<boolean> {
  const { count, error } = await supabase
    .from("organization_invitations")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", organizationId)
    .eq("is_primary", true)
    .in("status", ["pending", "accepted"]);

  if (error) {
    throw new Error(error.message);
  }
  return (count ?? 0) > 0;
}

async function findExistingAuthUserIdForEmail(
  supabase: SupabaseClient,
  organizationId: number,
  email: string
): Promise<string | null> {
  const { data } = await supabase
    .from("organization_invitations")
    .select("auth_user_id, created_at")
    .eq("organization_id", organizationId)
    .eq("email", email)
    .not("auth_user_id", "is", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return (data?.auth_user_id as string | undefined) ?? null;
}

export async function createAdministratorInvitation(
  supabase: SupabaseClient,
  actorUserId: string,
  organizationId: number,
  body: Record<string, unknown>
): Promise<AdminOrganizationInvitation> {
  const input = parseCreateAdministratorInvitationInput(body);

  const { data: organization, error: orgError } = await supabase
    .from("organizations")
    .select("id, name, status")
    .eq("id", organizationId)
    .maybeSingle();

  if (orgError) {
    throw new Error(orgError.message);
  }
  if (!organization) {
    throw new PlatformAdminRequestError(404, "Organization not found");
  }
  if (organization.status !== ORGANIZATION_STATUS_ACTIVE) {
    throw new PlatformAdminRequestError(
      409,
      "Invitations can only be sent for active organizations"
    );
  }

  const { data: property, error: propertyError } = await supabase
    .from("properties")
    .select("id, name, organization_id, active")
    .eq("id", input.propertyId)
    .maybeSingle();

  if (propertyError) {
    throw new Error(propertyError.message);
  }
  if (!property || property.organization_id !== organizationId) {
    throw new PlatformAdminRequestError(404, "Property not found for organization");
  }

  // Reject re-inviting someone who is already an accepted administrator here.
  const { data: existingAccepted, error: existingAcceptedError } = await supabase
    .from("organization_invitations")
    .select("id")
    .eq("organization_id", organizationId)
    .eq("email", input.email)
    .eq("status", "accepted")
    .maybeSingle();

  if (existingAcceptedError) {
    throw new Error(existingAcceptedError.message);
  }
  if (existingAccepted) {
    throw new PlatformAdminRequestError(
      409,
      "This person is already an administrator for this organization"
    );
  }

  // The first administrator for an organization becomes the Primary Owner.
  const hasPrimary = await organizationHasPrimaryAdministrator(supabase, organizationId);
  const isPrimary = !hasPrimary;
  const { orgRole, propertyRole } = isPrimary
    ? { orgRole: "org_owner", propertyRole: "property_admin" }
    : resolveInviteRoles(input.role);
  // Operational job title is descriptive only. Access is governed entirely by
  // is_administrator + membership roles (org_role / property_role) + module
  // permissions — never by this title. The Primary/Org-Admin/Property-Admin
  // distinction is carried by org_role + is_primary in the platform-admin portal.
  const jobTitle = input.jobTitle;

  const expiresAt = new Date(
    Date.now() + INVITATION_TTL_DAYS * 24 * 60 * 60 * 1000
  ).toISOString();

  const { data: invitation, error: insertError } = await supabase
    .from("organization_invitations")
    .insert({
      organization_id: organizationId,
      property_id: input.propertyId,
      email: input.email,
      first_name: input.firstName,
      last_name: input.lastName,
      org_role: orgRole,
      property_role: propertyRole,
      job_title: jobTitle,
      status: "pending",
      is_primary: isPrimary,
      invited_by: actorUserId,
      expires_at: expiresAt,
    })
    .select("id")
    .single();

  if (insertError) {
    if (insertError.code === "23505") {
      throw new PlatformAdminRequestError(
        409,
        "A pending invitation already exists for this email in this organization"
      );
    }
    throw new Error(insertError.message);
  }

  const invitationId = String(invitation.id);

  const inviteMetadata = {
    oe_invitation_id: invitationId,
    first_name: input.firstName,
    last_name: input.lastName,
    job_title: jobTitle,
    is_administrator: true,
  };

  let authUserId: string | null = null;

  const { data: inviteData, error: inviteError } =
    await inviteUserOrGenerateLink(supabase, input.email, {
      redirectTo: resolveInviteRedirectUrl(),
      data: inviteMetadata,
    });

  if (inviteError) {
    const message = inviteError.message.toLowerCase();
    const canCreateFallback =
      message.includes("rate limit") || message.includes("invalid");
    const alreadyRegistered =
      message.includes("already") || message.includes("registered") || message.includes("exists");

    if (canCreateFallback) {
      const { data: createdUser, error: createUserError } =
        await supabase.auth.admin.createUser({
          email: input.email,
          email_confirm: true,
          user_metadata: inviteMetadata,
        });

      if (createUserError) {
        await supabase.from("organization_invitations").delete().eq("id", invitationId);
        throw new PlatformAdminRequestError(
          502,
          `Supabase user provisioning failed: ${createUserError.message}`
        );
      }
      authUserId = createdUser.user?.id ?? null;
    } else if (alreadyRegistered) {
      // Re-invite of an existing account (e.g. a previously removed admin).
      const existingAuthUserId = await findExistingAuthUserIdForEmail(
        supabase,
        organizationId,
        input.email
      );
      if (!existingAuthUserId) {
        await supabase.from("organization_invitations").delete().eq("id", invitationId);
        throw new PlatformAdminRequestError(
          502,
          `Supabase invitation failed: ${inviteError.message}`
        );
      }
      const { error: updateMetaError } = await supabase.auth.admin.updateUserById(
        existingAuthUserId,
        { user_metadata: inviteMetadata }
      );
      if (updateMetaError) {
        await supabase.from("organization_invitations").delete().eq("id", invitationId);
        throw new PlatformAdminRequestError(
          502,
          `Supabase user update failed: ${updateMetaError.message}`
        );
      }
      authUserId = existingAuthUserId;
    } else {
      await supabase.from("organization_invitations").delete().eq("id", invitationId);
      throw new PlatformAdminRequestError(
        502,
        `Supabase invitation failed: ${inviteError.message}`
      );
    }
  } else {
    authUserId = inviteData.user?.id ?? null;
  }

  const { error: updateError } = await supabase
    .from("organization_invitations")
    .update({
      auth_user_id: authUserId,
      supabase_invite_id: authUserId,
      updated_at: new Date().toISOString(),
    })
    .eq("id", invitationId);

  if (updateError) {
    throw new Error(updateError.message);
  }

  await writeAdminAuditLog(supabase, {
    actorUserId,
    action: "invitation.created",
    targetType: "organization_invitation",
    targetId: invitationId,
    organizationId,
    propertyId: input.propertyId,
    metadata: {
      email: input.email,
      firstName: input.firstName,
      lastName: input.lastName,
      organizationName: organization.name,
      propertyName: property.name,
      orgRole,
      propertyRole,
      jobTitle,
      isPrimary,
    },
  });

  const invitations = await fetchOrganizationInvitations(supabase, organizationId);
  const created = invitations.find((row) => row.id === invitationId);
  if (!created) {
    throw new Error("Created invitation could not be loaded");
  }

  return created;
}
