import { fetchTeamMemberAccess } from "@/app/lib/current-user-role";
import {
  DESKTOP_LOGIN_DEFAULT,
  MOBILE_LOGIN_DEFAULT,
} from "@/app/lib/login-return";
import {
  canAccessPath,
  getDefaultDesktopHome,
  getDefaultMobileHome,
  isMobileAppPath,
  isPlatformAdminAppPath,
  type ModulePermissions,
} from "@/app/lib/role-permissions";
import {
  readInterfacePreference,
  resolvePreferredShell,
  type AppShell,
} from "@/app/lib/viewport-interface";

function homeForShell(
  shell: AppShell,
  permissions: ModulePermissions | null
): string {
  if (!permissions) {
    return shell === "mobile" ? MOBILE_LOGIN_DEFAULT : DESKTOP_LOGIN_DEFAULT;
  }
  return shell === "mobile"
    ? getDefaultMobileHome(permissions)
    : getDefaultDesktopHome(permissions);
}

/**
 * Picks the post-auth landing path from viewport (or interface preference)
 * and the user's module permissions. Honors an explicit safe redirect when
 * present (e.g. `/admin` or a deep mobile link from `?next=`).
 */
export async function resolveAuthenticatedAppHome(options?: {
  explicitTarget?: string | null;
}): Promise<string> {
  const explicitTarget = options?.explicitTarget ?? null;

  if (explicitTarget && isPlatformAdminAppPath(explicitTarget)) {
    return explicitTarget;
  }

  const access = await fetchTeamMemberAccess();
  const permissions = access?.permissions ?? null;

  if (explicitTarget && permissions && canAccessPath(permissions, explicitTarget)) {
    return explicitTarget;
  }

  // Explicit mobile deep-link without full access still prefers mobile home.
  if (explicitTarget && isMobileAppPath(explicitTarget)) {
    return homeForShell("mobile", permissions);
  }

  const shell = resolvePreferredShell(readInterfacePreference());
  return homeForShell(shell, permissions);
}

/** Home for the preferred shell given already-loaded permissions. */
export function resolveHomeForPermissions(
  permissions: ModulePermissions
): string {
  const shell = resolvePreferredShell(readInterfacePreference());
  return homeForShell(shell, permissions);
}
