import type { SupabaseClient } from "@supabase/supabase-js";
import { writeAdminAuditLog } from "@/app/lib/platform-admin/server/admin-audit-log";
import { fetchOrganizationInvitations } from "@/app/lib/platform-admin/server/create-gm-invitation";
import { PlatformAdminRequestError } from "@/app/lib/platform-admin/server/resolve-platform-admin-request";
import {
  isOrgWideRole,
  resolveInviteRoles,
  type AdministratorInviteRole,
} from "@/app/lib/platform-admin/roles";
import type { AdminOrganizationInvitation } from "@/app/lib/platform-admin/types";
import {
  MODULE_PERMISSION_KEYS,
  createEmptyPermissions,
  normalizeModulePermissions,
  type ModulePermissions,
} from "@/app/lib/role-permissions";

const DEFAULT_JOB_TITLE = "Administrator";
const JOB_TITLE_MAX_LENGTH = 80;

export type UpdateAdministratorInput = {
  firstName: string;
  lastName: string;
  jobTitle: string;
  role: AdministratorInviteRole;
  propertyIds: number[];
  modulePermissions: ModulePermissions;
  confirmAccessReduction: boolean;
};

type InvitationRow = {
  id: string;
  organization_id: number;
  property_id: number;
  email: string;
  first_name: string;
  last_name: string;
  job_title: string;
  status: string;
  is_primary: boolean | null;
  org_role: string;
  property_role: string;
  auth_user_id: string | null;
};

type OrgUserSnapshot = {
  role: string;
  active: boolean;
};

type UserPropertySnapshot = {
  property_id: number;
  role: string;
  is_default: boolean;
  active: boolean;
  module_permissions: Record<string, boolean> | null;
};

type TeamMemberSnapshot = {
  id: number | string;
  first_name: string | null;
  last_name: string | null;
  job_title: string | null;
  role: string | null;
  property_id: number | null;
  default_property_id: number | null;
  module_permissions: Record<string, boolean> | null;
};

type UpdateSnapshot = {
  invitation: InvitationRow;
  orgUser: OrgUserSnapshot | null;
  userProperties: UserPropertySnapshot[];
  teamMembers: TeamMemberSnapshot[];
  profile: { first_name: string | null; last_name: string | null } | null;
};

function arraysEqualSorted(a: number[], b: number[]): boolean {
  if (a.length !== b.length) return false;
  const left = [...a].sort((x, y) => x - y);
  const right = [...b].sort((x, y) => x - y);
  return left.every((value, index) => value === right[index]);
}

function permissionsEqual(a: ModulePermissions, b: ModulePermissions): boolean {
  return MODULE_PERMISSION_KEYS.every((key) => Boolean(a[key]) === Boolean(b[key]));
}

function permissionsDiff(
  before: ModulePermissions,
  after: ModulePermissions
): Record<string, { from: boolean; to: boolean }> {
  const changed: Record<string, { from: boolean; to: boolean }> = {};
  for (const key of MODULE_PERMISSION_KEYS) {
    if (Boolean(before[key]) !== Boolean(after[key])) {
      changed[key] = { from: Boolean(before[key]), to: Boolean(after[key]) };
    }
  }
  return changed;
}

