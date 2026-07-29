-- Migration 055: Centralized shipping tenant hardening + future fee readiness
--
-- - Unique Shippo transaction id for webhook resolution
-- - Tracking lookup index
-- - Fee snapshot columns (inactive; all default 0 / fees_enabled false)
-- Does NOT activate platform fees or per-hotel Shippo/Stripe accounts.

BEGIN;

-- Prefer resolving webhooks by provider transaction id when present.
CREATE UNIQUE INDEX IF NOT EXISTS lost_found_shipping_requests_provider_txn_uidx
  ON public.lost_found_shipping_requests (provider_transaction_id)
  WHERE provider_transaction_id IS NOT NULL
    AND btrim(provider_transaction_id) <> '';

CREATE INDEX IF NOT EXISTS lost_found_shipping_requests_tracking_idx
  ON public.lost_found_shipping_requests (tracking_number)
  WHERE tracking_number IS NOT NULL
    AND btrim(tracking_number) <> '';

-- Fee readiness on the shipping request (snapshot at quote/checkout time).
-- Guest total remains shipping-only while fees_enabled is false.
ALTER TABLE public.lost_found_shipping_requests
  ADD COLUMN IF NOT EXISTS platform_fee_cents INT NOT NULL DEFAULT 0
    CHECK (platform_fee_cents >= 0),
  ADD COLUMN IF NOT EXISTS handling_fee_cents INT NOT NULL DEFAULT 0
    CHECK (handling_fee_cents >= 0),
  ADD COLUMN IF NOT EXISTS packaging_fee_cents INT NOT NULL DEFAULT 0
    CHECK (packaging_fee_cents >= 0),
  ADD COLUMN IF NOT EXISTS fees_enabled BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS fee_currency TEXT NOT NULL DEFAULT 'usd';

COMMENT ON COLUMN public.lost_found_shipping_requests.fees_enabled IS
  'When false, guest pays shipping only. Future: enable platform/handling/packaging fees.';

COMMENT ON COLUMN public.lost_found_shipping_requests.platform_fee_cents IS
  'Reserved One Eyrie platform fee (cents). Not charged while fees_enabled is false.';

COMMENT ON COLUMN public.lost_found_shipping_requests.handling_fee_cents IS
  'Reserved hotel handling fee (cents). Not charged while fees_enabled is false.';

COMMENT ON COLUMN public.lost_found_shipping_requests.packaging_fee_cents IS
  'Reserved packaging fee (cents). Not charged while fees_enabled is false.';

-- Property-level fee configuration defaults (inactive).
ALTER TABLE public.property_shipping_settings
  ADD COLUMN IF NOT EXISTS fees_enabled BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS platform_fee_cents INT NOT NULL DEFAULT 0
    CHECK (platform_fee_cents >= 0),
  ADD COLUMN IF NOT EXISTS handling_fee_cents INT NOT NULL DEFAULT 0
    CHECK (handling_fee_cents >= 0),
  ADD COLUMN IF NOT EXISTS packaging_fee_cents INT NOT NULL DEFAULT 0
    CHECK (packaging_fee_cents >= 0);

COMMENT ON COLUMN public.property_shipping_settings.fees_enabled IS
  'Future: when true, fee cents may be applied at checkout. Default false.';

COMMIT;
