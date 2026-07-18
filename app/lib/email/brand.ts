import { ONE_EYRIE } from "@/app/lib/oneEyrieColors";
import { ONE_EYRIE_LOGO_STACKED_PATH } from "@/app/lib/one-eyrie-brand";
import { resolveAppUrl } from "@/app/lib/email/auth-email-config";

/** Public stacked logo used in transactional emails. */
export const EMAIL_LOGO_PATH = ONE_EYRIE_LOGO_STACKED_PATH;

export const EMAIL_SUPPORT_ADDRESS =
  (process.env.SUPPORT_EMAIL ?? "").trim() || "support@oneeyrie.com";

export const EMAIL_FROM_DEFAULT =
  (process.env.AUTH_EMAIL_FROM ?? "").trim() ||
  "One Eyrie <noreply@oneeyrie.com>";

/** Absolute site origin for email asset links (logo, CTAs). */
export function getEmailSiteOrigin(): string {
  return resolveAppUrl();
}

export function getEmailLogoUrl(): string {
  return `${getEmailSiteOrigin()}${EMAIL_LOGO_PATH}`;
}

/** Shared palette for transactional emails (mirrors ONE_EYRIE tokens). */
export const EMAIL_THEME = {
  gold: ONE_EYRIE.gold,
  goldLight: ONE_EYRIE.goldLight,
  black: ONE_EYRIE.black,
  charcoal: ONE_EYRIE.surfacePanel,
  card: ONE_EYRIE.surface,
  border: ONE_EYRIE.border,
  divider: ONE_EYRIE.borderDivider,
  text: ONE_EYRIE.text,
  textMuted: ONE_EYRIE.textMuted,
  textSubtle: ONE_EYRIE.textSubtle,
  buttonText: ONE_EYRIE.black,
} as const;
