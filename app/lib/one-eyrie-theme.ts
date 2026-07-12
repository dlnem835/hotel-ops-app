export type OneEyrieTheme = "dark" | "light";

export const ONE_EYRIE_THEME_STORAGE_KEY = "one-eyrie-theme";
export const ONE_EYRIE_DEFAULT_THEME: OneEyrieTheme = "dark";

/**
 * Light Mode is in active development and gated to administrators only.
 * Production users always receive Dark Mode until Light Mode is officially released.
 * Set to false when Light Mode launches for all users.
 */
export const LIGHT_MODE_REQUIRES_ADMIN = true;

export function canUseLightMode(isAdministrator: boolean): boolean {
  if (!LIGHT_MODE_REQUIRES_ADMIN) return true;
  return isAdministrator;
}

export function resolveEffectiveTheme(
  stored: OneEyrieTheme,
  isAdministrator: boolean
): OneEyrieTheme {
  if (stored === "light" && !canUseLightMode(isAdministrator)) {
    return ONE_EYRIE_DEFAULT_THEME;
  }
  return stored;
}

export function isOneEyrieTheme(value: string | null | undefined): value is OneEyrieTheme {
  return value === "dark" || value === "light";
}

export function readStoredTheme(): OneEyrieTheme {
  if (typeof window === "undefined") return ONE_EYRIE_DEFAULT_THEME;

  try {
    const stored = window.localStorage.getItem(ONE_EYRIE_THEME_STORAGE_KEY);
    return isOneEyrieTheme(stored) ? stored : ONE_EYRIE_DEFAULT_THEME;
  } catch {
    return ONE_EYRIE_DEFAULT_THEME;
  }
}

export function persistTheme(theme: OneEyrieTheme): void {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.setItem(ONE_EYRIE_THEME_STORAGE_KEY, theme);
  } catch {
    // Ignore storage failures — session theme still applies.
  }
}

export function applyThemeToDocument(theme: OneEyrieTheme): void {
  if (typeof document === "undefined") return;

  document.documentElement.setAttribute("data-theme", theme);
  document.documentElement.style.colorScheme = theme;

  const themeColor = theme === "light" ? "#F7F5F1" : "#111111";
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) {
    meta.setAttribute("content", themeColor);
  }
}
