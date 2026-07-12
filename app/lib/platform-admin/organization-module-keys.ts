import type { ModulePermissionKey } from "@/app/lib/role-permissions";

export const ORGANIZATION_MODULE_KEYS = [
  "dashboard",
  "reports",
  "lost_found",
  "pass_on",
  "inspections",
  "maintenance",
  "settings",
] as const satisfies readonly ModulePermissionKey[];

export type OrganizationModuleKey = (typeof ORGANIZATION_MODULE_KEYS)[number];
