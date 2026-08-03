-- Store Shippo tracking substatus alongside raw status for audit / reconciliation.
ALTER TABLE public.lost_found_shipping_requests
  ADD COLUMN IF NOT EXISTS carrier_tracking_substatus TEXT;

COMMENT ON COLUMN public.lost_found_shipping_requests.carrier_tracking_substatus IS
  'Shippo tracking_status.substatus.code when present (e.g. package_accepted).';
