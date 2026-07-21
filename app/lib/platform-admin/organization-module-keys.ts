import {
  MODULE_PERMISSION_LABELS,
  type ModulePermissionKey,
} from "@/app/lib/role-permissions";

/**
 * Organization-level module keys shown in the internal Module Controls section.
 *
 * Most keys mirror the user feature modules (`ModulePermissionKey`). `admin_portal`
 * is an ADDITIONAL org-level availability control that is intentionally NOT a user
 * module permission: it gates the customer Admin Portal (/admin-portal) entitlement
 * and never rewrites per-user operational `module_permissions`.
 */
export const ORGANIZATION_MODULE_KEYS = [
  "dashboard",
  "reports",
  "lost_found",
  "pass_on",
  "inspections",
  "maintenance",
  "settings",
  "admin_portal",
] as const;

export type OrganizationModuleKey = (typeof ORGANIZATION_MODULE_KEYS)[number];

/** Org module key that governs the customer Admin Portal availability. */
export const ADMIN_PORTAL_MODULE_KEY = "admin_portal" satisfies OrganizationModuleKey;

/** Feature-module keys that also map to user permissions (excludes admin_portal). */
export const ORGANIZATION_FEATURE_MODULE_KEYS = ORGANIZATION_MODULE_KEYS.filter(
  (key): key is ModulePermissionKey => key !== ADMIN_PORTAL_MODULE_KEY
);

export const ORGANIZATION_MODULE_LABELS: Record<OrganizationModuleKey, string> = {
  ...MODULE_PERMISSION_LABELS,
  admin_portal: "Admin Portal",
};
