import type { SupabaseClient } from "@supabase/supabase-js";
import { writeAdminAuditLog } from "@/app/lib/platform-admin/server/admin-audit-log";
import { resolveGmModulePermissions } from "@/app/lib/platform-admin/server/gm-module-permissions";
import { ORGANIZATION_STATUS_ACTIVE } from "@/app/lib/platform-admin/server/organization-constants";
import { PlatformAdminRequestError } from "@/app/lib/platform-admin/server/resolve-platform-admin-request";
import type { AdminOrganizationInvitation } from "@/app/lib/platform-admin/types";
import {
  administratorRoleLabel,
  administratorScopeLabel,
  normalizePropertyIdList,
  resolveInviteRoles,
  type AdministratorInviteRole,
} from "@/app/lib/platform-admin/roles";
import { inviteUserOrGenerateLink } from "@/app/lib/platform-admin/server/auth-email-dispatch";
import { resolveInviteRedirectUrl } from "@/app/lib/email/auth-email-config";

/** How long a pending invitation stays valid before it is treated as expired. */
const INVITATION_TTL_DAYS = 7;

export type CreateAdministratorInvitationInput = {
  propertyIds: number[];
  email: string;
  firstName: string;
  lastName: string;
  role: AdministratorInviteRole;
  jobTitle: string;
  /**
   * Organization Administration entitlement to grant on acceptance. Only honored
   * when the caller is authorized to manage it (Platform Admin). Customer-facing
   * callers never set this — it defaults to false.
   */
  orgAdminPortalAccess: boolean;
};

/** Options controlling privileged, One Eyrie-only fields during invite creation. */
export type CreateAdministratorInvitationOptions = {
  /** When false (default), the Organization Administration entitlement is ignored. */
  allowOrgAdminEntitlement?: boolean;
};

/** Operational job title fallback when the inviter leaves the field blank. */
const DEFAULT_JOB_TITLE = "Administrator";
const JOB_TITLE_MAX_LENGTH = 80;

let assignedPropertyIdsColumnSupported: boolean | null = null;

async function supportsAssignedPropertyIdsColumn(
  supabase: SupabaseClient
): Promise<boolean> {
  if (assignedPropertyIdsColumnSupported != null) {
    return assignedPropertyIdsColumnSupported;
  }
  const { error } = await supabase
    .from("organization_invitations")
    .select("assigned_property_ids")
    .limit(1);
  assignedPropertyIdsColumnSupported = !error;
  return assignedPropertyIdsColumnSupported;
}

let orgAdminAccessColumnSupported: boolean | null = null;

