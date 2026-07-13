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
   */
  readBaseline?: string | null
): boolean {
  if (!authUserId) return false;

  const view = (entry.pass_on_log_views || []).find(
    (row) => String(row.auth_user_id).trim() === String(authUserId).trim()
  );

  if (!view) {
    // No explicit read. Entries that predate the user's baseline (their account
    // creation / property membership) are treated as read. This is based purely
    // on entry creation time so pre-baseline entries never resurface as unread.
    if (readBaseline && entry.created_at) {
      return (
        new Date(entry.created_at).getTime() < new Date(readBaseline).getTime()
      );
    }
    return false;
  }

  const latestReplyAt = getLatestReplyAt(entry);
  if (!latestReplyAt) return true;

  const viewedAt = view.viewed_at;
  if (!viewedAt) return true;

  return new Date(viewedAt).getTime() >= new Date(latestReplyAt).getTime();
}
