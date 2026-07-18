import type { SupabaseClient } from "@supabase/supabase-js";
import {
  logAuthEmailConfigError,
  recipientDomainForLog,
  resolveAuthEmailConfig,
  resolveInviteRedirectUrl,
} from "@/app/lib/email/auth-email-config";
import {
  buildInvitationAcceptUrl,
  extractHashedToken,
  extractVerificationType,
  type AuthEmailLinkType,
} from "@/app/lib/email/auth-link";
import { buildInvitationEmail } from "@/app/lib/email/invitation-email";
import { sendBrandedEmailViaResend } from "@/app/lib/email/send-branded-email";
import { authEmailsSuppressed } from "@/app/lib/platform-admin/server/auth-email-suppress";

export type InvitationDispatchResult = {
  userId: string | null;
  linkGenerated: boolean;
  emailDispatched: boolean;
  messageId: string | null;
  error: { message: string } | null;
};

export type InvitationDispatchInput = {
  email: string;
  recipientName?: string | null;
  inviterName?: string | null;
  organizationName?: string | null;
  expirationDate?: string | null;
  invitationId?: string | null;
  redirectTo?: string;
  userMetadata: Record<string, unknown>;
};

function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

function isAlreadyRegisteredMessage(message: string): boolean {
  const lower = message.toLowerCase();
  return (
    lower.includes("already") ||
    lower.includes("registered") ||
    lower.includes("exists")
  );
}

async function generateInviteOrMagicLink(
  supabase: SupabaseClient,
  email: string,
  options: { redirectTo: string; data: Record<string, unknown> }
): Promise<{
  userId: string | null;
  hashedToken: string | null;
  linkType: AuthEmailLinkType;
  error: { message: string } | null;
}> {
  const inviteAttempt = await supabase.auth.admin.generateLink({
    type: "invite",
    email,
    options: {
      redirectTo: options.redirectTo,
      data: options.data,
    },
  });

  if (!inviteAttempt.error) {
    const hashedToken = extractHashedToken(inviteAttempt.data);
    const verificationType = extractVerificationType(inviteAttempt.data);
    const linkType: AuthEmailLinkType =
      verificationType === "magiclink" ? "magiclink" : "invite";
    if (!hashedToken) {
      return {
        userId: inviteAttempt.data?.user?.id ?? null,
        hashedToken: null,
        linkType,
        error: { message: "Invite link missing hashed_token" },
      };
    }
    return {
      userId: inviteAttempt.data?.user?.id ?? null,
      hashedToken,
      linkType,
      error: null,
    };
  }

  // Existing Auth users cannot always receive a fresh invite link; use magiclink.
  if (!isAlreadyRegisteredMessage(inviteAttempt.error.message)) {
    return {
      userId: null,
      hashedToken: null,
      linkType: "invite",
      error: { message: inviteAttempt.error.message },
    };
  }

  const magicAttempt = await supabase.auth.admin.generateLink({
    type: "magiclink",
    email,
    options: {
      redirectTo: options.redirectTo,
      data: options.data,
    },
  });

  if (magicAttempt.error) {
    return {
      userId: null,
      hashedToken: null,
      linkType: "magiclink",
      error: { message: magicAttempt.error.message },
    };
  }

  const hashedToken = extractHashedToken(magicAttempt.data);
  if (!hashedToken) {
    return {
      userId: magicAttempt.data?.user?.id ?? null,
      hashedToken: null,
      linkType: "magiclink",
      error: { message: "Magic link missing hashed_token" },
    };
  }

  return {
    userId: magicAttempt.data?.user?.id ?? null,
    hashedToken,
    linkType: "magiclink",
    error: null,
  };
}

/**
 * Provisions an invite/magic Auth link (no Supabase mailer) and sends the
 * branded One Eyrie invitation via Resend.
 */
export async function dispatchInvitationEmail(
  supabase: SupabaseClient,
  input: InvitationDispatchInput
): Promise<InvitationDispatchResult> {
  const email = normalizeEmail(input.email);
  const deliveryDomain = recipientDomainForLog(email);
  const invitationId = input.invitationId ? String(input.invitationId) : null;
  const redirectTo = input.redirectTo ?? resolveInviteRedirectUrl();
  const logBase = {
    invitationId,
    deliveryDomain,
  };

  if (!email.includes("@")) {
    return {
      userId: null,
      linkGenerated: false,
      emailDispatched: false,
      messageId: null,
      error: { message: "Invalid invitation email" },
    };
  }

  const provisioned = await generateInviteOrMagicLink(supabase, email, {
    redirectTo,
    data: input.userMetadata,
  });

  if (provisioned.error || !provisioned.hashedToken) {
    console.error("[auth-email] Invitation link generation failed", {
      ...logBase,
      message: provisioned.error?.message ?? "missing hashed_token",
    });
    return {
      userId: provisioned.userId,
      linkGenerated: false,
      emailDispatched: false,
      messageId: null,
      error: {
        message: provisioned.error?.message ?? "Invitation link generation failed",
      },
    };
  }

  console.info("[auth-email] Invitation link generated", {
    ...logBase,
    linkGenerated: true,
    linkType: provisioned.linkType,
    authUserIdPresent: Boolean(provisioned.userId),
  });

  if (authEmailsSuppressed()) {
    console.info("Auth email suppressed in development", {
      ...logBase,
      kind: "invitation",
    });
    return {
      userId: provisioned.userId,
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
      userId: provisioned.userId,
      linkGenerated: true,
      emailDispatched: false,
      messageId: null,
      error: {
        message: `Missing email configuration: ${configResult.missing.join(", ")}`,
      },
    };
  }

  const acceptUrl = buildInvitationAcceptUrl(
    provisioned.hashedToken,
    provisioned.linkType
  );

  const emailContent = buildInvitationEmail({
    recipient_name: input.recipientName,
    inviter_name: input.inviterName?.trim() || "A One Eyrie administrator",
    organization_name: input.organizationName,
    accept_invitation_url: acceptUrl,
    expiration_date: input.expirationDate,
  });

  const sendResult = await sendBrandedEmailViaResend({
    to: email,
    subject: emailContent.subject,
    html: emailContent.html,
    text: emailContent.text,
    config: configResult.config,
  });

  if (!sendResult.ok) {
    console.error("[auth-email] Invitation Resend send failed", {
      ...logBase,
      message: sendResult.errorMessage,
    });
    return {
      userId: provisioned.userId,
      linkGenerated: true,
      emailDispatched: false,
      messageId: null,
      error: { message: sendResult.errorMessage },
    };
  }

  console.info("[auth-email] Invitation email dispatched", {
    ...logBase,
    messageId: sendResult.messageId,
  });

  return {
    userId: provisioned.userId,
    linkGenerated: true,
    emailDispatched: true,
    messageId: sendResult.messageId,
    error: null,
  };
}
