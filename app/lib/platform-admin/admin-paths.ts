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

export function adminLoginUrl(): string {
  return `/login?next=${encodeURIComponent(ADMIN_LOGIN_NEXT)}`;
}
