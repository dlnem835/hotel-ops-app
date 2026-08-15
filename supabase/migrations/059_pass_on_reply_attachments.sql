-- Associate Pass-On attachments with a specific reply when uploaded from a
-- reply composer. Entry-level attachments retain a null reply_id.
BEGIN;

ALTER TABLE public.pass_on_log_attachments
  ADD COLUMN IF NOT EXISTS reply_id INT
    REFERENCES public.pass_on_log_replies(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS pass_on_log_attachments_reply_idx
  ON public.pass_on_log_attachments (reply_id, created_at)
  WHERE reply_id IS NOT NULL;

COMMIT;
