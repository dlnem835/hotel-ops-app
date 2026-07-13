import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Whether transactional auth emails (invite / resend / password reset) should be
 * suppressed.
 *
 * This is STRICTLY a development / automated-testing aid. When enabled, the
 * invite and recovery flows generate the Supabase action link via
 * `generateLink` WITHOUT dispatching an email, so verification scripts can
 * exercise the full invitation lifecycle without creating bounced-email traffic.
 *
 * Production fail-safe: suppression is unconditionally ignored whenever
 * `NODE_ENV === "production"`, so live deployments always send real emails
 * regardless of the flag. It defaults to disabled (real emails) everywhere else.
 */
export function authEmailsSuppressed(): boolean {
  // Never suppress in production, even if the flag is mistakenly set.
  if (process.env.NODE_ENV === "production") return false;

  const raw = (process.env.SUPPRESS_AUTH_EMAILS ?? "").trim().toLowerCase();
  return raw === "1" || raw === "true" || raw === "yes" || raw === "on";
}

/** Normalized result mirroring the shape callers rely on from inviteUserByEmail. */
export type AuthUserDispatchResult = {
  data: { user: { id: string } | null };
  error: { message: string } | null;
};

/**
 * Invites a user by email, or — when auth-email suppression is enabled —
 * provisions the equivalent invite via `generateLink` (type "invite") WITHOUT
 * sending an email. Both paths create the auth user when it does not yet exist
 * and return a benign "already registered" error otherwise, so callers can keep
 * their existing fallback handling unchanged.
 */
export async function inviteUserOrGenerateLink(
  supabase: SupabaseClient,
  email: string,
  options: { redirectTo: string; data: Record<string, unknown> }
): Promise<AuthUserDispatchResult> {
  if (authEmailsSuppressed()) {
    const { data, error } = await supabase.auth.admin.generateLink({
      type: "invite",
      email,
      options: { redirectTo: options.redirectTo, data: options.data },
    });
    return {
      data: { user: data?.user ? { id: data.user.id } : null },
      error: error ? { message: error.message } : null,
    };
  }

  const { data, error } = await supabase.auth.admin.inviteUserByEmail(email, {
    redirectTo: options.redirectTo,
    data: options.data,
  });
  return {
    data: { user: data?.user ? { id: data.user.id } : null },
    error: error ? { message: error.message } : null,
  };
}

/**
 * Sends a password-reset email, or — when suppression is enabled — generates the
 * recovery action link via `generateLink` (type "recovery") WITHOUT sending an
 * email.
 */
export async function sendPasswordResetOrGenerateLink(
  supabase: SupabaseClient,
  email: string,
  options: { redirectTo: string }
): Promise<{ error: { message: string } | null }> {
  if (authEmailsSuppressed()) {
    const { error } = await supabase.auth.admin.generateLink({
      type: "recovery",
      email,
      options: { redirectTo: options.redirectTo },
    });
    return { error: error ? { message: error.message } : null };
  }

  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: options.redirectTo,
  });
  return { error: error ? { message: error.message } : null };
}
