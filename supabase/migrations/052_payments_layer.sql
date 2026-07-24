-- Migration 052: Dedicated Payments layer (Checkpoint C architecture)
--
-- Separates financial attempts from Lost & Found shipping business state.
-- Stripe identifiers live on payments rows, not shipping requests.
-- Shipping requests keep payment_status / paid_at as business mirrors and
-- reference the successful payment via successful_payment_id.

BEGIN;

-- ---------------------------------------------------------------------------
-- Payments (one row per payment attempt; extensible beyond Lost & Found)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.payments (
  id BIGSERIAL PRIMARY KEY,
  organization_id INT NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  property_id INT NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,

  purpose TEXT NOT NULL DEFAULT 'lost_found_shipping'
    CHECK (purpose IN (
      'lost_found_shipping',
      'subscription',
      'one_eyrie_billing',
      'other'
    )),

  shipping_request_id BIGINT
    REFERENCES public.lost_found_shipping_requests(id) ON DELETE SET NULL,

  provider TEXT NOT NULL DEFAULT 'stripe'
    CHECK (provider IN ('stripe')),

  provider_checkout_session_id TEXT,
  provider_payment_intent_id TEXT,

  amount_cents INT NOT NULL CHECK (amount_cents > 0),
  currency TEXT NOT NULL DEFAULT 'usd',

  status TEXT NOT NULL DEFAULT 'created'
    CHECK (status IN (
      'created',
      'checkout_open',
      'paid',
      'failed',
      'expired',
      'cancelled',
      'refunded',
      'partially_refunded'
    )),

  failure_reason TEXT,
  processed_webhook_event_ids TEXT[] NOT NULL DEFAULT '{}',

  metadata_json JSONB NOT NULL DEFAULT '{}'::jsonb,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  paid_at TIMESTAMPTZ
);

CREATE UNIQUE INDEX IF NOT EXISTS payments_provider_checkout_session_uidx
  ON public.payments (provider, provider_checkout_session_id)
  WHERE provider_checkout_session_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS payments_tenant_idx
  ON public.payments (organization_id, property_id);

CREATE INDEX IF NOT EXISTS payments_shipping_request_idx
  ON public.payments (shipping_request_id, created_at DESC);

CREATE INDEX IF NOT EXISTS payments_status_idx
  ON public.payments (status);

-- ---------------------------------------------------------------------------
-- Webhook receipts (global idempotency by provider event id)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.payment_webhook_receipts (
  id BIGSERIAL PRIMARY KEY,
  organization_id INT REFERENCES public.organizations(id) ON DELETE SET NULL,
  property_id INT REFERENCES public.properties(id) ON DELETE SET NULL,
  payment_id BIGINT REFERENCES public.payments(id) ON DELETE SET NULL,
  provider TEXT NOT NULL DEFAULT 'stripe'
    CHECK (provider IN ('stripe')),
  provider_event_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  processed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (provider, provider_event_id)
);

CREATE INDEX IF NOT EXISTS payment_webhook_receipts_payment_idx
  ON public.payment_webhook_receipts (payment_id, processed_at DESC);

-- ---------------------------------------------------------------------------
-- Shipping request: reference successful payment; drop Stripe-specific columns
-- ---------------------------------------------------------------------------

ALTER TABLE public.lost_found_shipping_requests
  ADD COLUMN IF NOT EXISTS successful_payment_id BIGINT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'lost_found_shipping_requests_successful_payment_id_fkey'
  ) THEN
    ALTER TABLE public.lost_found_shipping_requests
      ADD CONSTRAINT lost_found_shipping_requests_successful_payment_id_fkey
      FOREIGN KEY (successful_payment_id)
      REFERENCES public.payments(id)
      ON DELETE SET NULL;
  END IF;
END $$;

