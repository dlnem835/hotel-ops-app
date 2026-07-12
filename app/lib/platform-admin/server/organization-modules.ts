import type { SupabaseClient } from "@supabase/supabase-js";
import {
  MODULE_PERMISSION_KEYS,
} from "@/app/lib/role-permissions";
import {
  ORGANIZATION_MODULE_KEYS,
  type OrganizationModuleKey,
} from "@/app/lib/platform-admin/organization-module-keys";
import { writeAdminAuditLog } from "@/app/lib/platform-admin/server/admin-audit-log";
import type { AdminOrganizationModule } from "@/app/lib/platform-admin/types";
import { PlatformAdminRequestError } from "@/app/lib/platform-admin/server/resolve-platform-admin-request";

export type OrganizationModuleUpdate = {
  moduleKey: OrganizationModuleKey;
  enabled: boolean;
};

function isOrganizationModuleKey(value: string): value is OrganizationModuleKey {
  return ORGANIZATION_MODULE_KEYS.includes(value as OrganizationModuleKey);
}

export function parseOrganizationModuleUpdates(
  body: Record<string, unknown>
): OrganizationModuleUpdate[] {
  const rawModules = body.modules;

  if (!Array.isArray(rawModules) || rawModules.length === 0) {
    throw new PlatformAdminRequestError(400, "modules array is required");
  }

  const updates: OrganizationModuleUpdate[] = [];
  const seen = new Set<string>();

  for (const entry of rawModules) {
    if (!entry || typeof entry !== "object") {
      throw new PlatformAdminRequestError(400, "Each module update must be an object");
    }

    const record = entry as Record<string, unknown>;
    const moduleKey = String(record.moduleKey ?? record.module_key ?? "").trim();
    if (!isOrganizationModuleKey(moduleKey)) {
      throw new PlatformAdminRequestError(400, `Invalid module key: ${moduleKey || "(empty)"}`);
    }
    if (seen.has(moduleKey)) {
      throw new PlatformAdminRequestError(400, `Duplicate module key: ${moduleKey}`);
    }
    seen.add(moduleKey);

    updates.push({
      moduleKey,
      enabled: Boolean(record.enabled),
    });
  }

  if (updates.length !== ORGANIZATION_MODULE_KEYS.length) {
    throw new PlatformAdminRequestError(
      400,
      `All ${ORGANIZATION_MODULE_KEYS.length} module keys must be provided`
    );
  }

  for (const moduleKey of ORGANIZATION_MODULE_KEYS) {
    if (!seen.has(moduleKey)) {
      throw new PlatformAdminRequestError(400, `Missing module key: ${moduleKey}`);
    }
  }

  return updates;
}

export async function fetchOrganizationModules(
  supabase: SupabaseClient,
  organizationId: number
): Promise<AdminOrganizationModule[]> {
  const { data, error } = await supabase
    .from("organization_modules")
    .select("module_key, enabled")
    .eq("organization_id", organizationId)
    .order("module_key", { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []).map((row) => ({
    moduleKey: String(row.module_key),
    enabled: Boolean(row.enabled),
  }));
}

function capModulePermissions(
  permissions: Record<string, boolean> | null | undefined,
  enabledModuleKeys: Set<string>
): Record<string, boolean> {
  const next: Record<string, boolean> = {};

  for (const key of MODULE_PERMISSION_KEYS) {
    next[key] = Boolean(permissions?.[key]) && enabledModuleKeys.has(key);
  }

  return next;
}

async function syncMembershipPermissionsForOrganization(
  supabase: SupabaseClient,
  organizationId: number,
  enabledModuleKeys: Set<string>
) {
  const { data: properties, error: propertyError } = await supabase
    .from("properties")
    .select("id")
    .eq("organization_id", organizationId);

  if (propertyError) {
    throw new Error(propertyError.message);
  }

  const propertyIds = (properties ?? []).map((row) => row.id as number);

  if (propertyIds.length > 0) {
    const { data: propertyMemberships, error: propertyMembershipError } = await supabase
      .from("user_properties")
      .select("id, property_id, module_permissions")
      .in("property_id", propertyIds);

    if (propertyMembershipError) {
      throw new Error(propertyMembershipError.message);
    }

    for (const membership of propertyMemberships ?? []) {
      const capped = capModulePermissions(
        membership.module_permissions as Record<string, boolean> | null,
        enabledModuleKeys
      );

      const { error } = await supabase
        .from("user_properties")
        .update({
          module_permissions: capped,
          updated_at: new Date().toISOString(),
        })
        .eq("id", membership.id);

      if (error) {
        throw new Error(error.message);
      }
    }
  }

  const { data: teamMembers, error: teamMemberError } = await supabase
    .from("team_members")
    .select("id, module_permissions")
    .eq("organization_id", organizationId);

  if (teamMemberError) {
    throw new Error(teamMemberError.message);
  }

  for (const member of teamMembers ?? []) {
    const capped = capModulePermissions(
      member.module_permissions as Record<string, boolean> | null,
      enabledModuleKeys
    );

    const { error } = await supabase
      .from("team_members")
      .update({
        module_permissions: capped,
        updated_at: new Date().toISOString(),
      })
      .eq("id", member.id);

    if (error) {
      throw new Error(error.message);
    }
  }
}

export async function updateOrganizationModules(
  supabase: SupabaseClient,
  actorUserId: string,
  organizationId: number,
  updates: OrganizationModuleUpdate[]
): Promise<AdminOrganizationModule[]> {
  const { data: organization, error: orgError } = await supabase
    .from("organizations")
    .select("id, name")
    .eq("id", organizationId)
    .maybeSingle();

  if (orgError) {
    throw new Error(orgError.message);
  }
  if (!organization) {
    throw new PlatformAdminRequestError(404, "Organization not found");
  }

  const previousModules = await fetchOrganizationModules(supabase, organizationId);
  const previousByKey = new Map(previousModules.map((row) => [row.moduleKey, row.enabled]));

  const timestamp = new Date().toISOString();
  for (const update of updates) {
    const { error } = await supabase
      .from("organization_modules")
      .update({
        enabled: update.enabled,
        updated_at: timestamp,
      })
      .eq("organization_id", organizationId)
      .eq("module_key", update.moduleKey);

    if (error) {
      throw new Error(error.message);
    }
  }

  const nextModules = await fetchOrganizationModules(supabase, organizationId);
  const enabledModuleKeys = new Set(
    nextModules.filter((row) => row.enabled).map((row) => row.moduleKey)
  );

  await syncMembershipPermissionsForOrganization(
    supabase,
    organizationId,
    enabledModuleKeys
  );

  const changedModules = updates
    .filter((update) => previousByKey.get(update.moduleKey) !== update.enabled)
    .map((update) => ({
      moduleKey: update.moduleKey,
      enabled: update.enabled,
      previousEnabled: previousByKey.get(update.moduleKey) ?? null,
    }));

  if (changedModules.length > 0) {
    await writeAdminAuditLog(supabase, {
      actorUserId,
      action: "modules.updated",
      targetType: "organization",
      targetId: String(organizationId),
      organizationId,
      metadata: {
        organizationName: organization.name,
        changedModules,
        enabledModules: [...enabledModuleKeys],
      },
    });
  }

  return nextModules;
}
