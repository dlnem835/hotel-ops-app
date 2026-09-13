import { escapeHtml } from "@/app/lib/email/escape-html";
import { EMAIL_SUPPORT_ADDRESS } from "@/app/lib/email/brand";
import {
  ONE_EYRIE_EMAIL as C,
  renderEmailDetailCard,
  renderEmailParagraph,
} from "@/app/lib/email/one-eyrie-email-shell";
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
   * @deprecated No longer rendered in the email body.
   * Kept so existing callers (org-admin invites) continue to compile.
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

/**
 * Builds the branded invitation email (HTML + plain text + subject).
 * Uses the shared One Eyrie transactional shell (Item Found visual identity).
 */
export function buildInvitationEmail(
  variables: InvitationEmailVariables
): InvitationEmailContent {
  const inviterName = variables.inviter_name.trim() || "A One Eyrie administrator";
  const acceptUrl = variables.accept_invitation_url.trim();
  const year = variables.current_year ?? new Date().getUTCFullYear();
  const greeting = greetingLine(variables.recipient_name);
  const orgName = variables.organization_name?.trim() || null;
  const expires = expirationLabel(variables.expiration_date);
  const expiresIsDate = Boolean(variables.expiration_date?.trim());

  const orgCard = orgName
    ? renderEmailDetailCard(
        "Organization",
        `<span style="color:${C.primary};">${escapeHtml(orgName)}</span>`
      )
    : "";

  const accessHtml = orgName
    ? `You&rsquo;ll receive access to <strong style="color:${C.primary};">${escapeHtml(orgName)}</strong> and the properties and features assigned to you after creating your account.`
    : `You&rsquo;ll receive access to your assigned properties and features after creating your account.`;

  const accessText = orgName
    ? `You'll receive access to ${orgName} and the properties and features assigned to you after creating your account.`
    : "You'll receive access to your assigned properties and features after creating your account.";

  const bodyHtml = `
    ${renderEmailParagraph(greeting.html, 12)}
    ${renderEmailParagraph(
      `<strong style="color:${C.primary};">${escapeHtml(inviterName)}</strong> has invited you to join <strong style="color:${C.primary};">One Eyrie</strong>.`,
      18
    )}
    ${orgCard}
    ${renderEmailParagraph(accessHtml, 12)}
    ${renderEmailParagraph(
      "After you accept, you&rsquo;ll choose a username and password to finish setting up your account.",
      22
    )}
  `;

  const belowCtaHtml = `
    <span style="font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:1.55;color:${C.secondary};">
      This invitation expires ${expiresIsDate ? `on ${escapeHtml(expires)}` : `in ${escapeHtml(expires)}`}.
      <br/>If you weren&rsquo;t expecting this invitation, you can safely ignore this email.
    </span>`;

  const html = renderTransactionalEmailHtml({
    kind: "invitation",
    headerSubtitle: "ACCOUNT INVITATION",
    preheader: `${inviterName} invited you to join One Eyrie.`,
    heading: "You're Invited to One Eyrie",
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
    "You're Invited to One Eyrie",
    "",
    greeting.text,
    "",
    `${inviterName} has invited you to join One Eyrie.`,
    orgName ? `Organization: ${orgName}` : null,
    "",
    accessText,
    "",
    "After you accept, you'll choose a username and password to finish setting up your account.",
    "",
    `Accept Invitation: ${acceptUrl}`,
    "",
    expiresIsDate
      ? `This invitation expires on ${expires}.`
      : `This invitation expires in ${expires}.`,
    "If you weren't expecting this invitation, you can safely ignore this email.",
    "",
    "If you have questions about your invitation, account setup, or onboarding, our team is happy to help.",
    EMAIL_SUPPORT_ADDRESS,
    "",
    `© ${year} One Eyrie`,
    "Hotel Operations Platform",
  ]
    .filter((line): line is string => line != null)
    .join("\n");

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
