/**
 * Mobile vs desktop shell selection.
 *
 * Architecture: separate route trees (`/`… desktop vs `/mobile/…` mobile),
 * shared session/permissions/data. Selection is viewport-based (not UA).
 *
 * Breakpoints (aligned with inspections layout):
 * - Phone:     max-width 767px  → mobile shell
 * - Tablet:    768px–1023px     → desktop shell (intentional: tablets get the
 *                                 fuller desktop layout; CSS within desktop
 *                                 pages remains responsive)
 * - Desktop:   min-width 1024px → desktop shell
 *
 * Preference override (localStorage, per browser — not locked at setup):
 * - automatic (default): use breakpoints above
 * - mobile / desktop: force that shell until the user changes it
 */

export type InterfacePreference = "automatic" | "mobile" | "desktop";
export type AppShell = "mobile" | "desktop";

export const INTERFACE_PREFERENCE_STORAGE_KEY = "one-eyrie-interface-preference";

/** Phone-sized viewports use the mobile shell under Automatic. */
export const PHONE_MAX_WIDTH_PX = 767;

const PHONE_QUERY = `(max-width: ${PHONE_MAX_WIDTH_PX}px)`;

export function isInterfacePreference(
  value: string | null | undefined
): value is InterfacePreference {
  return value === "automatic" || value === "mobile" || value === "desktop";
}

export function readInterfacePreference(): InterfacePreference {
  if (typeof window === "undefined") return "automatic";
  try {
    const stored = window.localStorage.getItem(INTERFACE_PREFERENCE_STORAGE_KEY);
    return isInterfacePreference(stored) ? stored : "automatic";
  } catch {
    return "automatic";
  }
}

export function persistInterfacePreference(preference: InterfacePreference): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(INTERFACE_PREFERENCE_STORAGE_KEY, preference);
  } catch {
    // Ignore storage failures — session still uses in-memory choice.
  }
}

export function isPhoneViewport(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia(PHONE_QUERY).matches;
}

/** Resolves which app shell to use for the current preference + viewport. */
export function resolvePreferredShell(
  preference: InterfacePreference = readInterfacePreference()
): AppShell {
  if (preference === "mobile") return "mobile";
  if (preference === "desktop") return "desktop";
  return isPhoneViewport() ? "mobile" : "desktop";
}

export function subscribePhoneViewport(onChange: () => void): () => void {
  if (typeof window === "undefined") return () => {};

  const media = window.matchMedia(PHONE_QUERY);
  const listener = () => onChange();
  media.addEventListener("change", listener);
  return () => media.removeEventListener("change", listener);
}
