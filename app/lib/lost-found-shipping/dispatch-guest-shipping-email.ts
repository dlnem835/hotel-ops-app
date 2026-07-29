import "server-only";

import {
  logAuthEmailConfigError,
  recipientDomainForLog,
  resolveAuthEmailConfig,
} from "@/app/lib/email/auth-email-config";
import { sendBrandedEmailViaResend } from "@/app/lib/email/send-branded-email";
import {
  buildAutomatedShippingEmail,
  type AutomatedShippingEmailInput,
} from "@/app/lib/lost-found-shipping/automated-shipping-email";

export class GuestShippingEmailConfigError extends Error {
  missing: string[];

  constructor(missing: string[]) {
    super(
      `Automated shipping email is not configured. Missing: ${missing.join(", ")}`
    );
    this.name = "GuestShippingEmailConfigError";
    this.missing = missing;
  }
}

export class GuestShippingEmailSendError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GuestShippingEmailSendError";
  }
}

/**
 * Send the automated guest shipping email via Resend.
 * Throws if env/config is incomplete or Resend rejects the message.
 */
export async function dispatchGuestShippingEmail(
  input: AutomatedShippingEmailInput & { to: string }
): Promise<{ messageId: string | null; from: string }> {
  const configResult = resolveAuthEmailConfig();
  if (!configResult.ok) {
    logAuthEmailConfigError(configResult.missing);
    throw new GuestShippingEmailConfigError(configResult.missing);
  }

  const content = buildAutomatedShippingEmail(input);
  const domain = recipientDomainForLog(input.to);

  console.info("[guest-shipping-email] Sending via Resend", {
    domain,
    propertyName: input.propertyName,
    from: configResult.config.from,
  });

  const result = await sendBrandedEmailViaResend({
    to: input.to,
    subject: content.subject,
    html: content.html,
    text: content.text,
    config: configResult.config,
  });

  if (!result.ok) {
    console.error("[guest-shipping-email] Resend rejected message", {
      domain,
      error: result.errorMessage,
      code: result.errorCode,
    });
    throw new GuestShippingEmailSendError(
      result.errorMessage || "Resend did not accept the shipping email."
    );
  }

  console.info("[guest-shipping-email] Resend accepted message", {
    domain,
    messageId: result.messageId,
    from: configResult.config.from,
  });

  return {
    messageId: result.messageId,
    from: configResult.config.from,
  };
}
