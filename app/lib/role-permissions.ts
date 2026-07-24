export const JOB_TITLE_OPTIONS = [
  "General Manager",
  "Assistant General Manager",
  "Front Desk Supervisor",
  "Front Desk Agent",
  "Executive Housekeeper",
  "Housekeeping Supervisor",
  "Housekeeper",
  "Chief Engineer",
  "Maintenance Technician",
  "Inspector",
  "Sales Manager",
  "F&B Supervisor",
  "Breakfast Attendant",
  "Bartender",
] as const;

export type JobTitleOption = (typeof JOB_TITLE_OPTIONS)[number];

export type InspectionAssociateProgram = "VR" | "RPM";

/** Team members selectable as associate on housekeeping room inspections (VR / SO). */
export const HOUSEKEEPING_ASSOCIATE_JOB_TITLES = [
  "Executive Housekeeper",
  "Housekeeping Supervisor",
  "Housekeeper",
] as const satisfies readonly JobTitleOption[];

/** Team members selectable as associate on RPM inspections. */
export const MAINTENANCE_ASSOCIATE_JOB_TITLES = [
  "Chief Engineer",
  "Maintenance Technician",
] as const satisfies readonly JobTitleOption[];

export function getAssociateJobTitlesForInspectionProgram(
  program: InspectionAssociateProgram
): readonly string[] {
  return program === "RPM"
    ? MAINTENANCE_ASSOCIATE_JOB_TITLES
    : HOUSEKEEPING_ASSOCIATE_JOB_TITLES;
}

export function memberJobTitleMatchesInspectionProgram(
  jobTitle: string | null | undefined,
  program: InspectionAssociateProgram
): boolean {
  const normalized = (jobTitle || "").trim();
  if (!normalized) return false;
  return getAssociateJobTitlesForInspectionProgram(program).includes(normalized);
}

export function getInspectionAssociateFieldLabel(
  program: InspectionAssociateProgram
): string {
  return program === "RPM" ? "Maintenance" : "Housekeeper";
}

export const MODULE_PERMISSION_KEYS = [
  "dashboard",
  "reports",
  "lost_found",
  "pass_on",
  "inspections",
  "maintenance",
  "settings",
] as const;

export type ModulePermissionKey = (typeof MODULE_PERMISSION_KEYS)[number];

export type ModulePermissions = Record<ModulePermissionKey, boolean>;

export const MODULE_PERMISSION_LABELS: Record<ModulePermissionKey, string> = {
  dashboard: "Dashboard",
  reports: "Reports",
  lost_found: "Lost & Found",
  pass_on: "Pass-On Log",
  inspections: "Inspections",
  maintenance: "Maintenance",
  settings: "Settings",
};

export type MobileModuleKey =
  | "pass_on"
  | "work_orders"
  | "pms"
  | "rpms"
  | "inspections";

export const DESKTOP_NAV_ITEMS: Array<{
  key: ModulePermissionKey;
  label: string;
  href: string;
}> = [
  { key: "dashboard", label: "Dashboard", href: "/" },
  { key: "pass_on", label: "Pass-On", href: "/pass-on-log" },
  { key: "maintenance", label: "Maintenance", href: "/maintenance" },
  { key: "inspections", label: "Inspections", href: "/inspections" },
  { key: "lost_found", label: "Lost & Found", href: "/lost-and-found" },
  { key: "reports", label: "Reports", href: "/reports" },
  { key: "settings", label: "Settings", href: "/settings" },
];

const MOBILE_MODULE_PATHS: Record<MobileModuleKey, string> = {
  pass_on: "/mobile/pass-on-log",
  work_orders: "/mobile/work-orders",
  pms: "/mobile/pms",
  rpms: "/mobile/rpms",
  inspections: "/mobile/inspections",
};

export type UserAccessProfile = {
  jobTitle: string | null;
  isAdministrator: boolean;
  permissions: ModulePermissions;
};

export function createEmptyPermissions(): ModulePermissions {
  return {
    dashboard: false,
    reports: false,
    lost_found: false,
    pass_on: false,
    inspections: false,
    maintenance: false,
    settings: false,
  };
}

