import { Resend } from "resend";
import type { AuthEmailConfig } from "@/app/lib/email/auth-email-config";
import { recipientDomainForLog } from "@/app/lib/email/auth-email-config";

export type SendBrandedEmailInput = {
  to: string;
  subject: string;
  html: string;
  text: string;
  config: AuthEmailConfig;
};

export type SendBrandedEmailResult =
  | { ok: true; messageId: string | null }
  | { ok: false; errorMessage: string; errorCode?: string };

/**
 * Sends a branded transactional email via Resend.
 * Never logs the HTML body (may contain recovery links).
 */
export async function sendBrandedEmailViaResend(
  input: SendBrandedEmailInput
): Promise<SendBrandedEmailResult> {
  const resend = new Resend(input.config.resendApiKey);
  const domain = recipientDomainForLog(input.to);

  try {
    const result = await resend.emails.send({
      from: input.config.from,
      to: input.to,
      replyTo: input.config.replyTo,
      subject: input.subject,
      html: input.html,
      text: input.text,
    });

    if (result.error) {
      console.error("[auth-email] Resend send failed", {
        domain,
        code: result.error.name ?? "unknown",
        message: result.error.message,
      });
      return {
        ok: false,
        errorMessage: result.error.message,
        errorCode: result.error.name,
      };
    }

    const messageId = result.data?.id ?? null;
    console.info("[auth-email] Resend accepted message", {
      domain,
      messageId,
    });
    return { ok: true, messageId };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown Resend error";
    console.error("[auth-email] Resend threw", { domain, message });
    return { ok: false, errorMessage: message };
  }
}
