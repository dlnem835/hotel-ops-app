/**
 * One Eyrie favicon / PWA icon paths.
 *
 * Bump ICON_VERSION after regenerating icons so iOS and browsers fetch fresh assets.
 * Regenerate with: npm run icons:generate
 */
export const ICON_VERSION = 2;

function versioned(path: string) {
  return `${path}?v=${ICON_VERSION}`;
}

export const ONE_EYRIE_BRAND = {
  alt: "One Eyrie",
  icons: {
    favicon: versioned("/favicon.ico"),
    icon192: versioned("/icon-192.png"),
    icon512: versioned("/icon-512.png"),
    appleTouch: versioned("/apple-touch-icon.png"),
  },
} as const;
