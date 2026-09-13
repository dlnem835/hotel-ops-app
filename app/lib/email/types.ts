/**
 * Transactional email kinds that share the One Eyrie layout foundation.
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
  /**
   * Small uppercase header subtitle (e.g. ACCOUNT INVITATION, LOST & FOUND).
   * Defaults from `kind` when omitted.
   */
  headerSubtitle?: string;
  /** Primary heading inside the card */
  heading: string;
  /** Escaped/safe HTML for the main body (paragraphs, lists, etc.) */
  bodyHtml: string;
  cta?: TransactionalEmailCta;
  /** Escaped/safe HTML rendered under the CTA (expiry, ignore notice, etc.) */
  belowCtaHtml?: string;
  /** Show the support block (default true) */
  showSupport?: boolean;
  /**
   * Append platform support mailto under the support blurb (default true).
   * Set false for guest-facing hotel-contact blurbs.
   */
  showSupportEmail?: boolean;
  /**
   * Support blurb in the footer.
   * Defaults to a generic One Eyrie help line + support email.
   */
  supportMessage?: string;
  /** Subtle reference / debug line (already escaped HTML) */
  referenceHtml?: string;
  /** Override © year (defaults to current UTC year) */
  currentYear?: number;
  /**
   * @deprecated Logo header removed — text wordmark is always used.
   * Kept so existing callers compile; ignored at render time.
   */
  headerVariant?: "logo" | "text";
};
