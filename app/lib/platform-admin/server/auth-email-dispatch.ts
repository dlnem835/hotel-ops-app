import type { SupabaseClient } from "@supabase/supabase-js";
import { dispatchInvitationEmail } from "@/app/lib/email/dispatch-invitation-email";
import { dispatchPasswordResetEmail } from "@/app/lib/email/dispatch-password-reset";
import { resolveInviteRedirectUrl } from "@/app/lib/email/auth-email-config";

export { authEmailsSuppressed } from "@/app/lib/platform-admin/server/auth-email-suppress";

/** Normalized result for invitation provisioning + optional Resend delivery. */
export type AuthUserDispatchResult = {
  data: { user: { id: string } | null };
  error: { message: string } | null;
  emailDispatched?: boolean;
  messageId?: string | null;
};

export type InviteDispatchOptions = {
  redirectTo?: string;
  data: Record<string, unknown>;
  recipientName?: string | null;
  inviterName?: string | null;
  organizationName?: string | null;
  expirationDate?: string | null;
  invitationId?: string | null;
  recommendDesktop?: boolean;
};

/**
 * Provisions an invite/magic Auth link via admin.generateLink (never
 * inviteUserByEmail) and sends the branded invitation through Resend.
 * Does not send a duplicate Supabase Auth mailer email.
 */
export async function inviteUserOrGenerateLink(
  supabase: SupabaseClient,
  email: string,
  options: InviteDispatchOptions
): Promise<AuthUserDispatchResult> {
  const result = await dispatchInvitationEmail(supabase, {
    email,
    recipientName: options.recipientName,
    inviterName: options.inviterName,
    organizationName: options.organizationName,
    expirationDate: options.expirationDate,
    invitationId: options.invitationId,
    redirectTo: options.redirectTo ?? resolveInviteRedirectUrl(),
    userMetadata: options.data,
    recommendDesktop: options.recommendDesktop,
  });

  return {
    data: { user: result.userId ? { id: result.userId } : null },
    error: result.error,
    emailDispatched: result.emailDispatched,
    messageId: result.messageId,
  };
}

/**
 * Sends a branded password-reset email via Resend with a first-party
 * One Eyrie recovery URL (token_hash + verifyOtp on the reset page).
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
