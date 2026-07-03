-- Pass-On Log: allow reply/entry authors and admins to delete (and authors to update replies).

CREATE OR REPLACE FUNCTION public.pass_on_can_manage_author(stored_author text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM team_members tm
    WHERE tm.auth_user_id = auth.uid()
      AND (
        coalesce(tm.is_administrator, false)
        OR trim(coalesce(tm.job_title, '')) IN ('General Manager', 'Assistant General Manager')
        OR lower(trim(coalesce(tm.username, ''))) = lower(trim(coalesce(stored_author, '')))
        OR lower(trim(coalesce(stored_author, ''))) = lower(
          trim(concat_ws(' ', nullif(trim(tm.first_name), ''), nullif(trim(tm.last_name), '')))
        )
        OR (
          nullif(trim(tm.first_name), '') IS NOT NULL
          AND lower(trim(coalesce(stored_author, ''))) = lower(trim(tm.first_name))
        )
      )
  );
$$;

ALTER TABLE pass_on_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE pass_on_log_replies ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authors and admins can delete pass_on_log" ON pass_on_log;
CREATE POLICY "Authors and admins can delete pass_on_log"
  ON pass_on_log
  FOR DELETE
  TO authenticated
  USING (public.pass_on_can_manage_author(author));

DROP POLICY IF EXISTS "Authors and admins can delete pass_on_log_replies" ON pass_on_log_replies;
CREATE POLICY "Authors and admins can delete pass_on_log_replies"
  ON pass_on_log_replies
  FOR DELETE
  TO authenticated
  USING (public.pass_on_can_manage_author(reply_author));

DROP POLICY IF EXISTS "Authors and admins can update pass_on_log_replies" ON pass_on_log_replies;
CREATE POLICY "Authors and admins can update pass_on_log_replies"
  ON pass_on_log_replies
  FOR UPDATE
  TO authenticated
  USING (public.pass_on_can_manage_author(reply_author))
  WITH CHECK (public.pass_on_can_manage_author(reply_author));

DROP POLICY IF EXISTS "Authors can update pass_on_log" ON pass_on_log;
CREATE POLICY "Authors can update pass_on_log"
  ON pass_on_log
  FOR UPDATE
  TO authenticated
  USING (public.pass_on_can_manage_author(author))
  WITH CHECK (public.pass_on_can_manage_author(author));
