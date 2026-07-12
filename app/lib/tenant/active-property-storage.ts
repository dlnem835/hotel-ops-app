export const ONE_EYRIE_ACTIVE_PROPERTY_ID_KEY = "one-eyrie-active-property-id";

export function readStoredActivePropertyId(): number | null {
  if (typeof window === "undefined") return null;

  try {
    const raw = localStorage.getItem(ONE_EYRIE_ACTIVE_PROPERTY_ID_KEY);
    if (!raw) return null;
    const parsed = Number.parseInt(raw, 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
  } catch {
    return null;
  }
}

export function persistActivePropertyId(propertyId: number): void {
  if (typeof window === "undefined") return;

  try {
    localStorage.setItem(ONE_EYRIE_ACTIVE_PROPERTY_ID_KEY, String(propertyId));
  } catch {
    /* ignore quota / private mode */
  }
}

export function clearStoredActivePropertyId(): void {
  if (typeof window === "undefined") return;

  try {
    localStorage.removeItem(ONE_EYRIE_ACTIVE_PROPERTY_ID_KEY);
  } catch {
    /* ignore */
  }
}
