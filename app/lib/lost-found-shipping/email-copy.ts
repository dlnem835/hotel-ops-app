export const AUTOMATED_SHIPPING_EMAIL_HEADING =
  "Your Lost Item Has Been Found";

/**
 * Automated guest shipping email copy (Shippo/Stripe flow).
 * Single CTA only — never carrier-specific buttons.
 */
export const AUTOMATED_SHIPPING_EMAIL_CTA = "Choose Shipping and Pay";

export const AUTOMATED_SHIPPING_EMAIL_NOTES = {
  singleCtaOnly: true,
  avoidCarrierButtons: true,
  guestChoosesCarrierOnPage: true,
} as const;
