/**
 * Transactional email kinds that share the One Eyrie layout foundation.
 * Invitation is implemented; remaining kinds reuse the same shell.
 */
export type TransactionalEmailKind =
  | "invitation"
  | "password-reset"
  | "welcome"
  | "email-verification"
  | "organization-invitation"
  | "property-assignment"
  | "password-changed"
  | "guest-shipping";

export type TransactionalEmailCta = {
  label: string;
  url: string;
};

export type TransactionalEmailLayoutInput = {
  kind: TransactionalEmailKind;
  /** Inbox preview / preheader text */
  preheader?: string;
  /** Primary heading inside the card */
  heading: string;
  /** Escaped/safe HTML for the main body (paragraphs, lists, etc.) */
  bodyHtml: string;
  cta?: TransactionalEmailCta;
  /** Escaped/safe HTML rendered under the CTA (expiry, ignore notice, etc.) */
  belowCtaHtml?: string;
  /** Show the Need Help? support block (default true) */
  showSupport?: boolean;
  /**
   * Support blurb under “Need Help?”.
   * Defaults to a generic onboarding help line.
   */
  supportMessage?: string;
  /** Override © year (defaults to current UTC year) */
  currentYear?: number;
  /**
   * Header brand treatment.
   * - logo (default): stacked image logo
   * - text: ONE / EYRIE wordmark (guest payment confirmation)
   */
  headerVariant?: "logo" | "text";
};
