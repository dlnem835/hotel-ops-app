/**
 * Future automated shipping request email copy (not sent yet).
 * When guest emails are implemented, use a single CTA — never carrier-specific buttons.
 */
export const AUTOMATED_SHIPPING_EMAIL_CTA = "Choose Shipping and Pay";

export const AUTOMATED_SHIPPING_EMAIL_NOTES = {
  singleCtaOnly: true,
  avoidCarrierButtons: true,
  guestChoosesCarrierOnPage: true,
} as const;
