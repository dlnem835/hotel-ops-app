import {
  getLatestReplyAt,
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
  const view = findUserView(entry, authUserId);
  if (view) return false;
  // Baseline treats pre-membership history as already read → not "new".
  return !isPassOnReadByUser(entry, authUserId, readBaseline);
}

/**
 * Previously viewed, but a newer reply arrived after the user's last view.
 * Counts the entry once (not each reply).
 */
export function isPassOnNewRepliesForUser(
  entry: PassOnEntryForKpi,
  authUserId: string | null | undefined
): boolean {
  if (!authUserId) return false;
  const view = findUserView(entry, authUserId);
  if (!view?.viewed_at) return false;
  const latestReplyAt = getLatestReplyAt(entry);
  if (!latestReplyAt) return false;
  return new Date(view.viewed_at).getTime() < new Date(latestReplyAt).getTime();
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
      return isPassOnNewRepliesForUser(entry, authUserId);
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
    if (isPassOnNewRepliesForUser(entry, authUserId)) newReplies += 1;
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
