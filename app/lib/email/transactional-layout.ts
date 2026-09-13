/**
 * Transactional email layout — thin adapter over the shared One Eyrie shell.
 * Prefer `renderOneEyrieEmailHtml` for new templates.
 */
import {
  ONE_EYRIE_EMAIL,
  renderOneEyrieEmailHtml,
} from "@/app/lib/email/one-eyrie-email-shell";
import type { TransactionalEmailLayoutInput } from "@/app/lib/email/types";

function defaultHeaderSubtitle(
  kind: TransactionalEmailLayoutInput["kind"],
  override?: string | null
): string {
  const custom = override?.trim();
  if (custom) return custom;

  switch (kind) {
    case "invitation":
    case "organization-invitation":
      return "ACCOUNT INVITATION";
    case "password-reset":
    case "password-changed":
    case "email-verification":
    case "welcome":
      return "ACCOUNT";
    case "guest-shipping":
      return "LOST & FOUND";
    case "property-assignment":
      return "PROPERTY ACCESS";
    default:
      return "ONE EYRIE";
  }
}

/**
 * Renders a transactional email using the shared One Eyrie visual shell
 * (black header, text wordmark, white body — same as Item Found).
 * Logo image is not used.
 */
export function renderTransactionalEmailHtml(
  input: TransactionalEmailLayoutInput
): string {
  const showSupport = input.showSupport !== false;

  return renderOneEyrieEmailHtml({
    headerSubtitle: defaultHeaderSubtitle(input.kind, input.headerSubtitle),
    heading: input.heading,
    preheader: input.preheader,
    bodyHtml: input.bodyHtml,
    cta: input.cta,
    belowCtaHtml: input.belowCtaHtml,
    supportBlurb: showSupport
      ? input.supportMessage?.trim() || null
      : "",
    showSupportEmail: showSupport
      ? input.showSupportEmail !== false
      : false,
    referenceHtml: input.referenceHtml,
    currentYear: input.currentYear,
  });
}

/** @deprecated Use ONE_EYRIE_EMAIL from one-eyrie-email-shell. */
export const TRANSACTIONAL_EMAIL_SURFACE = {
  black: ONE_EYRIE_EMAIL.header,
  surface: ONE_EYRIE_EMAIL.white,
  text: ONE_EYRIE_EMAIL.primary,
  muted: ONE_EYRIE_EMAIL.secondary,
} as const;
