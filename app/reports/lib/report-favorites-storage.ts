const STORAGE_KEY_PREFIX = "one-eyrie-report-favorites:";
export const REPORT_FAVORITES_UPDATED_EVENT = "report-favorites-updated";

function storageKey(authUserId: string | null | undefined): string {
  return `${STORAGE_KEY_PREFIX}${authUserId?.trim() || "anonymous"}`;
}

function readFavoriteIds(authUserId: string | null | undefined): string[] {
  if (typeof window === "undefined") return [];

  try {
    const raw = window.localStorage.getItem(storageKey(authUserId));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as string[];
    return Array.isArray(parsed) ? parsed.filter((id) => typeof id === "string" && id.trim()) : [];
  } catch {
    return [];
  }
}

function writeFavoriteIds(authUserId: string | null | undefined, favoriteIds: string[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(storageKey(authUserId), JSON.stringify(favoriteIds));
  window.dispatchEvent(new CustomEvent(REPORT_FAVORITES_UPDATED_EVENT));
}

export function listFavoriteReportIds(authUserId: string | null | undefined): string[] {
  return readFavoriteIds(authUserId);
}

export function isFavoriteReport(
  reportId: string,
  authUserId: string | null | undefined
): boolean {
  return readFavoriteIds(authUserId).includes(reportId);
}

export function toggleFavoriteReport(
  reportId: string,
  authUserId: string | null | undefined
): string[] {
  const current = readFavoriteIds(authUserId);
  const next = current.includes(reportId)
    ? current.filter((id) => id !== reportId)
    : [...current, reportId];
  writeFavoriteIds(authUserId, next);
  return next;
}

export function setFavoriteReport(
  reportId: string,
  favorited: boolean,
  authUserId: string | null | undefined
): string[] {
  const current = readFavoriteIds(authUserId);
  const next = favorited
    ? current.includes(reportId)
      ? current
      : [...current, reportId]
    : current.filter((id) => id !== reportId);
  writeFavoriteIds(authUserId, next);
  return next;
}
