import type { SupabaseClient } from "@supabase/supabase-js";
import {
  logAuthEmailConfigError,
  recipientDomainForLog,
  resolveAuthEmailConfig,
  resolvePasswordResetRedirectUrl,
} from "@/app/lib/email/auth-email-config";
import { buildPasswordResetEmail } from "@/app/lib/email/password-reset-email";
import { sendBrandedEmailViaResend } from "@/app/lib/email/send-branded-email";
import { authEmailsSuppressed } from "@/app/lib/platform-admin/server/auth-email-suppress";

export type DispatchPasswordResetResult = {
  /** True when a recovery link was generated (user likely exists). */
  linkGenerated: boolean;
  /** True when Resend accepted the message (or suppression skipped send intentionally). */
  emailDispatched: boolean;
  /** Resend message id when sent. */
  messageId: string | null;
  /** Internal error for logging / admin callers — never expose to public clients. */
  error: { message: string } | null;
};

function extractRecoveryActionLink(data: unknown): string | null {
  if (!data || typeof data !== "object") return null;
  const root = data as Record<string, unknown>;
  const properties = root.properties;
  if (properties && typeof properties === "object") {
    const actionLink = (properties as Record<string, unknown>).action_link;
    if (typeof actionLink === "string" && actionLink.trim()) {
      return actionLink.trim();
    }
  }
  const direct = root.action_link;
  if (typeof direct === "string" && direct.trim()) {
    return direct.trim();
  }
  return null;
}

/**
 * Generates a Supabase recovery link and sends the branded One Eyrie reset email
 * via Resend. Never returns the recovery URL to callers.
 */
export async function dispatchPasswordResetEmail(
  supabase: SupabaseClient,
  email: string,
  options?: {
    recipientName?: string | null;
    redirectTo?: string;
  }
): Promise<DispatchPasswordResetResult> {
  const normalizedEmail = email.trim().toLowerCase();
  const domain = recipientDomainForLog(normalizedEmail);
  const redirectTo = options?.redirectTo ?? resolvePasswordResetRedirectUrl();

  if (!normalizedEmail || !normalizedEmail.includes("@")) {
    return {
      linkGenerated: false,
      emailDispatched: false,
      messageId: null,
      error: { message: "Invalid email" },
    };
  }

  const { data, error: linkError } = await supabase.auth.admin.generateLink({
    type: "recovery",
    email: normalizedEmail,
    options: { redirectTo },
  });

  if (linkError) {
    console.error("[auth-email] Supabase generateLink (recovery) failed", {
      domain,
      message: linkError.message,
    });
    return {
      linkGenerated: false,
      emailDispatched: false,
      messageId: null,
      error: { message: linkError.message },
    };
  }

  const actionLink = extractRecoveryActionLink(data);
  if (!actionLink) {
    console.error("[auth-email] Supabase generateLink returned no action_link", {
      domain,
    });
    return {
      linkGenerated: false,
      emailDispatched: false,
      messageId: null,
      error: { message: "Recovery link missing from Supabase response" },
    };
  }

  if (authEmailsSuppressed()) {
    console.info("Auth email suppressed in development", { domain, kind: "password-reset" });
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
    recipient_name: options?.recipientName,
    reset_password_url: actionLink,
  });

  const sendResult = await sendBrandedEmailViaResend({
    to: normalizedEmail,
    subject: emailContent.subject,
    html: emailContent.html,
    text: emailContent.text,
    config: configResult.config,
  });

  if (!sendResult.ok) {
    return {
      linkGenerated: true,
      emailDispatched: false,
      messageId: null,
      error: { message: sendResult.errorMessage },
    };
  }

  return {
    linkGenerated: true,
    emailDispatched: true,
    messageId: sendResult.messageId,
    error: null,
  };
}
