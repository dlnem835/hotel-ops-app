-- Manual shipment status override audit fields on lost_items.
ALTER TABLE public.lost_items
  ADD COLUMN IF NOT EXISTS status_manual_override boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS status_manual_override_at timestamptz,
  ADD COLUMN IF NOT EXISTS status_manual_override_by uuid,
  ADD COLUMN IF NOT EXISTS status_manual_override_reason text,
  ADD COLUMN IF NOT EXISTS status_manual_override_previous text;

COMMENT ON COLUMN public.lost_items.status_manual_override IS
  'True after admin Correct Shipment Status until the next automated carrier status update.';
