import { escapeHtml } from "@/app/lib/email/escape-html";
import { EMAIL_SUPPORT_ADDRESS, EMAIL_THEME as T } from "@/app/lib/email/brand";
import { renderTransactionalEmailHtml } from "@/app/lib/email/transactional-layout";

export const INVITATION_EMAIL_SUBJECT = "You're invited to join One Eyrie";

/**
 * Template variables for invitation emails.
 * Placeholders use {{name}} form for docs / external ESP pastes.
 */
export type InvitationEmailVariables = {
  recipient_name?: string | null;
  inviter_name: string;
  organization_name?: string | null;
  accept_invitation_url: string;
  /** Human-readable expiry, e.g. "April 24, 2026". Falls back to "7 days". */
  expiration_date?: string | null;
  current_year?: number;
  /**
   * When true, include a short note that desktop is better for administrative
   * setup (org-wide administrator invitations only).
   */
  recommendDesktop?: boolean;
};

export type InvitationEmailContent = {
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
  return {
    html: "Hello,",
    text: "Hello,",
  };
}

function expirationLabel(expirationDate?: string | null): string {
  const value = expirationDate?.trim();
  if (value) return value;
  return "7 days";
}

function accessLine(organizationName?: string | null): { html: string; text: string } {
  const name = organizationName?.trim();
  if (name) {
    return {
      html: `You&rsquo;ll be able to access <strong style="color:${T.text};">${escapeHtml(name)}</strong> and the properties assigned to you after creating your account.`,
      text: `You'll be able to access ${name} and the properties assigned to you after creating your account.`,
    };
  }
  return {
    html: "You&rsquo;ll be able to access the organization and properties assigned to you after creating your account.",
    text: "You'll be able to access the organization and properties assigned to you after creating your account.",
  };
}

/**
 * Builds the branded invitation email (HTML + plain text + subject).
 * Safe for Resend / SMTP; layout is shared with future transactional emails.
 */
export function buildInvitationEmail(
  variables: InvitationEmailVariables
): InvitationEmailContent {
  const inviterName = variables.inviter_name.trim() || "A One Eyrie administrator";
  const acceptUrl = variables.accept_invitation_url.trim();
  const year = variables.current_year ?? new Date().getUTCFullYear();
  const greeting = greetingLine(variables.recipient_name);
  const access = accessLine(variables.organization_name);
  const expires = expirationLabel(variables.expiration_date);
  const expiresIsDate = Boolean(variables.expiration_date?.trim());

  const bodyHtml = `
    <p style="margin:0 0 16px;">${greeting.html}</p>
    <p style="margin:0 0 16px;">
      <strong style="color:${T.text};">${escapeHtml(inviterName)}</strong>
      has invited you to join
      <strong style="color:${T.text};">One Eyrie</strong>,
      the hotel operations platform designed to simplify hotel operations across one or multiple properties.
    </p>
    <p style="margin:0${variables.recommendDesktop ? " 0 16px" : ""};">
      ${access.html}
    </p>
    ${
      variables.recommendDesktop
        ? `<p style="margin:0;font-size:14px;line-height:1.55;color:${T.textSubtle};">
      For the full administrative experience, open this invitation on a computer. Mobile access is optimized for field operations.
    </p>`
        : ""
    }`;

  const belowCtaHtml = `
    <p style="margin:0 0 10px;font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:1.6;color:${T.textSubtle};">
      This invitation expires ${expiresIsDate ? `on ${escapeHtml(expires)}` : `in ${escapeHtml(expires)}`}.
    </p>
    <p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:1.6;color:${T.textSubtle};">
      If you weren&rsquo;t expecting this invitation, you can safely ignore this email.
    </p>`;

  const html = renderTransactionalEmailHtml({
    kind: "invitation",
    preheader: `${inviterName} invited you to join One Eyrie.`,
    heading: "You're invited to One Eyrie",
    bodyHtml,
    cta: {
      label: "Accept Invitation",
      url: acceptUrl,
    },
    belowCtaHtml,
    showSupport: true,
    supportMessage:
      "If you have questions about your invitation, account setup, or onboarding, our team is happy to help.",
    currentYear: year,
  });

  const text = [
    "You're invited to One Eyrie",
    "",
    greeting.text,
    "",
    `${inviterName} has invited you to join One Eyrie, the hotel operations platform designed to simplify hotel operations across one or multiple properties.`,
    "",
    access.text,
    ...(variables.recommendDesktop
      ? [
          "",
          "For the full administrative experience, open this invitation on a computer. Mobile access is optimized for field operations.",
        ]
      : []),
    "",
    `Accept Invitation: ${acceptUrl}`,
    "",
    expiresIsDate
      ? `This invitation expires on ${expires}.`
      : `This invitation expires in ${expires}.`,
    "If you weren't expecting this invitation, you can safely ignore this email.",
    "",
    "Need Help?",
    "If you have questions about your invitation, account setup, or onboarding, our team is happy to help.",
    EMAIL_SUPPORT_ADDRESS,
    "",
    `© ${year} One Eyrie`,
    "Hotel Operations Platform",
  ].join("\n");

  return {
    subject: INVITATION_EMAIL_SUBJECT,
    html,
    text,
  };
}

/**
 * Mustache-style HTML template for ESP / dashboard paste workflows.
 * Variables: {{recipient_name}}, {{inviter_name}}, {{organization_name}},
 * {{accept_invitation_url}}, {{expiration_date}}, {{current_year}}
 *
 * Note: recipient greeting fallback ("Hello,") requires runtime logic —
 * prefer `buildInvitationEmail` when sending from the app.
 */
export function getInvitationEmailMustacheTemplate(): string {
  return buildInvitationEmail({
    recipient_name: "{{recipient_name}}",
    inviter_name: "{{inviter_name}}",
    organization_name: "{{organization_name}}",
    accept_invitation_url: "{{accept_invitation_url}}",
    expiration_date: "{{expiration_date}}",
    current_year: 0,
  }).html.replace("© 0 One Eyrie", "© {{current_year}} One Eyrie");
}
