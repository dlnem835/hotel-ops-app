"use client";

/**
 * Retired manual prepaid-label fallback. Kept so old imports do not break.
 * Does not email guests or call the retired send-email API.
 */
export default function SendLabelRequestForm({
  itemId: _itemId,
}: {
  itemId: number;
  id?: string;
}) {
  void _itemId;
  return (
    <p className="lnf-guest-shipping-feedback" role="status">
      Manual shipping-label email is no longer available. Use Send Shipping
      Request.
    </p>
  );
}