export function getAdministratorPermissions(): ModulePermissions {
  return {
    dashboard: true,
    reports: true,
    lost_found: true,
    pass_on: true,
    inspections: true,
    maintenance: true,
    settings: true,
  };
}

function hasAnyExplicitPermission(permissions: ModulePermissions): boolean {
  return MODULE_PERMISSION_KEYS.some((key) => permissions[key]);
}

/** Legacy fallback for users created before module checkboxes existed. */
function permissionsFromLegacyRole(role: string | null | undefined): ModulePermissions {
  const value = (role || "").trim().toLowerCase();
  const permissions = createEmptyPermissions();

  if (value.includes("admin") || value.includes("gm")) {
    return getAdministratorPermissions();
  }

  permissions.dashboard = true;
  permissions.pass_on = true;
  permissions.reports = true;

  if (value === "manager") {
    permissions.lost_found = true;
    permissions.inspections = true;
    permissions.maintenance = true;
    return permissions;
  }

  if (value.includes("front desk")) {
    permissions.lost_found = true;
    return permissions;
  }

  if (value === "inspector" || value === "housekeeper") {
    permissions.inspections = true;
    return permissions;
  }

  if (value.includes("rpm") || value.includes("maintenance")) {
    permissions.maintenance = true;
    return permissions;
  }

  return permissions;
}

/** Reports is available to any user with standard desktop module access. */
function withDesktopReportsAccess(permissions: ModulePermissions): ModulePermissions {
  const hasDesktopModuleAccess =
    permissions.dashboard ||
    permissions.pass_on ||
    permissions.maintenance ||
    permissions.inspections ||
    permissions.lost_found;

  if (!hasDesktopModuleAccess) {
    return permissions;
  }

  return { ...permissions, reports: true };
}

export function normalizeModulePermissions(
  value: Partial<ModulePermissions> | Record<string, boolean> | null | undefined
): ModulePermissions {
  const permissions = createEmptyPermissions();
  if (!value || typeof value !== "object") return permissions;

  for (const key of MODULE_PERMISSION_KEYS) {
    permissions[key] = Boolean(value[key]);
  }

  return permissions;
}

export function resolveEffectivePermissions(input: {
  isAdministrator?: boolean | null;
  modulePermissions?: Partial<ModulePermissions> | Record<string, boolean> | null;
  legacyRole?: string | null;
}): ModulePermissions {
  if (input.isAdministrator) {
    return getAdministratorPermissions();
  }

  const stored = normalizeModulePermissions(input.modulePermissions);
  if (hasAnyExplicitPermission(stored)) {
    return withDesktopReportsAccess(stored);
  }

  return withDesktopReportsAccess(permissionsFromLegacyRole(input.legacyRole));
}

export function buildUserAccessProfile(input: {
  jobTitle?: string | null;
  legacyRole?: string | null;
  isAdministrator?: boolean | null;
  modulePermissions?: Partial<ModulePermissions> | Record<string, boolean> | null;
}): UserAccessProfile {
  const jobTitle = (input.jobTitle || input.legacyRole || "").trim() || null;
  const isAdministrator = Boolean(input.isAdministrator);
  const permissions = resolveEffectivePermissions({
    isAdministrator,
    modulePermissions: input.modulePermissions,
    legacyRole: input.legacyRole ?? jobTitle,
  });

  return { jobTitle, isAdministrator, permissions };
}

export function getDesktopNavItemsForPermissions(permissions: ModulePermissions) {
  return DESKTOP_NAV_ITEMS.filter((item) => permissions[item.key]);
}

export function getMobileModulesForPermissions(
  permissions: ModulePermissions
): MobileModuleKey[] {
  const modules: MobileModuleKey[] = [];
  if (permissions.pass_on) modules.push("pass_on");
  if (permissions.maintenance) {
    modules.push("work_orders", "pms", "rpms");
  }
  if (permissions.inspections) modules.push("inspections");
  return modules;
}

export function getDefaultDesktopHome(permissions: ModulePermissions): string {
  const items = getDesktopNavItemsForPermissions(permissions);
  return items[0]?.href ?? "/pass-on-log";
}

