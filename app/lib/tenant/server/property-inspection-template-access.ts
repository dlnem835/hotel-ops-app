import type { SupabaseClient } from "@supabase/supabase-js";
import {
  isOrgWideRole,
  PROPERTY_ROLE,
} from "@/app/lib/platform-admin/roles";
import { TenantRequestError } from "@/app/lib/tenant/server/resolve-tenant-request";

export type InspectionTemplateAccessScope = {
  organizationId: number;
  propertyId: number;
};

export type InspectionTemplateAccessSnapshot = {
  organizationStatus: string | null;
  organizationUser: { role: string; active: boolean } | null;
  property: { organizationId: number; active: boolean } | null;
  userProperty: {
    role: string;
    active: boolean;
    modulePermissions: Record<string, boolean> | null;
  } | null;
  teamMember: {
    status: string | null;
    canLogin: boolean;
    modulePermissions: Record<string, boolean> | null;
  } | null;
};

function hasSettingsPermission(
  permissions: Record<string, boolean> | null | undefined
): boolean {
  return Boolean(permissions?.settings);
}

function isActiveTeamMember(member: InspectionTemplateAccessSnapshot["teamMember"]) {
  if (!member) return false;
  return String(member.status || "").trim() === "Active" && member.canLogin === true;
}

/**
 * Property inspection template writes follow the canonical One Eyrie
 * membership model (org_role + user_properties). Job titles never grant
 * access. Inactive / disabled memberships never grant access.
 *
 * Allow when the caller has an active membership on this organization and:
 *   • org_owner / org_admin — every active property in that organization
 *   • property_admin — only the assigned property
 *   • explicit Settings permission on this property
 */
export function canManagePropertyInspectionTemplates(
  snapshot: InspectionTemplateAccessSnapshot,
  scope: InspectionTemplateAccessScope
): boolean {
  const property = snapshot.property;
  if (
    !property ||
    !property.active ||
    property.organizationId !== scope.organizationId
  ) {
    return false;
  }

  if (snapshot.organizationStatus && snapshot.organizationStatus !== "active") {
    return false;
  }

  const orgUser = snapshot.organizationUser;
  if (!orgUser || !orgUser.active) {
    return false;
  }

  if (isOrgWideRole(orgUser.role)) {
    return true;
  }

  const userProperty = snapshot.userProperty;
  if (
    userProperty?.active &&
    userProperty.role === PROPERTY_ROLE.propertyAdministrator
  ) {
    return true;
  }

  const settingsFromProperty =
    Boolean(userProperty?.active) &&
    hasSettingsPermission(userProperty?.modulePermissions);
  const settingsFromTeam =
    isActiveTeamMember(snapshot.teamMember) &&
    hasSettingsPermission(snapshot.teamMember?.modulePermissions);

  return settingsFromProperty || settingsFromTeam;
}

export async function loadInspectionTemplateAccessSnapshot(
  supabase: SupabaseClient,
  authUserId: string,
  scope: InspectionTemplateAccessScope
): Promise<InspectionTemplateAccessSnapshot> {
  const [orgUserResult, propertyResult, userPropertyResult, teamMemberResult] =
    await Promise.all([
      supabase
        .from("organization_users")
        .select("role, active")
        .eq("user_id", authUserId)
        .eq("organization_id", scope.organizationId)
        .maybeSingle(),
      supabase
        .from("properties")
        .select("organization_id, active, organizations!inner(status)")
        .eq("id", scope.propertyId)
        .maybeSingle(),
      supabase
        .from("user_properties")
        .select("role, active, module_permissions")
        .eq("user_id", authUserId)
        .eq("property_id", scope.propertyId)
        .maybeSingle(),
      supabase
        .from("team_members")
        .select("status, can_login, module_permissions")
        .eq("auth_user_id", authUserId)
        .eq("organization_id", scope.organizationId)
        .eq("property_id", scope.propertyId)
        .maybeSingle(),
    ]);

  for (const result of [
    orgUserResult,
    propertyResult,
    userPropertyResult,
    teamMemberResult,
  ]) {
    if (result.error) {
      throw new Error(result.error.message);
    }
  }

  const propertyRow = propertyResult.data as
    | {
        organization_id: number;
        active: boolean;
        organizations?: { status?: string } | { status?: string }[] | null;
      }
    | null;

  const organizationRelation = propertyRow?.organizations;
  const organizationStatus = Array.isArray(organizationRelation)
    ? organizationRelation[0]?.status ?? null
    : organizationRelation?.status ?? null;

  return {
    organizationStatus,
    organizationUser: orgUserResult.data
      ? {
          role: String(orgUserResult.data.role),
          active: Boolean(orgUserResult.data.active),
        }
      : null,
    property: propertyRow
      ? {
          organizationId: Number(propertyRow.organization_id),
          active: Boolean(propertyRow.active),
        }
      : null,
    userProperty: userPropertyResult.data
      ? {
          role: String(userPropertyResult.data.role),
          active: Boolean(userPropertyResult.data.active),
          modulePermissions:
            (userPropertyResult.data.module_permissions as Record<
              string,
              boolean
            > | null) ?? null,
        }
      : null,
    teamMember: teamMemberResult.data
      ? {
          status: teamMemberResult.data.status
            ? String(teamMemberResult.data.status)
            : null,
          canLogin: Boolean(teamMemberResult.data.can_login),
          modulePermissions:
            (teamMemberResult.data.module_permissions as Record<
              string,
              boolean
            > | null) ?? null,
        }
      : null,
  };
}

export async function assertCanManagePropertyInspectionTemplates(
  supabase: SupabaseClient,
  authUserId: string,
  scope: InspectionTemplateAccessScope
) {
  const snapshot = await loadInspectionTemplateAccessSnapshot(
    supabase,
    authUserId,
    scope
  );
  if (!canManagePropertyInspectionTemplates(snapshot, scope)) {
    throw new TenantRequestError(
      403,
      "You do not have permission to manage inspection templates"
    );
  }
}
