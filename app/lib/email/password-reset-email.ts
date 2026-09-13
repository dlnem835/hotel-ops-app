import { escapeHtml } from "@/app/lib/email/escape-html";
import { EMAIL_SUPPORT_ADDRESS } from "@/app/lib/email/brand";
import {
  ONE_EYRIE_EMAIL as C,
  renderEmailParagraph,
} from "@/app/lib/email/one-eyrie-email-shell";
import { renderTransactionalEmailHtml } from "@/app/lib/email/transactional-layout";

export const PASSWORD_RESET_EMAIL_SUBJECT = "Reset your One Eyrie password";

export type PasswordResetEmailVariables = {
  recipient_name?: string | null;
  reset_password_url: string;
  /** Human-readable expiry, e.g. "1 hour". Defaults to "1 hour". */
  expiration_label?: string | null;
  current_year?: number;
};

export type PasswordResetEmailContent = {
  subject: string;
  html: string;
  text: string;
};

function greetingLine(recipientName?: string | null): { html: string; text: string } {
  const name = recipientName?.trim();
  if (name) {
    return {
      html: `Hello ${escapeHtml(name)},`,
      text: `Hello ${name},`,
    };
  }
  return { html: "Hello,", text: "Hello," };
}

/**
 * Branded password-reset email using the shared One Eyrie transactional shell.
 */
export function buildPasswordResetEmail(
  variables: PasswordResetEmailVariables
): PasswordResetEmailContent {
  const resetUrl = variables.reset_password_url.trim();
  const year = variables.current_year ?? new Date().getUTCFullYear();
  const greeting = greetingLine(variables.recipient_name);
  const expires = variables.expiration_label?.trim() || "1 hour";

  const bodyHtml = `
    ${renderEmailParagraph(greeting.html, 12)}
    ${renderEmailParagraph(
      `We received a request to reset the password for your <strong style="color:${C.primary};">One Eyrie</strong> account.`,
      16
    )}
    ${renderEmailParagraph(
      `Click the button below to choose a new password. This link expires in <strong style="color:${C.primary};">${escapeHtml(expires)}</strong> and can only be used once.`,
      22
    )}
  `;

  const belowCtaHtml = `
    <span style="font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:1.55;color:${C.secondary};">
      For your security, never share this email or reset link with anyone.
      <br/>If you did not request a password reset, you can safely ignore this email. Your password will remain unchanged.
    </span>`;

  const html = renderTransactionalEmailHtml({
    kind: "password-reset",
    headerSubtitle: "ACCOUNT",
    preheader: "Reset your One Eyrie password.",
    heading: "Reset Your Password",
    bodyHtml,
    cta: {
      label: "Reset Password",
      url: resetUrl,
    },
    belowCtaHtml,
    showSupport: true,
    supportMessage:
      "If you have questions about your account or this password reset, our team is happy to help.",
    currentYear: year,
  });

  const text = [
    "Reset Your Password",
    "",
    greeting.text,
    "",
    "We received a request to reset the password for your One Eyrie account.",
    "",
    `Reset Password: ${resetUrl}`,
    "",
    `This link expires in ${expires} and can only be used once.`,
    "For your security, never share this email or reset link with anyone.",
    "If you did not request a password reset, you can safely ignore this email. Your password will remain unchanged.",
    "",
    "If you have questions about your account or this password reset, our team is happy to help.",
    EMAIL_SUPPORT_ADDRESS,
    "",
    `© ${year} One Eyrie`,
    "Hotel Operations Platform",
  ].join("\n");

  return {
    subject: PASSWORD_RESET_EMAIL_SUBJECT,
    html,
    text,
  };
}