export function parseUpdateAdministratorInput(
  body: Record<string, unknown>
): UpdateAdministratorInput {
  const firstName = String(body.firstName ?? body.first_name ?? "").trim();
  const lastName = String(body.lastName ?? body.last_name ?? "").trim();
  const jobTitle =
    String(body.jobTitle ?? body.job_title ?? "")
      .trim()
      .slice(0, JOB_TITLE_MAX_LENGTH) || DEFAULT_JOB_TITLE;

  const rawRole = String(body.role ?? "property_administrator");
  const role: AdministratorInviteRole =
    rawRole === "organization_admin" ? "organization_admin" : "property_administrator";

  const rawPropertyIds = body.propertyIds ?? body.property_ids ?? [];
  if (!Array.isArray(rawPropertyIds) || rawPropertyIds.length === 0) {
    throw new PlatformAdminRequestError(400, "At least one property is required");
  }

  const propertyIds = Array.from(
    new Set(
      rawPropertyIds.map((value) => Number.parseInt(String(value), 10)).filter(
        (value) => Number.isInteger(value) && value > 0
      )
    )
  );

  if (propertyIds.length === 0) {
    throw new PlatformAdminRequestError(400, "At least one property is required");
  }

  if (!firstName) {
    throw new PlatformAdminRequestError(400, "First name is required");
  }
  if (!lastName) {
    throw new PlatformAdminRequestError(400, "Last name is required");
  }

  const rawModules =
    body.modulePermissions ?? body.module_permissions ?? createEmptyPermissions();
  if (!rawModules || typeof rawModules !== "object" || Array.isArray(rawModules)) {
    throw new PlatformAdminRequestError(400, "modulePermissions object is required");
  }

  return {
    firstName,
    lastName,
    jobTitle,
    role,
    propertyIds,
    modulePermissions: normalizeModulePermissions(
      rawModules as Record<string, boolean>
    ),
    confirmAccessReduction: Boolean(
      body.confirmAccessReduction ?? body.confirm_access_reduction
    ),
  };
}

async function loadInvitation(
  supabase: SupabaseClient,
  organizationId: number,
  invitationId: string
): Promise<InvitationRow> {
  const { data, error } = await supabase
    .from("organization_invitations")
    .select(
      "id, organization_id, property_id, email, first_name, last_name, job_title, status, is_primary, org_role, property_role, auth_user_id"
    )
    .eq("id", invitationId)
    .eq("organization_id", organizationId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }
  if (!data) {
    throw new PlatformAdminRequestError(404, "Administrator not found");
  }
  return data as InvitationRow;
}

async function loadOrganizationPropertyIds(
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
  return (data ?? []).map((row) => Number(row.id));
}

async function loadEnabledModuleKeys(
  supabase: SupabaseClient,
  organizationId: number
): Promise<Set<string>> {
  const { data, error } = await supabase
    .from("organization_modules")
    .select("module_key")
    .eq("organization_id", organizationId)
    .eq("enabled", true);

  if (error) {
    throw new Error(error.message);
  }
  return new Set((data ?? []).map((row) => String(row.module_key)));
}

function capPermissionsToEnabled(
  permissions: ModulePermissions,
  enabled: Set<string>
): ModulePermissions {
  const next = createEmptyPermissions();
  for (const key of MODULE_PERMISSION_KEYS) {
    next[key] = Boolean(permissions[key]) && enabled.has(key);
  }
  return next;
}

async function captureSnapshot(
  supabase: SupabaseClient,
  invitation: InvitationRow,
  organizationId: number,
  orgPropertyIds: number[]
): Promise<UpdateSnapshot> {
  const authUserId = invitation.auth_user_id;
  if (!authUserId) {
    return {
      invitation,
      orgUser: null,
      userProperties: [],
      teamMembers: [],
      profile: null,
    };
  }

  const { data: orgUser, error: orgUserError } = await supabase
    .from("organization_users")
    .select("role, active")
    .eq("organization_id", organizationId)
    .eq("user_id", authUserId)
    .maybeSingle();

  if (orgUserError) {
    throw new Error(orgUserError.message);
  }

  let userProperties: UserPropertySnapshot[] = [];
  if (orgPropertyIds.length > 0) {
    const { data, error } = await supabase
      .from("user_properties")
      .select("property_id, role, is_default, active, module_permissions")
      .eq("user_id", authUserId)
      .in("property_id", orgPropertyIds);

    if (error) {
      throw new Error(error.message);
    }
    userProperties = (data ?? []) as UserPropertySnapshot[];
  }

  const { data: teamMembers, error: teamError } = await supabase
    .from("team_members")
    .select(
      "id, first_name, last_name, job_title, role, property_id, default_property_id, module_permissions"
    )
    .eq("auth_user_id", authUserId)
    .eq("organization_id", organizationId);

  if (teamError) {
    throw new Error(teamError.message);
  }

  const { data: profile, error: profileError } = await supabase
    .from("user_profiles")
    .select("first_name, last_name")
    .eq("user_id", authUserId)
    .maybeSingle();

  if (profileError) {
    throw new Error(profileError.message);
  }

  return {
    invitation: { ...invitation },
    orgUser: orgUser
      ? { role: String(orgUser.role), active: Boolean(orgUser.active) }
      : null,
    userProperties,
    teamMembers: (teamMembers ?? []) as TeamMemberSnapshot[],
    profile: profile
      ? {
          first_name: profile.first_name ?? null,
          last_name: profile.last_name ?? null,
        }
      : null,
  };
}

