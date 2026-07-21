import type { SupabaseClient } from "@supabase/supabase-js";
import { isOrgWideRole } from "@/app/lib/platform-admin/roles";
import { ADMIN_PORTAL_MODULE_KEY } from "@/app/lib/platform-admin/organization-module-keys";

/**
 * Admin Portal access (server helpers).
 *
 * Access to the customer Admin Portal (/admin-portal) requires BOTH:
 *   1. The organization's `admin_portal` module is enabled (org-level, One
 *      Eyrie-controlled — see organization_modules).
 *   2. The user's `org_admin_portal_access` column on `organization_users` is
 *      true (per-user entitlement, One Eyrie-controlled — never inferred from
 *      role, Access Scope, or Primary Owner).
 *
 * These helpers read defensively: if the entitlement column has not been applied
 * yet (migration 049) they fall back to the previous org-wide role behavior, and
 * if the org module row is not present yet (migration 050) the module is treated
 * as enabled, so access is not accidentally locked out before migrations run.
 */

export const ORG_ADMIN_ACCESS_COLUMN = "org_admin_portal_access";

let columnSupported: boolean | null = null;

function isMissingColumnError(message: string): boolean {
  return /org_admin_portal_access/i.test(message) && /column|does not exist/i.test(message);
}

/**
 * Org-level availability gate for the Admin Portal. Fail-open only when no row
 * exists yet (pre-backfill); an explicit `enabled = false` row blocks the portal
 * for every user in the organization regardless of individual entitlement.
 */
export async function isAdminPortalModuleEnabled(
  supabase: SupabaseClient,
  organizationId: number
): Promise<boolean> {
  const { data, error } = await supabase
    .from("organization_modules")
    .select("enabled")
    .eq("organization_id", organizationId)
    .eq("module_key", ADMIN_PORTAL_MODULE_KEY)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }
  // No row yet (migration 050 not applied / not backfilled) → default enabled.
  if (!data) return true;
  return Boolean(data.enabled);
}

export type OrgAdminMembership = {
  organizationId: number;
  orgRole: string;
  /** True when the caller administers every current + future property. */
  orgWide: boolean;
  /** Active property ids the caller may reach (all org properties when orgWide). */
  assignedPropertyIds: number[];
};

async function loadAssignedPropertyIds(
  supabase: SupabaseClient,
  userId: string,
  organizationId: number
): Promise<number[]> {
  const { data: orgProperties, error: orgPropertiesError } = await supabase
    .from("properties")
    .select("id")
    .eq("organization_id", organizationId);

  if (orgPropertiesError) {
    throw new Error(orgPropertiesError.message);
  }
  const orgPropertyIds = (orgProperties ?? []).map((row) => Number(row.id));
  if (orgPropertyIds.length === 0) {
    return [];
  }

  const { data, error } = await supabase
    .from("user_properties")
    .select("property_id, active")
    .eq("user_id", userId)
    .eq("active", true)
    .in("property_id", orgPropertyIds);

  if (error) {
    throw new Error(error.message);
  }
  return (data ?? []).map((row) => Number(row.property_id));
}

async function selectMembershipRole(
  supabase: SupabaseClient,
  userId: string,
  organizationId: number
): Promise<{ role: string; hasAccess: boolean } | null> {
  // Prefer the explicit entitlement column; fall back to org-wide role only when
  // the column is not present yet (pre-migration safety).
  if (columnSupported !== false) {
    const { data, error } = await supabase
      .from("organization_users")
      .select(`role, active, ${ORG_ADMIN_ACCESS_COLUMN}`)
      .eq("user_id", userId)
      .eq("organization_id", organizationId)
      .eq("active", true)
      .maybeSingle();

    if (error) {
      if (isMissingColumnError(error.message)) {
        columnSupported = false;
      } else {
        throw new Error(error.message);
      }
    } else {
      columnSupported = true;
      if (!data) return null;
      const role = String((data as Record<string, unknown>).role ?? "");
      const hasAccess = Boolean(
        (data as Record<string, unknown>)[ORG_ADMIN_ACCESS_COLUMN]
      );
      return { role, hasAccess };
    }
  }

  const { data, error } = await supabase
    .from("organization_users")
    .select("role, active")
    .eq("user_id", userId)
    .eq("organization_id", organizationId)
    .eq("active", true)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }
  if (!data) return null;
  const role = String(data.role ?? "");
  // Pre-migration fallback: org-wide admins keep access.
  return { role, hasAccess: isOrgWideRole(role) };
}

/**
 * Resolves the caller's Organization Administration membership for a specific
 * organization. Returns null when the user is not an active member OR does not
 * hold the entitlement.
 */
export async function resolveOrgAdminMembership(
  supabase: SupabaseClient,
  userId: string,
  organizationId: number
): Promise<OrgAdminMembership | null> {
  const membership = await selectMembershipRole(supabase, userId, organizationId);
  if (!membership || !membership.hasAccess) {
    return null;
  }

  // Both gates must be true: individual entitlement AND org-level module.
  const moduleEnabled = await isAdminPortalModuleEnabled(supabase, organizationId);
  if (!moduleEnabled) {
    return null;
  }

  const orgWide = isOrgWideRole(membership.role);
  const assignedPropertyIds = orgWide
    ? []
    : await loadAssignedPropertyIds(supabase, userId, organizationId);

  return {
    organizationId,
    orgRole: membership.role,
    orgWide,
    assignedPropertyIds,
  };
}

/**
 * Finds the user's active organization membership that carries the entitlement.
 * Used by the sidebar/access endpoint where no specific org id is supplied.
 */
export async function findOrgAdminMembershipForUser(
  supabase: SupabaseClient,
  userId: string
): Promise<{ organizationId: number; orgRole: string } | null> {
  if (columnSupported !== false) {
    const { data, error } = await supabase
      .from("organization_users")
      .select(`organization_id, role, active, ${ORG_ADMIN_ACCESS_COLUMN}`)
      .eq("user_id", userId)
      .eq("active", true);

    if (error) {
      if (isMissingColumnError(error.message)) {
        columnSupported = false;
      } else {
        throw new Error(error.message);
      }
    } else {
      columnSupported = true;
      const candidates = (data ?? []).filter((row) =>
        Boolean((row as Record<string, unknown>)[ORG_ADMIN_ACCESS_COLUMN])
      );
      return firstMembershipWithModuleEnabled(supabase, candidates);
    }
  }

  const { data, error } = await supabase
    .from("organization_users")
    .select("organization_id, role, active")
    .eq("user_id", userId)
    .eq("active", true);

  if (error) {
    throw new Error(error.message);
  }
  const candidates = (data ?? []).filter((row) =>
    isOrgWideRole(String(row.role ?? ""))
  );
  return firstMembershipWithModuleEnabled(supabase, candidates);
}

/**
 * Given entitled membership rows, returns the first whose organization also has
 * the Admin Portal module enabled. Both gates must hold to surface the portal.
 */
async function firstMembershipWithModuleEnabled(
  supabase: SupabaseClient,
  candidates: Array<{ organization_id: unknown; role?: unknown }>
): Promise<{ organizationId: number; orgRole: string } | null> {
  for (const row of candidates) {
    const organizationId = Number(row.organization_id);
    if (!(await isAdminPortalModuleEnabled(supabase, organizationId))) {
      continue;
    }
    return {
      organizationId,
      orgRole: String(row.role ?? ""),
    };
  }
  return null;
}
