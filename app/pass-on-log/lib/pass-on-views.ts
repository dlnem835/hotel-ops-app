export type PassOnViewRef = {
  auth_user_id: string;
  viewed_at?: string | null;
};

export type PassOnReplyRef = {
  created_at?: string | null;
};

export function getLatestReplyAt(
  entry: { pass_on_log_replies?: PassOnReplyRef[] | null }
): string | null {
  const replies = entry.pass_on_log_replies || [];
  if (!replies.length) return null;

  let latest: string | null = null;
  for (const reply of replies) {
    const createdAt = reply.created_at;
    if (!createdAt) continue;
    if (!latest || new Date(createdAt).getTime() > new Date(latest).getTime()) {
      latest = createdAt;
    }
  }

  return latest;
}

function entryCreatedBeforeBaseline(
  entry: { created_at?: string | null },
  readBaseline: string
): boolean {
  if (!entry.created_at) return false;
  return new Date(entry.created_at).getTime() < new Date(readBaseline).getTime();
}

/**
 * Effective "last viewed" time for KPI logic.
 * - Explicit view row viewed_at when present
 * - Else, for pre-baseline entries with no view: the baseline itself
 *   (membership / first-access cutoff — not a DB write)
 */
export function getPassOnEffectiveViewedAt(
  entry: {
    created_at?: string | null;
    pass_on_log_views?: PassOnViewRef[] | null;
  },
  authUserId: string | null | undefined,
  readBaseline?: string | null
): string | null {
  if (!authUserId) return null;

  const view = (entry.pass_on_log_views || []).find(
    (row) => String(row.auth_user_id).trim() === String(authUserId).trim()
  );
  if (view?.viewed_at) return view.viewed_at;
  if (view) return view.viewed_at ?? null;

  if (readBaseline && entryCreatedBeforeBaseline(entry, readBaseline)) {
    return readBaseline;
  }

  return null;
}

export function isPassOnReadByUser(
  entry: {
    created_at?: string | null;
    pass_on_log_views?: PassOnViewRef[] | null;
    pass_on_log_replies?: PassOnReplyRef[] | null;
  },
  authUserId: string | null | undefined,
  /**
   * Per-user/per-property read baseline (ISO). Entries created before this are
   * treated as already read when the user has no explicit view row — so a newly
   * created user does not inherit the entire historical log as unread. Omit or
   * pass null to preserve legacy behavior (missing view row => unread).
   *
   * A reply created after the baseline can resurface a pre-baseline entry as
   * unread without writing historical view rows.
   */
  readBaseline?: string | null
): boolean {
  if (!authUserId) return false;

  const view = (entry.pass_on_log_views || []).find(
    (row) => String(row.auth_user_id).trim() === String(authUserId).trim()
  );

  const latestReplyAt = getLatestReplyAt(entry);

  if (!view) {
    // No explicit read. Pre-baseline history is treated as read at baseline,
    // unless a newer reply arrived after the baseline.
    if (readBaseline && entryCreatedBeforeBaseline(entry, readBaseline)) {
      if (!latestReplyAt) return true;
      return (
        new Date(latestReplyAt).getTime() <= new Date(readBaseline).getTime()
      );
    }
    return false;
  }

  if (!latestReplyAt) return true;

  const viewedAt = view.viewed_at;
  if (!viewedAt) return true;

  return new Date(viewedAt).getTime() >= new Date(latestReplyAt).getTime();
}
