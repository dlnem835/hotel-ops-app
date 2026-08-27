import {
  getLatestReplyAt,
  getPassOnEffectiveViewedAt,
  isPassOnReadByUser,
  type PassOnReplyRef,
  type PassOnViewRef,
} from "@/app/pass-on-log/lib/pass-on-views";

export type PassOnKpiFocus = "new" | "unread" | "new-replies";

export type PassOnEntryForKpi = {
  id: number;
  created_at?: string | null;
  pass_on_log_views?: PassOnViewRef[] | null;
  pass_on_log_replies?: PassOnReplyRef[] | null;
};

export type PassOnKpiCounts = {
  newEntries: number;
  unread: number;
  newReplies: number;
};

function findUserView(
  entry: PassOnEntryForKpi,
  authUserId: string
): PassOnViewRef | undefined {
  return (entry.pass_on_log_views || []).find(
    (row) => String(row.auth_user_id).trim() === String(authUserId).trim()
  );
}

/** Never opened by this user (no view row), respecting membership baseline. */
export function isPassOnNewEntryForUser(
  entry: PassOnEntryForKpi,
  authUserId: string | null | undefined,
  readBaseline?: string | null
): boolean {
  if (!authUserId) return false;
  if (findUserView(entry, authUserId)) return false;

  // Pre-baseline history is never "New" — replies after baseline resurface as
  // Unread / New Replies instead.
  if (
    readBaseline &&
    entry.created_at &&
    new Date(entry.created_at).getTime() < new Date(readBaseline).getTime()
  ) {
    return false;
  }

  return !isPassOnReadByUser(entry, authUserId, readBaseline);
}

/**
 * Previously viewed (or baseline-treated as read), but a newer reply arrived
 * after that effective view time. Counts the entry once (not each reply).
 * Replies created before the baseline do not count.
 */
export function isPassOnNewRepliesForUser(
  entry: PassOnEntryForKpi,
  authUserId: string | null | undefined,
  readBaseline?: string | null
): boolean {
  if (!authUserId) return false;

  const effectiveViewedAt = getPassOnEffectiveViewedAt(
    entry,
    authUserId,
    readBaseline
  );
  if (!effectiveViewedAt) return false;

  const latestReplyAt = getLatestReplyAt(entry);
  if (!latestReplyAt) return false;

  // Only replies after the user's effective view (and after baseline when set)
  // count as New Replies.
  if (
    readBaseline &&
    new Date(latestReplyAt).getTime() <= new Date(readBaseline).getTime()
  ) {
    return false;
  }

  return (
    new Date(effectiveViewedAt).getTime() < new Date(latestReplyAt).getTime()
  );
}

export function matchesPassOnKpiFocus(
  entry: PassOnEntryForKpi,
  focus: PassOnKpiFocus,
  authUserId: string | null | undefined,
  readBaseline?: string | null
): boolean {
  switch (focus) {
    case "new":
      return isPassOnNewEntryForUser(entry, authUserId, readBaseline);
    case "unread":
      return !isPassOnReadByUser(entry, authUserId, readBaseline);
    case "new-replies":
      return isPassOnNewRepliesForUser(entry, authUserId, readBaseline);
    default:
      return true;
  }
}

export function countPassOnKpisForUser(
  entries: PassOnEntryForKpi[],
  authUserId: string,
  readBaseline?: string | null
): PassOnKpiCounts {
  let newEntries = 0;
  let unread = 0;
  let newReplies = 0;

  for (const entry of entries) {
    if (isPassOnNewEntryForUser(entry, authUserId, readBaseline)) newEntries += 1;
    if (!isPassOnReadByUser(entry, authUserId, readBaseline)) unread += 1;
    if (isPassOnNewRepliesForUser(entry, authUserId, readBaseline)) newReplies += 1;
  }

  return { newEntries, unread, newReplies };
}

export function parsePassOnKpiFocus(
  value: string | null | undefined
): PassOnKpiFocus | null {
  if (value === "new" || value === "unread" || value === "new-replies") {
    return value;
  }
  return null;
}