export function getDefaultMobileHome(permissions: ModulePermissions): string {
  const modules = getMobileModulesForPermissions(permissions);
  if (modules.length > 1) return "/mobile";
  if (modules.length === 1) return MOBILE_MODULE_PATHS[modules[0]];
  return "/pass-on-log";
}

export function isPublicAppPath(pathname: string): boolean {
  const path = pathname.split("?")[0] ?? pathname;
  return (
    path === "/login" ||
    path.startsWith("/login") ||
    path === "/shipping-request" ||
    path.startsWith("/shipping-request/")
  );
}

export function isMobileAppPath(pathname: string): boolean {
  const path = pathname.split("?")[0] ?? pathname;
  return path === "/mobile" || path.startsWith("/mobile/");
}

export function isPlatformAdminAppPath(pathname: string): boolean {
  const path = pathname.split("?")[0] ?? pathname;
  return path === "/admin" || path.startsWith("/admin/");
}

/**
 * Routes an authenticated-but-incomplete user is still allowed to reach:
 * first-login account setup and the auth callback. Login/logout is handled by
 * isPublicAppPath. Everything else is gated until setup is complete.
 */
export function isAccountOnboardingPath(pathname: string): boolean {
  const path = pathname.split("?")[0] ?? pathname;
  return (
    path === "/onboarding/account" ||
    path.startsWith("/onboarding/account") ||
    path === "/auth/callback" ||
    path.startsWith("/auth/callback")
  );
}

function canAccessDesktopPath(permissions: ModulePermissions, path: string): boolean {
  if (path === "/" || path === "") return permissions.dashboard;
  if (path.startsWith("/reports")) return permissions.reports;
  if (path.startsWith("/lost-and-found")) return permissions.lost_found;
  if (path.startsWith("/pass-on-log")) return permissions.pass_on;
  if (path.startsWith("/inspections")) return permissions.inspections;
  if (path.startsWith("/maintenance")) return permissions.maintenance;
  if (path.startsWith("/settings")) return permissions.settings;
  if (path.startsWith("/label") || path.startsWith("/send-label")) {
    return permissions.lost_found;
  }

  return permissions.dashboard;
}

function canAccessMobilePath(permissions: ModulePermissions, path: string): boolean {
  const modules = getMobileModulesForPermissions(permissions);
  if (modules.length === 0) return false;

  if (path === "/mobile" || path === "/mobile/") return true;

  return modules.some((moduleKey) => path.startsWith(MOBILE_MODULE_PATHS[moduleKey]));
}

export function canAccessPath(
  permissions: ModulePermissions,
  pathname: string
): boolean {
  const path = pathname.split("?")[0] ?? pathname;

  if (isPublicAppPath(path)) return true;
  if (isPlatformAdminAppPath(path)) return true;
  if (path.startsWith("/api/") || path.startsWith("/_next/")) return true;

  if (isMobileAppPath(path)) {
    return canAccessMobilePath(permissions, path);
  }

  return canAccessDesktopPath(permissions, path);
}

export function resolveRedirectForPath(
  permissions: ModulePermissions,
  pathname: string
): string | null {
  if (canAccessPath(permissions, pathname)) return null;
  return isMobileAppPath(pathname)
    ? getDefaultMobileHome(permissions)
    : getDefaultDesktopHome(permissions);
}

export function permissionsToDraftFlags(
  permissions: ModulePermissions
): Record<`perm_${ModulePermissionKey}`, string> {
  return MODULE_PERMISSION_KEYS.reduce(
    (flags, key) => {
      flags[`perm_${key}`] = permissions[key] ? "true" : "false";
      return flags;
    },
    {} as Record<`perm_${ModulePermissionKey}`, string>
  );
}

export function draftFlagsToPermissions(
  draft: Record<string, string>
): ModulePermissions {
  return MODULE_PERMISSION_KEYS.reduce((permissions, key) => {
    permissions[key] = draft[`perm_${key}`] === "true";
    return permissions;
  }, createEmptyPermissions());
}

export type OneEyrieNavLabel = (typeof DESKTOP_NAV_ITEMS)[number]["label"];
