import type { SupabaseClient } from "@supabase/supabase-js";
import { dispatchPasswordResetEmail } from "@/app/lib/email/dispatch-password-reset";
import { authEmailsSuppressed } from "@/app/lib/platform-admin/server/auth-email-suppress";
import { recipientDomainForLog } from "@/app/lib/email/auth-email-config";

export { authEmailsSuppressed } from "@/app/lib/platform-admin/server/auth-email-suppress";

/** Normalized result mirroring the shape callers rely on from inviteUserByEmail. */
export type AuthUserDispatchResult = {
  data: { user: { id: string } | null };
  error: { message: string } | null;
};

/**
 * Invites a user by email, or — when auth-email suppression is enabled —
 * provisions the equivalent invite via `generateLink` (type "invite") WITHOUT
 * sending an email.
 *
 * Note: Invitation emails still use Supabase Auth mailer when not suppressed.
 * Password-reset uses Resend + branded templates separately.
 */
export async function inviteUserOrGenerateLink(
  supabase: SupabaseClient,
  email: string,
  options: { redirectTo: string; data: Record<string, unknown> }
): Promise<AuthUserDispatchResult> {
  if (authEmailsSuppressed()) {
    console.info("Auth email suppressed in development", {
      domain: recipientDomainForLog(email),
      kind: "invitation",
    });
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
 * Sends a branded password-reset email via Resend.
 * Recovery link is generated for the linked Auth user; delivery goes to contact email.
 */
export async function sendPasswordResetOrGenerateLink(
  supabase: SupabaseClient,
  options: {
    authUserId: string;
    deliveryEmail: string;
    recipientName?: string | null;
    invitationId?: string | null;
    redirectTo?: string;
  }
): Promise<{ error: { message: string } | null; messageId?: string | null }> {
  const result = await dispatchPasswordResetEmail(supabase, {
    authUserId: options.authUserId,
    deliveryEmail: options.deliveryEmail,
    recipientName: options.recipientName,
    invitationId: options.invitationId,
    redirectTo: options.redirectTo,
  });

  if (result.error) {
    return { error: result.error, messageId: result.messageId };
  }

  return { error: null, messageId: result.messageId };
}
