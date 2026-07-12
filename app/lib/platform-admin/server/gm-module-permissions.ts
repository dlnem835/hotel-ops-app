import {
  MODULE_PERMISSION_KEYS,
  getAdministratorPermissions,
  type ModulePermissionKey,
  type ModulePermissions,
} from "@/app/lib/role-permissions";

export function resolveGmModulePermissions(
  enabledModuleKeys: string[]
): ModulePermissions {
  const enabled = new Set(
    enabledModuleKeys.map((key) => key.trim()).filter(Boolean)
  );
  const administrator = getAdministratorPermissions();
  const permissions = {} as ModulePermissions;

  for (const key of MODULE_PERMISSION_KEYS) {
    permissions[key] = Boolean(administrator[key] && enabled.has(key));
  }

  return permissions;
}

export function modulePermissionKeyFromOrganizationModule(
  moduleKey: string
): ModulePermissionKey | null {
  return MODULE_PERMISSION_KEYS.includes(moduleKey as ModulePermissionKey)
    ? (moduleKey as ModulePermissionKey)
    : null;
}
