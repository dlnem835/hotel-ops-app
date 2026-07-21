/** Path helpers for the internal platform admin portal (/admin). */

export function isPlatformAdminPath(pathname: string): boolean {
  const path = pathname.split("?")[0] ?? pathname;
  return path === "/admin" || path.startsWith("/admin/");
}

export function isAdminAccessDeniedPath(pathname: string | null | undefined): boolean {
  const path = pathname?.split("?")[0] ?? pathname ?? "";
  return path === "/admin/access-denied";
}

export const ADMIN_LOGIN_NEXT = "/admin";

/**
 * Build the login URL for an unauthenticated admin request. When an intended
 * admin route is provided, it becomes the post-login `next` target so authorized
 * Platform Admins return to where they were headed; otherwise we fall back to the
 * admin home. Non-admin paths are ignored to avoid leaking non-admin redirects.
 */
export function adminLoginUrl(intendedPath?: string | null): string {
  const next =
    intendedPath && isPlatformAdminPath(intendedPath) ? intendedPath : ADMIN_LOGIN_NEXT;
  return `/login?next=${encodeURIComponent(next)}`;
}
