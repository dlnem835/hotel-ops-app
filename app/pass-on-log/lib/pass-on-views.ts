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
    pass_on_log_views?: PassOnViewRef[] | null;
    pass_on_log_replies?: PassOnReplyRef[] | null;
  },
  authUserId: string | null | undefined
): boolean {
  if (!authUserId) return false;

  const view = (entry.pass_on_log_views || []).find(
    (row) => String(row.auth_user_id).trim() === String(authUserId).trim()
  );
  if (!view) return false;

  const latestReplyAt = getLatestReplyAt(entry);
  if (!latestReplyAt) return true;

  const viewedAt = view.viewed_at;
  if (!viewedAt) return true;

  return new Date(viewedAt).getTime() >= new Date(latestReplyAt).getTime();
}
