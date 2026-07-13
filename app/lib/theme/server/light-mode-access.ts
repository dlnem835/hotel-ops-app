/**
 * Server-only module. Reads a non-NEXT_PUBLIC env var, so it must only be
 * imported from route handlers / server code — never a client component.
 *
 * Single server-side decision point for Light Mode availability.
 *
 * Light Mode is experimental and authorized to exactly one auth.users.id, held
 * in the server-only env var LIGHT_MODE_ALLOWED_USER_ID. This value is never
 * exposed to the client (no NEXT_PUBLIC_*). Authorization is by UUID only — not
 * username, email, hotel role, organization role, or platform_admin status.
 *
 * To later release Light Mode to everyone, change this function to return true;
 * the rest of the theme system consumes only the resolved boolean.
 */
export function isLightModeAllowedForUser(
  userId: string | null | undefined
): boolean {
  const allowed = process.env.LIGHT_MODE_ALLOWED_USER_ID?.trim();
  if (!allowed || !userId) {
    return false;
  }
  return userId === allowed;
}