-- Move any legacy Stripe columns into payments (if 051 columns still present).
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'lost_found_shipping_requests'
      AND column_name = 'stripe_checkout_session_id'
  ) THEN
    INSERT INTO public.payments (
      organization_id,
      property_id,
      purpose,
      shipping_request_id,
      provider,
      provider_checkout_session_id,
      provider_payment_intent_id,
      amount_cents,
      currency,
      status,
      paid_at,
      metadata_json
    )
    SELECT
      r.organization_id,
      r.property_id,
      'lost_found_shipping',
      r.id,
      'stripe',
      r.stripe_checkout_session_id,
      r.stripe_payment_intent_id,
      GREATEST(
        1,
        ROUND(
          COALESCE(r.total_amount, r.quoted_shipping_amount, 0)::numeric * 100
        )::int
      ),
      LOWER(COALESCE(r.currency, 'usd')),
      CASE
        WHEN r.payment_status = 'paid' THEN 'paid'
        WHEN r.payment_status = 'failed' THEN 'failed'
        WHEN r.payment_status = 'expired' THEN 'expired'
        WHEN r.payment_status = 'refunded' THEN 'refunded'
        WHEN r.stripe_checkout_session_id IS NOT NULL THEN 'checkout_open'
        ELSE 'created'
      END,
      r.paid_at,
      jsonb_build_object('migrated_from', 'lost_found_shipping_requests_051')
    FROM public.lost_found_shipping_requests r
    WHERE (
      r.stripe_checkout_session_id IS NOT NULL
      OR r.stripe_payment_intent_id IS NOT NULL
      OR r.payment_status = 'paid'
    )
    AND NOT EXISTS (
      SELECT 1
      FROM public.payments p
      WHERE p.shipping_request_id = r.id
        AND (
          (
            r.stripe_checkout_session_id IS NOT NULL
            AND p.provider_checkout_session_id = r.stripe_checkout_session_id
          )
          OR (
            r.stripe_checkout_session_id IS NULL
            AND p.status = 'paid'
            AND r.payment_status = 'paid'
          )
        )
    );

    UPDATE public.lost_found_shipping_requests r
    SET successful_payment_id = p.id
    FROM public.payments p
    WHERE p.shipping_request_id = r.id
      AND p.status = 'paid'
      AND r.payment_status = 'paid'
      AND r.successful_payment_id IS NULL;

    DROP INDEX IF EXISTS public.lost_found_shipping_requests_stripe_session_uidx;

    ALTER TABLE public.lost_found_shipping_requests
      DROP COLUMN IF EXISTS stripe_checkout_session_id,
      DROP COLUMN IF EXISTS stripe_payment_intent_id;
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_webhook_receipts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_payments_select ON public.payments;
CREATE POLICY tenant_payments_select ON public.payments
  FOR SELECT TO authenticated
  USING (public.auth_user_can_access_tenant_row(organization_id, property_id));

DROP POLICY IF EXISTS tenant_payments_insert ON public.payments;
CREATE POLICY tenant_payments_insert ON public.payments
  FOR INSERT TO authenticated
  WITH CHECK (public.auth_user_can_access_tenant_row(organization_id, property_id));

DROP POLICY IF EXISTS tenant_payments_update ON public.payments;
CREATE POLICY tenant_payments_update ON public.payments
  FOR UPDATE TO authenticated
  USING (public.auth_user_can_access_tenant_row(organization_id, property_id))
  WITH CHECK (public.auth_user_can_access_tenant_row(organization_id, property_id));

-- Webhook receipts are system-managed; staff may read for support.
DROP POLICY IF EXISTS tenant_payment_webhook_receipts_select ON public.payment_webhook_receipts;
CREATE POLICY tenant_payment_webhook_receipts_select ON public.payment_webhook_receipts
  FOR SELECT TO authenticated
  USING (
    organization_id IS NOT NULL
    AND property_id IS NOT NULL
    AND public.auth_user_can_access_tenant_row(organization_id, property_id)
  );

COMMIT;
