/**
 * One Eyrie branding paths (temporary placeholder).
 *
 * To swap the logo/icon later: replace `public/one-eyrie-placeholder-icon.png`,
 * then run `npm run icons:generate` and bump ICON_VERSION below.
 */
export const ICON_VERSION = 3;

/** Single source file for in-app placeholder logos and icon generation. */
export const ONE_EYRIE_PLACEHOLDER_ICON_PATH = "/one-eyrie-placeholder-icon.png";

function versioned(path: string) {
  return `${path}?v=${ICON_VERSION}`;
}

export const ONE_EYRIE_BRAND = {
  alt: "One Eyrie",
  placeholderIcon: ONE_EYRIE_PLACEHOLDER_ICON_PATH,
  icons: {
    favicon: versioned("/favicon.ico"),
    icon192: versioned("/icon-192.png"),
    icon512: versioned("/icon-512.png"),
    appleTouch: versioned("/apple-touch-icon.png"),
  },
} as const;
