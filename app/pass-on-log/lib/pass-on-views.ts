export type PassOnViewRef = {
  auth_user_id: string;
};

export function isPassOnReadByUser(
  entry: { pass_on_log_views?: PassOnViewRef[] | null },
  authUserId: string | null | undefined
): boolean {
  if (!authUserId) return false;
  return (entry.pass_on_log_views || []).some(
    (view) => view.auth_user_id === authUserId
  );
}