async function supportsOrgAdminAccessColumn(
  supabase: SupabaseClient
): Promise<boolean> {
  if (orgAdminAccessColumnSupported != null) {
    return orgAdminAccessColumnSupported;
  }
  const { error } = await supabase
    .from("organization_invitations")
    .select("org_admin_portal_access")
    .limit(1);
  orgAdminAccessColumnSupported = !error;
  return orgAdminAccessColumnSupported;
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
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

async function resolveInviterDisplayName(
  _supabase: SupabaseClient,
  _actorUserId: string
): Promise<string> {
  // Do not personalize invitation emails with the Platform Owner's name
  // (e.g. Douglas Nemeth). Keep a stable product identity.
  return "A One Eyrie administrator";
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function parseCreateAdministratorInvitationInput(
  body: Record<string, unknown>,
  options?: CreateAdministratorInvitationOptions
): CreateAdministratorInvitationInput {
  const fromArray = normalizePropertyIdList(body.propertyIds ?? body.property_ids);
  const single = Number.parseInt(String(body.propertyId ?? body.property_id ?? ""), 10);
  const propertyIds =
    fromArray.length > 0
      ? fromArray
      : Number.isInteger(single) && single > 0
        ? [single]
        : [];

  const email = normalizeEmail(String(body.email ?? ""));
  const firstName = String(body.firstName ?? body.first_name ?? "").trim();
  const lastName = String(body.lastName ?? body.last_name ?? "").trim();
  const rawRole = String(body.role ?? "property_administrator");
  const role: AdministratorInviteRole =
    rawRole === "organization_admin" ? "organization_admin" : "property_administrator";
  const jobTitle =
    String(body.jobTitle ?? body.job_title ?? "")
      .trim()
      .slice(0, JOB_TITLE_MAX_LENGTH) || DEFAULT_JOB_TITLE;

  if (propertyIds.length === 0) {
    throw new PlatformAdminRequestError(400, "At least one property is required");
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

  // Organization Administration is a One Eyrie-only entitlement. Only honor it
  // when the caller is authorized; otherwise it is ignored and defaults to false.
  const orgAdminPortalAccess = options?.allowOrgAdminEntitlement
    ? Boolean(body.orgAdminPortalAccess ?? body.org_admin_portal_access ?? false)
    : false;

  return {
    propertyIds,
    email,
    firstName,
    lastName,
    role,
    jobTitle,
    orgAdminPortalAccess,
  };
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
  assigned_property_ids?: number[] | null;
  org_admin_portal_access?: boolean | null;
  properties?: { name?: string } | null;
};

const INVITATION_SELECT_BASE =
  "id, organization_id, property_id, email, first_name, last_name, job_title, status, is_primary, org_role, property_role, auth_user_id, expires_at, created_at, accepted_at, properties(name)";

function isExpiredPending(row: InvitationSelectRow, now: number): boolean {
  return (
    row.status === "pending" &&
    !!row.expires_at &&
    new Date(row.expires_at).getTime() < now
  );
}

function coerceAssignedPropertyIds(
  row: InvitationSelectRow,
  metadataIds: number[] | null
): number[] {
  const fromColumn = normalizePropertyIdList(row.assigned_property_ids ?? []);
  if (fromColumn.length > 0) {
    return fromColumn;
  }
  if (metadataIds && metadataIds.length > 0) {
    return metadataIds;
  }
  return [row.property_id];
}

export async function fetchOrganizationInvitations(
  supabase: SupabaseClient,
  organizationId: number
): Promise<AdminOrganizationInvitation[]> {
  const includeAssigned = await supportsAssignedPropertyIdsColumn(supabase);
  const includeOrgAdminAccess = await supportsOrgAdminAccessColumn(supabase);
  const select = [
    INVITATION_SELECT_BASE,
    includeAssigned ? "assigned_property_ids" : null,
    includeOrgAdminAccess ? "org_admin_portal_access" : null,
  ]
    .filter(Boolean)
    .join(", ");

  const { data, error } = await supabase
    .from("organization_invitations")
    .select(select)
    .eq("organization_id", organizationId)
    .order("is_primary", { ascending: false })
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  const rows = (data ?? []) as unknown as InvitationSelectRow[];
  const now = Date.now();

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

  const acceptedAuthUserIds = Array.from(
    new Set(
      rows
        .filter((row) => row.status === "accepted" && row.auth_user_id)
        .map((row) => row.auth_user_id as string)
    )
  );

  const activeByUserId = new Map<string, boolean>();
  const orgAdminAccessByUserId = new Map<string, boolean>();
  const propertyIdsByUserId = new Map<string, number[]>();
  const modulePermissionsByUserId = new Map<string, Record<string, boolean>>();
  const pendingMetadataByUserId = new Map<string, number[]>();
  const usernameByUserId = new Map<string, string>();

  const authUserIdsForUsername = Array.from(
    new Set(
      rows
        .map((row) => row.auth_user_id)
        .filter((id): id is string => Boolean(id))
        .map(String)
    )
  );

  if (authUserIdsForUsername.length > 0) {
    const { data: profiles, error: profileError } = await supabase
      .from("user_profiles")
      .select("user_id, username")
      .in("user_id", authUserIdsForUsername);

    if (profileError && !/does not exist/i.test(profileError.message)) {
      throw new Error(profileError.message);
    }

    for (const profile of profiles ?? []) {
      const username = String(profile.username ?? "").trim();
      if (username) {
        usernameByUserId.set(String(profile.user_id), username);
      }
    }

    const missingUsernameIds = authUserIdsForUsername.filter(
      (id) => !usernameByUserId.has(id)
    );
    if (missingUsernameIds.length > 0) {
      const { data: teamRows, error: teamError } = await supabase
        .from("team_members")
        .select("auth_user_id, username")
        .in("auth_user_id", missingUsernameIds);

      if (teamError) {
        throw new Error(teamError.message);
      }
      for (const row of teamRows ?? []) {
        const username = String(row.username ?? "").trim();
        const userId = String(row.auth_user_id ?? "");
        if (userId && username && !usernameByUserId.has(userId)) {
          usernameByUserId.set(userId, username);
        }
      }
    }
  }

  if (acceptedAuthUserIds.length > 0) {
    const membershipSelect = includeOrgAdminAccess
      ? "user_id, active, org_admin_portal_access"
      : "user_id, active";
    const { data: memberships, error: membershipError } = await supabase
      .from("organization_users")
      .select(membershipSelect)
      .eq("organization_id", organizationId)
      .in("user_id", acceptedAuthUserIds);

    if (membershipError) {
      throw new Error(membershipError.message);
    }
    const membershipRows = (memberships ?? []) as unknown as Record<
      string,
      unknown
    >[];
    for (const row of membershipRows) {
      activeByUserId.set(String(row.user_id), Boolean(row.active));
      orgAdminAccessByUserId.set(
        String(row.user_id),
        Boolean(row.org_admin_portal_access)
      );
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

  // Pending invitations may carry multi-property selections in auth metadata
  // when the assigned_property_ids column has not been applied yet.
  const pendingAuthUserIds = Array.from(
    new Set(
      rows
        .filter(
          (row) =>
            (row.status === "pending" || row.status === "expired") &&
            row.auth_user_id &&
            !includeAssigned
        )
        .map((row) => row.auth_user_id as string)
    )
  );
  for (const userId of pendingAuthUserIds) {
    const { data: authUser, error: authError } =
      await supabase.auth.admin.getUserById(userId);
    if (authError || !authUser.user) continue;
    const raw = authUser.user.user_metadata?.oe_assigned_property_ids;
    const ids = normalizePropertyIdList(raw);
    if (ids.length > 0) {
      pendingMetadataByUserId.set(userId, ids);
    }
  }

  return rows
    .filter((row) => {
      // Hide Auth-purged revoked rows (auth_user_id cleared after permanent delete).
      if (String(row.status) === "revoked" && !row.auth_user_id) {
        return false;
      }
      return true;
    })
    .map((row) => {
    const isPrimary = Boolean(row.is_primary);
    const orgRole = String(row.org_role ?? "org_member");
    const propertyRole = String(row.property_role ?? "property_admin");
    const authUserId = row.auth_user_id ?? null;
    const active =
      row.status === "accepted" && authUserId
        ? activeByUserId.get(authUserId) ?? true
        : null;

    const orgAdminPortalAccess =
      row.status === "accepted" && authUserId
        ? orgAdminAccessByUserId.get(authUserId) ??
          Boolean(row.org_admin_portal_access)
        : Boolean(row.org_admin_portal_access);

    let assignedPropertyIds: number[];
    if (row.status === "accepted" && authUserId) {
      assignedPropertyIds =
        propertyIdsByUserId.get(authUserId) ??
        coerceAssignedPropertyIds(row, null);
    } else {
      assignedPropertyIds = coerceAssignedPropertyIds(
        row,
        authUserId ? pendingMetadataByUserId.get(authUserId) ?? null : null
      );
    }

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
      orgAdminPortalAccess,
      assignedPropertyIds,
      modulePermissions:
        row.status === "accepted" && authUserId
          ? modulePermissionsByUserId.get(authUserId) ?? null
          : null,
      active,
      authUserId,
      username: authUserId ? usernameByUserId.get(authUserId) ?? null : null,
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
  const normalizedEmail = normalizeEmail(email);

  const { data: sameOrg } = await supabase
    .from("organization_invitations")
    .select("auth_user_id, created_at")
    .eq("organization_id", organizationId)
    .eq("email", normalizedEmail)
    .not("auth_user_id", "is", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (sameOrg?.auth_user_id) {
    return String(sameOrg.auth_user_id);
  }

  // Cross-organization: the same Auth user may already belong to another hotel.
  const { data: anyOrg } = await supabase
    .from("organization_invitations")
    .select("auth_user_id, created_at")
    .eq("email", normalizedEmail)
    .not("auth_user_id", "is", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (anyOrg?.auth_user_id) {
    return String(anyOrg.auth_user_id);
  }

  for (let page = 1; page <= 10; page += 1) {
    const { data, error } = await supabase.auth.admin.listUsers({
      page,
      perPage: 200,
    });
    if (error) {
      throw new Error(error.message);
    }
    const match = (data.users ?? []).find(
      (user) => normalizeEmail(user.email ?? "") === normalizedEmail
    );
    if (match?.id) {
      return match.id;
    }
    if ((data.users ?? []).length < 200) {
      break;
    }
  }

  return null;
}

export async function createAdministratorInvitation(
  supabase: SupabaseClient,
  actorUserId: string,
  organizationId: number,
  body: Record<string, unknown>,
  options?: CreateAdministratorInvitationOptions
): Promise<AdminOrganizationInvitation> {
  const input = parseCreateAdministratorInvitationInput(body, options);

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

  // The first administrator for an organization becomes the Primary Owner.
  const hasPrimary = await organizationHasPrimaryAdministrator(supabase, organizationId);
  const isPrimary = !hasPrimary;
  const { orgRole, propertyRole } = isPrimary
    ? { orgRole: "org_owner" as const, propertyRole: "property_admin" as const }
    : resolveInviteRoles(input.role);

  if (!isPrimary && input.role === "property_administrator" && input.propertyIds.length < 1) {
    throw new PlatformAdminRequestError(
      400,
      "Selected Properties access requires at least one property"
    );
  }
  if (
    !isPrimary &&
    input.role === "organization_admin" &&
    input.propertyIds.length < 1
  ) {
    throw new PlatformAdminRequestError(
      400,
      "Entire Organization access requires a default landing property"
    );
  }

  // Primary Owner and Organization Admin are org-wide; only one landing
  // property is stored for team_members / user_properties home.
  // Selected Properties leaders keep every chosen property id.
  const propertyIds =
    isPrimary || input.role === "organization_admin"
      ? [input.propertyIds[0]]
      : input.propertyIds;
  const homePropertyId = propertyIds[0];

  const { data: orgProperties, error: orgPropertiesError } = await supabase
    .from("properties")
    .select("id, name, organization_id, active")
    .eq("organization_id", organizationId)
    .in("id", propertyIds);

  if (orgPropertiesError) {
    throw new Error(orgPropertiesError.message);
  }
  if ((orgProperties ?? []).length !== propertyIds.length) {
    throw new PlatformAdminRequestError(
      404,
      "One or more properties were not found for this organization"
    );
  }

  const property =
    (orgProperties ?? []).find((row) => Number(row.id) === homePropertyId) ??
    (orgProperties ?? [])[0];

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

  const jobTitle = input.jobTitle;

  const expiresAt = new Date(
    Date.now() + INVITATION_TTL_DAYS * 24 * 60 * 60 * 1000
  ).toISOString();

  const includeAssigned = await supportsAssignedPropertyIdsColumn(supabase);
  const includeOrgAdminAccess = await supportsOrgAdminAccessColumn(supabase);
  const insertPayload: Record<string, unknown> = {
    organization_id: organizationId,
    property_id: homePropertyId,
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
  };
  if (includeAssigned) {
    insertPayload.assigned_property_ids = propertyIds;
  }
  if (includeOrgAdminAccess) {
    insertPayload.org_admin_portal_access = input.orgAdminPortalAccess;
  }

  const { data: invitation, error: insertError } = await supabase
    .from("organization_invitations")
    .insert(insertPayload)
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
  const inviterName = await resolveInviterDisplayName(supabase, actorUserId);
  const expirationDateLabel = formatInvitationExpirationDate(expiresAt);
  const organizationName = organization.name;

  const inviteMetadata = {
    oe_invitation_id: invitationId,
    oe_assigned_property_ids: propertyIds,
    first_name: input.firstName,
    last_name: input.lastName,
    job_title: jobTitle,
    is_administrator: true,
  };

  let authUserId: string | null = null;

  async function sendBrandedInvite(): Promise<{
    userId: string | null;
    error: { message: string } | null;
  }> {
    const result = await inviteUserOrGenerateLink(supabase, input.email, {
      redirectTo: resolveInviteRedirectUrl(),
      data: inviteMetadata,
      recipientName: `${input.firstName} ${input.lastName}`.trim(),
      inviterName,
      organizationName,
      expirationDate: expirationDateLabel,
      invitationId,
      recommendDesktop:
        isPrimary ||
        orgRole === "org_admin" ||
        propertyIds.length > 1,
    });
    return {
      userId: result.data.user?.id ?? null,
      error: result.error,
    };
  }

  let inviteResult = await sendBrandedInvite();

  if (inviteResult.error) {
    const message = inviteResult.error.message.toLowerCase();
    const canCreateFallback =
      message.includes("rate limit") || message.includes("invalid");
    const alreadyRegistered =
      message.includes("already") ||
      message.includes("registered") ||
      message.includes("exists");

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
      inviteResult = await sendBrandedInvite();
    } else if (alreadyRegistered) {
      const existingAuthUserId = await findExistingAuthUserIdForEmail(
        supabase,
        organizationId,
        input.email
      );
      if (!existingAuthUserId) {
        await supabase.from("organization_invitations").delete().eq("id", invitationId);
        throw new PlatformAdminRequestError(
          502,
          `Supabase invitation failed: ${inviteResult.error.message}`
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
      inviteResult = await sendBrandedInvite();
    } else {
      await supabase.from("organization_invitations").delete().eq("id", invitationId);
      throw new PlatformAdminRequestError(
        502,
        `Invitation email failed: ${inviteResult.error.message}`
      );
    }
  }

  if (inviteResult.error) {
    await supabase.from("organization_invitations").delete().eq("id", invitationId);
    throw new PlatformAdminRequestError(
      502,
      `Invitation email failed: ${inviteResult.error.message}`
    );
  }

  authUserId = inviteResult.userId ?? authUserId;

  if (authUserId) {
    await supabase.auth.admin.updateUserById(authUserId, {
      user_metadata: inviteMetadata,
    });
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
    propertyId: homePropertyId,
    metadata: {
      email: input.email,
      firstName: input.firstName,
      lastName: input.lastName,
      organizationName: organization.name,
      propertyName: property.name,
      propertyIds,
      orgRole,
      propertyRole,
      jobTitle,
      isPrimary,
      orgAdminPortalAccess: input.orgAdminPortalAccess,
      delivery: "resend",
    },
  });

  const invitations = await fetchOrganizationInvitations(supabase, organizationId);
  const created = invitations.find((row) => row.id === invitationId);
  if (!created) {
    throw new Error("Created invitation could not be loaded");
  }

  return created;
}
