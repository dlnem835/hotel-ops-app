import type { SupabaseClient } from "@supabase/supabase-js";
import {
  logAuthEmailConfigError,
  recipientDomainForLog,
  resolveAuthEmailConfig,
  resolvePasswordResetRedirectUrl,
} from "@/app/lib/email/auth-email-config";
import {
  buildPasswordResetAcceptUrl,
  extractHashedToken,
} from "@/app/lib/email/auth-link";
import { buildPasswordResetEmail } from "@/app/lib/email/password-reset-email";
import { sendBrandedEmailViaResend } from "@/app/lib/email/send-branded-email";
import { authEmailsSuppressed } from "@/app/lib/platform-admin/server/auth-email-suppress";

export type DispatchPasswordResetResult = {
  linkGenerated: boolean;
  emailDispatched: boolean;
  messageId: string | null;
  error: { message: string } | null;
};

export type DispatchPasswordResetInput = {
  /** Linked Auth user id — authoritative identity for generateLink. */
  authUserId: string;
  /** Real contact email for Resend delivery (never used for Auth lookup). */
  deliveryEmail: string;
  recipientName?: string | null;
  /** Safe correlation id for logs (invitation id, etc.). */
  invitationId?: string | null;
  redirectTo?: string;
};

function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

/**
 * Generates a recovery hashed_token for the linked Auth user, then sends a
 * branded reset email with a first-party One Eyrie URL (never *.supabase.co).
 *
 * Never logs Auth identity emails, recovery tokens, token hashes, or full URLs.
 */
export async function dispatchPasswordResetEmail(
  supabase: SupabaseClient,
  input: DispatchPasswordResetInput
): Promise<DispatchPasswordResetResult> {
  const authUserId = String(input.authUserId || "").trim();
  const deliveryEmail = normalizeEmail(input.deliveryEmail);
  const deliveryDomain = recipientDomainForLog(deliveryEmail);
  const invitationId = input.invitationId ? String(input.invitationId) : null;
  const redirectTo = input.redirectTo ?? resolvePasswordResetRedirectUrl();

  const logBase = {
    invitationId,
    authUserIdPresent: Boolean(authUserId),
    deliveryDomain,
  };

  if (!authUserId) {
    console.error("[auth-email] Password reset missing auth_user_id", logBase);
    return {
      linkGenerated: false,
      emailDispatched: false,
      messageId: null,
      error: { message: "No linked Auth user for this administrator" },
    };
  }

  if (!deliveryEmail || !deliveryEmail.includes("@")) {
    console.error("[auth-email] Password reset missing delivery email", logBase);
    return {
      linkGenerated: false,
      emailDispatched: false,
      messageId: null,
      error: { message: "Invalid delivery email" },
    };
  }

  const { data: authData, error: authLookupError } =
    await supabase.auth.admin.getUserById(authUserId);

  if (authLookupError || !authData?.user) {
    console.error("[auth-email] Linked Auth user not found", {
      ...logBase,
      message: authLookupError?.message ?? "user missing",
    });
    return {
      linkGenerated: false,
      emailDispatched: false,
      messageId: null,
      error: { message: "Linked Auth user not found" },
    };
  }

  const authIdentityEmail = (authData.user.email || "").trim();
  if (!authIdentityEmail) {
    console.error("[auth-email] Linked Auth user has no email identity", logBase);
    return {
      linkGenerated: false,
      emailDispatched: false,
      messageId: null,
      error: { message: "Linked Auth user has no email identity" },
    };
  }

  console.info("[auth-email] Linked Auth user resolved for password reset", {
    ...logBase,
    linkedAuthUserFound: true,
  });

  const { data: linkData, error: linkError } = await supabase.auth.admin.generateLink({
    type: "recovery",
    email: authIdentityEmail,
    options: { redirectTo },
  });

  if (linkError) {
    console.error("[auth-email] Supabase generateLink (recovery) failed", {
      ...logBase,
      message: linkError.message,
    });
    return {
      linkGenerated: false,
      emailDispatched: false,
      messageId: null,
      error: { message: linkError.message },
    };
  }

  const hashedToken = extractHashedToken(linkData);
  if (!hashedToken) {
    console.error("[auth-email] Supabase generateLink returned no hashed_token", logBase);
    return {
      linkGenerated: false,
      emailDispatched: false,
      messageId: null,
      error: { message: "Recovery token missing from Supabase response" },
    };
  }

  const resetUrl = buildPasswordResetAcceptUrl(hashedToken);

  console.info("[auth-email] generateLink succeeded", {
    ...logBase,
    generateLinkSuccess: true,
    firstPartyResetUrl: true,
  });

  if (authEmailsSuppressed()) {
    console.info("Auth email suppressed in development", {
      ...logBase,
      kind: "password-reset",
    });
    return {
      linkGenerated: true,
      emailDispatched: false,
      messageId: null,
      error: null,
    };
  }

  const configResult = resolveAuthEmailConfig();
  if (!configResult.ok) {
    logAuthEmailConfigError(configResult.missing);
    return {
      linkGenerated: true,
      emailDispatched: false,
      messageId: null,
      error: {
        message: `Missing email configuration: ${configResult.missing.join(", ")}`,
      },
    };
  }

  const emailContent = buildPasswordResetEmail({
    recipient_name: input.recipientName,
    reset_password_url: resetUrl,
  });

  const sendResult = await sendBrandedEmailViaResend({
    to: deliveryEmail,
    subject: emailContent.subject,
    html: emailContent.html,
    text: emailContent.text,
    config: configResult.config,
  });

  if (!sendResult.ok) {
    console.error("[auth-email] Resend send failed after generateLink", {
      ...logBase,
      message: sendResult.errorMessage,
    });
    return {
      linkGenerated: true,
      emailDispatched: false,
      messageId: null,
      error: { message: sendResult.errorMessage },
    };
  }

  console.info("[auth-email] Password reset email dispatched", {
    ...logBase,
    messageId: sendResult.messageId,
  });

  return {
    linkGenerated: true,
    emailDispatched: true,
    messageId: sendResult.messageId,
    error: null,
  };
}

/**
 * Resolves a public contact email to a linked Auth user via accepted invitations.
 * Returns null when no safe linkage exists (caller should still return generic success).
 */
export async function resolveAuthUserForContactEmail(
  supabase: SupabaseClient,
  contactEmail: string
): Promise<{ authUserId: string; deliveryEmail: string; invitationId: string } | null> {
  const email = normalizeEmail(contactEmail);
  if (!email.includes("@")) return null;

  const { data, error } = await supabase
    .from("organization_invitations")
    .select("id, email, auth_user_id, status, accepted_at, created_at")
    .eq("email", email)
    .eq("status", "accepted")
    .not("auth_user_id", "is", null)
    .order("accepted_at", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error("[auth-email] Contact→Auth lookup failed", {
      deliveryDomain: recipientDomainForLog(email),
      message: error.message,
    });
    return null;
  }

  if (!data?.auth_user_id) {
    return null;
  }

  if (normalizeEmail(String(data.email || "")) !== email) {
    return null;
  }

  return {
    authUserId: String(data.auth_user_id),
    deliveryEmail: email,
    invitationId: String(data.id),
  };
}