async function restoreSnapshot(
  supabase: SupabaseClient,
  organizationId: number,
  snapshot: UpdateSnapshot
): Promise<void> {
  const invitation = snapshot.invitation;
  const authUserId = invitation.auth_user_id;
  const timestamp = new Date().toISOString();

  await supabase
    .from("organization_invitations")
    .update({
      first_name: invitation.first_name,
      last_name: invitation.last_name,
      job_title: invitation.job_title,
      property_id: invitation.property_id,
      org_role: invitation.org_role,
      property_role: invitation.property_role,
      updated_at: timestamp,
    })
    .eq("id", invitation.id);

  if (!authUserId) {
    return;
  }

  if (snapshot.orgUser) {
    await supabase
      .from("organization_users")
      .update({
        role: snapshot.orgUser.role,
        active: snapshot.orgUser.active,
        updated_at: timestamp,
      })
      .eq("organization_id", organizationId)
      .eq("user_id", authUserId);
  }

  for (const row of snapshot.userProperties) {
    await supabase.from("user_properties").upsert(
      {
        user_id: authUserId,
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
        first_name: member.first_name,
        last_name: member.last_name,
        job_title: member.job_title,
        role: member.role,
        property_id: member.property_id,
        default_property_id: member.default_property_id,
        module_permissions: member.module_permissions,
      })
      .eq("id", member.id);
  }

  if (snapshot.profile) {
    await supabase
      .from("user_profiles")
      .update({
        first_name: snapshot.profile.first_name,
        last_name: snapshot.profile.last_name,
        updated_at: timestamp,
      })
      .eq("user_id", authUserId);
  }
}

function currentActivePropertyIds(snapshot: UpdateSnapshot): number[] {
  return snapshot.userProperties
    .filter((row) => row.active)
    .map((row) => Number(row.property_id));
}

function currentModulePermissions(snapshot: UpdateSnapshot): ModulePermissions {
  const defaultRow =
    snapshot.userProperties.find((row) => row.is_default && row.active) ??
    snapshot.userProperties.find((row) => row.active) ??
    null;
  const fromTeam = snapshot.teamMembers[0]?.module_permissions ?? null;
  return normalizeModulePermissions(
    defaultRow?.module_permissions ?? fromTeam ?? createEmptyPermissions()
  );
}

function detectAccessReduction(input: {
  isPrimary: boolean;
  beforeOrgRole: string;
  afterOrgRole: string;
  beforePropertyIds: number[];
  afterPropertyIds: number[];
  beforeModules: ModulePermissions;
  afterModules: ModulePermissions;
}): string[] {
  const reasons: string[] = [];
  if (input.isPrimary) {
    return reasons;
  }

  if (isOrgWideRole(input.beforeOrgRole) && !isOrgWideRole(input.afterOrgRole)) {
    reasons.push("Changing from organization-wide access to selected properties");
  }

  if (
    input.beforeOrgRole === "org_admin" &&
    input.afterOrgRole === "org_member"
  ) {
    reasons.push("Downgrading from Organization Admin to Property Administrator");
  }

  const removedProperties = input.beforePropertyIds.filter(
    (id) => !input.afterPropertyIds.includes(id)
  );
  if (removedProperties.length > 0 && !isOrgWideRole(input.afterOrgRole)) {
    reasons.push("Removing one or more assigned properties");
  }

  for (const key of MODULE_PERMISSION_KEYS) {
    if (input.beforeModules[key] && !input.afterModules[key]) {
      reasons.push("Removing one or more module permissions");
      break;
    }
  }

  return reasons;
}

