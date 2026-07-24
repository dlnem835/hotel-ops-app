-- Migration 051: Lost & Found automated shipping (Phase 1)
--
-- Adds:
--   - property_shipping_settings (structured ship-from defaults)
--   - lost_found_shipping_requests (guest token + payment/fulfillment/shipment state)
--   - lost_found_shipping_events (append-only audit)
--   - private storage bucket lost-found-shipping-labels
--
-- Does NOT remove or alter the manual guest-upload workflow
-- (public shipping-labels bucket, /label, /api/upload-label).
-- Does NOT add platform fee columns (defer to a later migration).

BEGIN;

-- ---------------------------------------------------------------------------
-- Property shipping settings (1:1 with properties)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.property_shipping_settings (
  property_id INT PRIMARY KEY REFERENCES public.properties(id) ON DELETE CASCADE,
  organization_id INT NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  shipping_enabled BOOLEAN NOT NULL DEFAULT false,
  sender_name TEXT NOT NULL DEFAULT '',
  ship_from_line1 TEXT NOT NULL DEFAULT '',
  ship_from_line2 TEXT NOT NULL DEFAULT '',
  ship_from_city TEXT NOT NULL DEFAULT '',
  ship_from_state TEXT NOT NULL DEFAULT '',
  ship_from_postal TEXT NOT NULL DEFAULT '',
  ship_from_country TEXT NOT NULL DEFAULT 'US',
  property_phone TEXT NOT NULL DEFAULT '',
  property_email TEXT NOT NULL DEFAULT '',
  default_package_preset TEXT NOT NULL DEFAULT 'small_box',
  default_length_in NUMERIC(10, 2),
  default_width_in NUMERIC(10, 2),
  default_height_in NUMERIC(10, 2),
  default_weight_oz NUMERIC(10, 2),
  default_sender_contact TEXT NOT NULL DEFAULT '',
  token_ttl_hours INT NOT NULL DEFAULT 168
    CHECK (token_ttl_hours > 0 AND token_ttl_hours <= 720),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS property_shipping_settings_org_idx
  ON public.property_shipping_settings (organization_id);

-- ---------------------------------------------------------------------------
-- Shipping requests
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.lost_found_shipping_requests (
  id BIGSERIAL PRIMARY KEY,
  organization_id INT NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  property_id INT NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  lost_item_id INT NOT NULL REFERENCES public.lost_items(id) ON DELETE CASCADE,

  secure_token_hash TEXT NOT NULL,
  token_expires_at TIMESTAMPTZ NOT NULL,

  guest_name TEXT NOT NULL DEFAULT '',
  guest_email TEXT NOT NULL DEFAULT '',
  guest_phone TEXT NOT NULL DEFAULT '',

  item_description_public TEXT NOT NULL DEFAULT '',
  internal_notes TEXT NOT NULL DEFAULT '',

  recipient_name TEXT NOT NULL DEFAULT '',
  recipient_phone TEXT NOT NULL DEFAULT '',
  recipient_address_json JSONB,
  ship_from_address_json JSONB NOT NULL DEFAULT '{}'::jsonb,

  package_preset TEXT NOT NULL DEFAULT 'small_box',
  weight_oz NUMERIC(10, 2),
  length_in NUMERIC(10, 2),
  width_in NUMERIC(10, 2),
  height_in NUMERIC(10, 2),

  shipping_provider TEXT NOT NULL DEFAULT 'mock',
  provider_rate_id TEXT,
  selected_carrier TEXT,
  selected_service TEXT,
  rate_snapshot_json JSONB,
  rate_expires_at TIMESTAMPTZ,
  quoted_shipping_amount NUMERIC(12, 2),
  total_amount NUMERIC(12, 2),
  currency TEXT NOT NULL DEFAULT 'usd',

  stripe_checkout_session_id TEXT,
  stripe_payment_intent_id TEXT,
  payment_status TEXT NOT NULL DEFAULT 'pending'
    CHECK (payment_status IN ('pending', 'paid', 'failed', 'expired', 'refunded')),

  fulfillment_status TEXT NOT NULL DEFAULT 'pending'
    CHECK (fulfillment_status IN ('pending', 'label_ready', 'needs_manual_review', 'cancelled')),

  shipment_status TEXT NOT NULL DEFAULT 'awaiting_guest'
    CHECK (shipment_status IN (
      'awaiting_guest',
      'awaiting_payment',
      'label_ready',
      'in_transit',
      'delivered',
      'exception',
      'cancelled'
    )),

  provider_transaction_id TEXT,
  tracking_number TEXT,
  tracking_url TEXT,
  label_storage_path TEXT,
  error_message TEXT,

  label_purchase_lock_at TIMESTAMPTZ,
  label_purchase_idempotency_key TEXT,

  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  paid_at TIMESTAMPTZ,
  label_created_at TIMESTAMPTZ,
  shipped_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ
);

CREATE UNIQUE INDEX IF NOT EXISTS lost_found_shipping_requests_token_hash_uidx
  ON public.lost_found_shipping_requests (secure_token_hash);

CREATE UNIQUE INDEX IF NOT EXISTS lost_found_shipping_requests_stripe_session_uidx
  ON public.lost_found_shipping_requests (stripe_checkout_session_id)
  WHERE stripe_checkout_session_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS lost_found_shipping_requests_tenant_idx
  ON public.lost_found_shipping_requests (organization_id, property_id);

CREATE INDEX IF NOT EXISTS lost_found_shipping_requests_item_idx
  ON public.lost_found_shipping_requests (lost_item_id);

CREATE INDEX IF NOT EXISTS lost_found_shipping_requests_payment_idx
  ON public.lost_found_shipping_requests (payment_status);

CREATE INDEX IF NOT EXISTS lost_found_shipping_requests_shipment_idx
  ON public.lost_found_shipping_requests (shipment_status);

-- At most one "active" unpaid automated request per item
CREATE UNIQUE INDEX IF NOT EXISTS lost_found_shipping_requests_one_active_per_item_uidx
  ON public.lost_found_shipping_requests (lost_item_id)
  WHERE cancelled_at IS NULL
    AND payment_status IN ('pending', 'failed')
    AND fulfillment_status = 'pending';

-- ---------------------------------------------------------------------------
-- Append-only shipping events
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.lost_found_shipping_events (
  id BIGSERIAL PRIMARY KEY,
  organization_id INT NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  property_id INT NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  lost_item_id INT NOT NULL REFERENCES public.lost_items(id) ON DELETE CASCADE,
  shipping_request_id BIGINT NOT NULL
    REFERENCES public.lost_found_shipping_requests(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  event_source TEXT NOT NULL DEFAULT 'system',
  event_data JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID
);

CREATE INDEX IF NOT EXISTS lost_found_shipping_events_request_idx
  ON public.lost_found_shipping_events (shipping_request_id, created_at);

CREATE INDEX IF NOT EXISTS lost_found_shipping_events_item_idx
  ON public.lost_found_shipping_events (lost_item_id, created_at);

CREATE INDEX IF NOT EXISTS lost_found_shipping_events_tenant_idx
  ON public.lost_found_shipping_events (organization_id, property_id);

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

ALTER TABLE public.property_shipping_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lost_found_shipping_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lost_found_shipping_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_property_shipping_settings_select ON public.property_shipping_settings;
CREATE POLICY tenant_property_shipping_settings_select ON public.property_shipping_settings
  FOR SELECT TO authenticated
  USING (public.auth_user_can_access_tenant_row(organization_id, property_id));

DROP POLICY IF EXISTS tenant_property_shipping_settings_insert ON public.property_shipping_settings;
CREATE POLICY tenant_property_shipping_settings_insert ON public.property_shipping_settings
  FOR INSERT TO authenticated
  WITH CHECK (public.auth_user_can_access_tenant_row(organization_id, property_id));

DROP POLICY IF EXISTS tenant_property_shipping_settings_update ON public.property_shipping_settings;
CREATE POLICY tenant_property_shipping_settings_update ON public.property_shipping_settings
  FOR UPDATE TO authenticated
  USING (public.auth_user_can_access_tenant_row(organization_id, property_id))
  WITH CHECK (public.auth_user_can_access_tenant_row(organization_id, property_id));

DROP POLICY IF EXISTS tenant_lost_found_shipping_requests_select ON public.lost_found_shipping_requests;
CREATE POLICY tenant_lost_found_shipping_requests_select ON public.lost_found_shipping_requests
  FOR SELECT TO authenticated
  USING (public.auth_user_can_access_tenant_row(organization_id, property_id));

DROP POLICY IF EXISTS tenant_lost_found_shipping_requests_insert ON public.lost_found_shipping_requests;
CREATE POLICY tenant_lost_found_shipping_requests_insert ON public.lost_found_shipping_requests
  FOR INSERT TO authenticated
  WITH CHECK (public.auth_user_can_access_tenant_row(organization_id, property_id));

DROP POLICY IF EXISTS tenant_lost_found_shipping_requests_update ON public.lost_found_shipping_requests;
CREATE POLICY tenant_lost_found_shipping_requests_update ON public.lost_found_shipping_requests
  FOR UPDATE TO authenticated
  USING (public.auth_user_can_access_tenant_row(organization_id, property_id))
  WITH CHECK (public.auth_user_can_access_tenant_row(organization_id, property_id));

DROP POLICY IF EXISTS tenant_lost_found_shipping_events_select ON public.lost_found_shipping_events;
CREATE POLICY tenant_lost_found_shipping_events_select ON public.lost_found_shipping_events
  FOR SELECT TO authenticated
  USING (public.auth_user_can_access_tenant_row(organization_id, property_id));

DROP POLICY IF EXISTS tenant_lost_found_shipping_events_insert ON public.lost_found_shipping_events;
CREATE POLICY tenant_lost_found_shipping_events_insert ON public.lost_found_shipping_events
  FOR INSERT TO authenticated
  WITH CHECK (public.auth_user_can_access_tenant_row(organization_id, property_id));

-- Guests never get direct table access; public APIs use service role after token hash match.

-- ---------------------------------------------------------------------------
-- Private label storage (purchased labels only — not guest manual uploads)
-- ---------------------------------------------------------------------------

INSERT INTO storage.buckets (id, name, public)
VALUES ('lost-found-shipping-labels', 'lost-found-shipping-labels', false)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS tenant_lf_shipping_labels_select ON storage.objects;
CREATE POLICY tenant_lf_shipping_labels_select ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'lost-found-shipping-labels'
    AND public.auth_user_can_access_storage_path(name)
  );

DROP POLICY IF EXISTS tenant_lf_shipping_labels_insert ON storage.objects;
CREATE POLICY tenant_lf_shipping_labels_insert ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'lost-found-shipping-labels'
    AND public.auth_user_can_access_storage_path(name)
  );

DROP POLICY IF EXISTS tenant_lf_shipping_labels_update ON storage.objects;
CREATE POLICY tenant_lf_shipping_labels_update ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'lost-found-shipping-labels'
    AND public.auth_user_can_access_storage_path(name)
  )
  WITH CHECK (
    bucket_id = 'lost-found-shipping-labels'
    AND public.auth_user_can_access_storage_path(name)
  );

DROP POLICY IF EXISTS tenant_lf_shipping_labels_delete ON storage.objects;
CREATE POLICY tenant_lf_shipping_labels_delete ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'lost-found-shipping-labels'
    AND public.auth_user_can_access_storage_path(name)
  );

COMMIT;
