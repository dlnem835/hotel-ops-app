-- Migration 054: Lost & Found status cleanup + Shippo tracking fields
--
-- 1) Remap legacy lost_items.status strings to the six operational statuses
-- 2) Add carrier tracking / exception columns on shipping requests
-- 3) Add shipping_webhook_receipts for Shippo (and future carriers) idempotency
--
-- Does NOT purchase labels or retire the manual upload-label workflow.

BEGIN;

-- ---------------------------------------------------------------------------
-- Legacy → six primary operational statuses
-- ---------------------------------------------------------------------------

UPDATE public.lost_items
SET status = 'Stored'
WHERE status = 'Found';

UPDATE public.lost_items
SET status = 'Awaiting Guest Action'
WHERE status IN ('Awaiting Guest Payment', 'Label sent', 'Label request sent');

UPDATE public.lost_items
SET status = 'Ready to Ship'
WHERE status IN ('Ready to be shipped', 'Ready to be Shipped');

-- ---------------------------------------------------------------------------
-- Carrier tracking + exception detail (not primary LF status)
-- ---------------------------------------------------------------------------

ALTER TABLE public.lost_found_shipping_requests
  ADD COLUMN IF NOT EXISTS carrier_tracking_status TEXT,
  ADD COLUMN IF NOT EXISTS carrier_tracking_raw TEXT,
  ADD COLUMN IF NOT EXISTS carrier_tracking_updated_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_tracking_event_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS shipping_exception_code TEXT,
  ADD COLUMN IF NOT EXISTS shipping_exception_message TEXT,
  ADD COLUMN IF NOT EXISTS shipping_exception_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS returned_to_sender BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS label_printed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS estimated_delivery_at TIMESTAMPTZ;

COMMENT ON COLUMN public.lost_found_shipping_requests.carrier_tracking_status IS
  'Normalized carrier tracking state (pre_transit, in_transit, delivered, exception, returned, unknown). Separate from lost_items.status.';

COMMENT ON COLUMN public.lost_found_shipping_requests.returned_to_sender IS
  'True when carrier reports returned-to-sender. Do not mark Delivered.';

-- ---------------------------------------------------------------------------
-- Webhook receipts (Shippo / carrier tracking idempotency)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.shipping_webhook_receipts (
  id BIGSERIAL PRIMARY KEY,
  provider TEXT NOT NULL DEFAULT 'shippo',
  provider_event_id TEXT NOT NULL,
  event_type TEXT NOT NULL DEFAULT '',
  shipping_request_id BIGINT
    REFERENCES public.lost_found_shipping_requests(id) ON DELETE SET NULL,
  organization_id INT REFERENCES public.organizations(id) ON DELETE SET NULL,
  property_id INT REFERENCES public.properties(id) ON DELETE SET NULL,
  payload_hash TEXT,
  received_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (provider, provider_event_id)
);

CREATE INDEX IF NOT EXISTS shipping_webhook_receipts_request_idx
  ON public.shipping_webhook_receipts (shipping_request_id, received_at DESC);

CREATE INDEX IF NOT EXISTS shipping_webhook_receipts_tenant_idx
  ON public.shipping_webhook_receipts (organization_id, property_id);

ALTER TABLE public.shipping_webhook_receipts ENABLE ROW LEVEL SECURITY;

-- Service role / webhook processors use the service key; no end-user policies.

COMMIT;