/**
 * Updates an accepted administrator's profile, role/scope, property assignments,
 * and module permissions. Email / Primary Owner designation are never changed.
 * Applies changes with a before-snapshot restore on failure to avoid partial state.
 */
export async function updateAdministrator(
  supabase: SupabaseClient,
  actorUserId: string,
  organizationId: number,
  invitationId: string,
  input: UpdateAdministratorInput
): Promise<AdminOrganizationInvitation> {
  const invitation = await loadInvitation(supabase, organizationId, invitationId);

  if (invitation.status !== "accepted") {
    throw new PlatformAdminRequestError(
      409,
      "Only accepted administrators can be edited"
    );
  }
  if (!invitation.auth_user_id) {
    throw new PlatformAdminRequestError(409, "Administrator has no linked account");
  }

  const orgPropertyIds = await loadOrganizationPropertyIds(supabase, organizationId);
  if (orgPropertyIds.length === 0) {
    throw new PlatformAdminRequestError(409, "Organization has no properties");
  }

  for (const propertyId of input.propertyIds) {
    if (!orgPropertyIds.includes(propertyId)) {
      throw new PlatformAdminRequestError(
        400,
        "One or more properties do not belong to this organization"
      );
    }
  }

  const enabledModuleKeys = await loadEnabledModuleKeys(supabase, organizationId);
  const cappedModules = capPermissionsToEnabled(
    input.modulePermissions,
    enabledModuleKeys
  );

  const isPrimary = Boolean(invitation.is_primary);
  const snapshot = await captureSnapshot(
    supabase,
    invitation,
    organizationId,
    orgPropertyIds
  );

  if (!snapshot.orgUser) {
    throw new PlatformAdminRequestError(
      409,
      "Administrator membership is missing for this organization"
    );
  }

  const beforePropertyIds = currentActivePropertyIds(snapshot);
  const beforeModules = currentModulePermissions(snapshot);
  const beforeOrgRole = String(invitation.org_role);

  let afterOrgRole = beforeOrgRole;
  let afterPropertyRole = String(invitation.property_role);
  let afterPropertyIds = [...input.propertyIds];
  let afterModules = cappedModules;

  if (isPrimary) {
    // Primary Owner may only change name + job title. Role/scope/modules stay.
    afterOrgRole = "org_owner";
    afterPropertyRole = invitation.property_role || "property_admin";
    afterPropertyIds =
      beforePropertyIds.length > 0 ? beforePropertyIds : [invitation.property_id];
    afterModules = beforeModules;

    if (input.role === "property_administrator") {
      throw new PlatformAdminRequestError(
        409,
        "The Primary Owner cannot be changed to property-only scope. Transfer Primary Owner first."
      );
    }
    if (!arraysEqualSorted(input.propertyIds, [invitation.property_id]) &&
        !arraysEqualSorted(input.propertyIds, afterPropertyIds)) {
      throw new PlatformAdminRequestError(
        409,
        "The Primary Owner property assignments cannot be changed in this workflow."
      );
    }
    if (!permissionsEqual(cappedModules, beforeModules)) {
      throw new PlatformAdminRequestError(
        409,
        "The Primary Owner module permissions cannot be changed in this workflow."
      );
    }
  } else {
    const resolved = resolveInviteRoles(input.role);
    afterOrgRole = resolved.orgRole;
    afterPropertyRole = resolved.propertyRole;
    afterPropertyIds = [...input.propertyIds];

    if (input.role === "property_administrator" && afterPropertyIds.length !== 1) {
      throw new PlatformAdminRequestError(
        400,
        "Property Administrator must be assigned to exactly one property"
      );
    }
    if (input.role === "organization_admin" && afterPropertyIds.length < 1) {
      throw new PlatformAdminRequestError(
        400,
        "Organization Admin must have a default landing property"
      );
    }
  }

  const reductionReasons = detectAccessReduction({
    isPrimary,
    beforeOrgRole,
    afterOrgRole,
    beforePropertyIds,
    afterPropertyIds,
    beforeModules,
    afterModules,
  });

  if (reductionReasons.length > 0 && !input.confirmAccessReduction) {
    throw new PlatformAdminRequestError(
      409,
      `Confirm access reduction before saving: ${reductionReasons.join("; ")}`
    );
  }

  const changed: Record<string, unknown> = {};
  if (invitation.first_name !== input.firstName) {
    changed.firstName = { from: invitation.first_name, to: input.firstName };
  }
  if (invitation.last_name !== input.lastName) {
    changed.lastName = { from: invitation.last_name, to: input.lastName };
  }
  if (invitation.job_title !== input.jobTitle) {
    changed.jobTitle = { from: invitation.job_title, to: input.jobTitle };
  }
  if (!isPrimary && beforeOrgRole !== afterOrgRole) {
    changed.orgRole = { from: beforeOrgRole, to: afterOrgRole };
  }
  if (!isPrimary && !arraysEqualSorted(beforePropertyIds, afterPropertyIds)) {
    changed.propertyIds = {
      from: beforePropertyIds,
      to: afterPropertyIds,
    };
  }
  const moduleChanges = permissionsDiff(beforeModules, afterModules);
  if (Object.keys(moduleChanges).length > 0) {
    changed.modulePermissions = moduleChanges;
  }

  if (Object.keys(changed).length === 0) {
    const invitations = await fetchOrganizationInvitations(supabase, organizationId);
    const current = invitations.find((row) => row.id === invitation.id);
    if (!current) {
      throw new PlatformAdminRequestError(404, "Administrator not found");
    }
    return current;
  }

  const authUserId = invitation.auth_user_id;
  const timestamp = new Date().toISOString();
  const effectiveHomeId = isPrimary
    ? invitation.property_id
    : afterPropertyIds[0];

  try {
    const invitationUpdate: Record<string, unknown> = {
      first_name: input.firstName,
      last_name: input.lastName,
      job_title: input.jobTitle,
      property_id: effectiveHomeId,
      org_role: afterOrgRole,
      property_role: afterPropertyRole,
      updated_at: timestamp,
    };

    const { error: assignedColumnProbe } = await supabase
      .from("organization_invitations")
      .select("assigned_property_ids")
      .limit(1);
    if (!assignedColumnProbe) {
      invitationUpdate.assigned_property_ids = isPrimary
        ? [effectiveHomeId]
        : afterPropertyIds;
    }

    const { error: invitationError } = await supabase
      .from("organization_invitations")
      .update(invitationUpdate)
      .eq("id", invitation.id)
      .eq("organization_id", organizationId)
      .eq("status", "accepted");

    if (invitationError) {
      throw new Error(invitationError.message);
    }

    const { error: orgUserError } = await supabase
      .from("organization_users")
      .update({
        role: afterOrgRole,
        updated_at: timestamp,
      })
      .eq("organization_id", organizationId)
      .eq("user_id", authUserId);

    if (orgUserError) {
      throw new Error(orgUserError.message);
    }

    const targetPropertyIds = isOrgWideRole(afterOrgRole)
      ? [effectiveHomeId]
      : afterPropertyIds;

    const targetSet = new Set(targetPropertyIds);

    // Clear the previous default first. Postgres enforces at most one active
    // is_default=true row per user (user_properties_one_default_per_user).
    for (const propertyId of orgPropertyIds) {
      if (propertyId === effectiveHomeId) continue;
      const { error } = await supabase
        .from("user_properties")
        .update({
          is_default: false,
          active: targetSet.has(propertyId),
          ...(targetSet.has(propertyId)
            ? {
                role: afterPropertyRole,
                module_permissions: afterModules,
              }
            : {}),
          updated_at: timestamp,
        })
        .eq("user_id", authUserId)
        .eq("property_id", propertyId);
      if (error) {
        throw new Error(error.message);
      }
    }

    // Upsert desired active assignments (no duplicates via onConflict).
    for (const propertyId of targetPropertyIds) {
      const { error } = await supabase.from("user_properties").upsert(
        {
          user_id: authUserId,
          property_id: propertyId,
          role: afterPropertyRole,
          is_default: propertyId === effectiveHomeId,
          active: true,
          module_permissions: afterModules,
          updated_at: timestamp,
        },
        { onConflict: "user_id,property_id" }
      );
      if (error) {
        throw new Error(error.message);
      }
    }

    // Deactivate org property memberships that are no longer assigned.
    for (const propertyId of orgPropertyIds) {
      if (targetSet.has(propertyId)) continue;
      const { error } = await supabase
        .from("user_properties")
        .update({
          active: false,
          is_default: false,
          updated_at: timestamp,
        })
        .eq("user_id", authUserId)
        .eq("property_id", propertyId);
      if (error) {
        throw new Error(error.message);
      }
    }

    if (snapshot.teamMembers.length > 0) {
      const primaryMember =
        snapshot.teamMembers.find(
          (member) => Number(member.property_id) === effectiveHomeId
        ) ?? snapshot.teamMembers[0];

      const { error: teamError } = await supabase
        .from("team_members")
        .update({
          first_name: input.firstName,
          last_name: input.lastName,
          job_title: input.jobTitle,
          role: input.jobTitle,
          property_id: effectiveHomeId,
          default_property_id: effectiveHomeId,
          module_permissions: afterModules,
        })
        .eq("id", primaryMember.id);

      if (teamError) {
        throw new Error(teamError.message);
      }

      // Keep other team_member rows in this org permission-consistent.
      for (const member of snapshot.teamMembers) {
        if (member.id === primaryMember.id) continue;
        const { error } = await supabase
          .from("team_members")
          .update({
            first_name: input.firstName,
            last_name: input.lastName,
            job_title: input.jobTitle,
            module_permissions: afterModules,
          })
          .eq("id", member.id);
        if (error) {
          throw new Error(error.message);
        }
      }
    }

    const { data: existingProfile, error: existingProfileError } = await supabase
      .from("user_profiles")
      .select("user_id")
      .eq("user_id", authUserId)
      .maybeSingle();

    if (existingProfileError) {
      throw new Error(existingProfileError.message);
    }

    if (existingProfile) {
      const { error: profileError } = await supabase
        .from("user_profiles")
        .update({
          first_name: input.firstName,
          last_name: input.lastName,
          updated_at: timestamp,
        })
        .eq("user_id", authUserId);

      if (profileError) {
        throw new Error(profileError.message);
      }
    }
  } catch (error) {
    await restoreSnapshot(supabase, organizationId, snapshot).catch(() => {
      // Best-effort restore; surface the original failure below.
    });
    if (error instanceof PlatformAdminRequestError) {
      throw error;
    }
    throw new Error(
      error instanceof Error ? error.message : "Failed to update administrator"
    );
  }

  await writeAdminAuditLog(supabase, {
    actorUserId,
    action: "administrator.updated",
    targetType: "organization_invitation",
    targetId: invitation.id,
    organizationId,
    propertyId: effectiveHomeId,
    metadata: {
      email: invitation.email,
      isPrimary,
      changed,
      accessReductionConfirmed: reductionReasons.length > 0,
    },
  });

  const invitations = await fetchOrganizationInvitations(supabase, organizationId);
  const updated = invitations.find((row) => row.id === invitation.id);
  if (!updated) {
    throw new PlatformAdminRequestError(404, "Administrator not found after update");
  }
  return updated;
}
