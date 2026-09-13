/**
 * Guest shipping-request email shell — re-exports the shared One Eyrie shell
 * with the Lost & Found Shipping Request header subtitle.
 */
import {
  ONE_EYRIE_EMAIL,
  paintEmail,
  renderOneEyrieEmailHtml,
  type OneEyrieEmailShellInput,
} from "@/app/lib/email/one-eyrie-email-shell";

export const GUEST_SHIPPING_EMAIL_COLORS = {
  white: ONE_EYRIE_EMAIL.white,
  card: ONE_EYRIE_EMAIL.card,
  primary: ONE_EYRIE_EMAIL.primary,
  secondary: ONE_EYRIE_EMAIL.secondary,
  border: ONE_EYRIE_EMAIL.border,
  gold: ONE_EYRIE_EMAIL.gold,
  header: ONE_EYRIE_EMAIL.header,
} as const;

export const paint = paintEmail;

export type GuestShippingRequestEmailLayoutInput = {
  heading: string;
  preheader?: string;
  bodyHtml: string;
  cta: { label: string; url: string };
  belowCtaHtml?: string;
  supportBlurb?: string;
};

/**
 * Light table shell used by the automated guest shipping (“Item Found”) email.
 */
export function renderGuestShippingRequestEmailHtml(
  input: GuestShippingRequestEmailLayoutInput
): string {
  const shellInput: OneEyrieEmailShellInput = {
    headerSubtitle: "Lost & Found Shipping Request",
    heading: input.heading,
    preheader: input.preheader,
    bodyHtml: input.bodyHtml,
    cta: input.cta,
    belowCtaHtml: input.belowCtaHtml,
    // Guest emails use a custom support line without the platform mailto.
    supportBlurb:
      input.supportBlurb?.trim() ||
      "Questions? We&rsquo;re here to help with your return shipping.",
    showSupportEmail: false,
  };

  return renderOneEyrieEmailHtml(shellInput);
}
