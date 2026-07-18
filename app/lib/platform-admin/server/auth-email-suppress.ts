/**
 * Development / automated-testing aid for auth transactional emails.
 *
 * When enabled, invite and password-reset flows generate Supabase action links
 * WITHOUT dispatching email (Resend or Supabase mailer).
 *
 * - Defaults to disabled (emails send) when unset.
 * - Unconditionally ignored in production (`NODE_ENV === "production"`).
 * - Set `SUPPRESS_AUTH_EMAILS=true` in `.env.local` only for verification scripts.
 */
export function authEmailsSuppressed(): boolean {
  if (process.env.NODE_ENV === "production") return false;

  const raw = (process.env.SUPPRESS_AUTH_EMAILS ?? "").trim().toLowerCase();
  return raw === "1" || raw === "true" || raw === "yes" || raw === "on";
}
