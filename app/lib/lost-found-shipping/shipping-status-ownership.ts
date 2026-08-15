import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * True when the lost item has an active paid shipping request with a live
 * tracking number (Shippo owns Ready to Ship / Shipped / Delivered).
 */
export async function lostItemHasLiveShippingTracking(
  supabase: SupabaseClient,
  input: {
    lostItemId: number;
    organizationId: number;
    propertyId: number;
  }
): Promise<boolean> {
  const { data, error } = await supabase
    .from("lost_found_shipping_requests")
    .select("id")
    .eq("lost_item_id", input.lostItemId)
    .eq("organization_id", input.organizationId)
    .eq("property_id", input.propertyId)
    .is("cancelled_at", null)
    .not("tracking_number", "is", null)
    .neq("tracking_number", "")
    .limit(1)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return Boolean(data);
}

/** Map of lost_item_id → has live tracking (batch for list views). */
export async function mapLostItemsWithLiveShippingTracking(
  supabase: SupabaseClient,
  input: {
    lostItemIds: number[];
    organizationId: number;
    propertyId: number;
  }
): Promise<Record<number, boolean>> {
  const out: Record<number, boolean> = {};
  for (const id of input.lostItemIds) out[id] = false;
  if (input.lostItemIds.length === 0) return out;

  const { data, error } = await supabase
    .from("lost_found_shipping_requests")
    .select("lost_item_id")
    .eq("organization_id", input.organizationId)
    .eq("property_id", input.propertyId)
    .is("cancelled_at", null)
    .not("tracking_number", "is", null)
    .neq("tracking_number", "")
    .in("lost_item_id", input.lostItemIds);

  if (error) throw new Error(error.message);
  for (const row of data || []) {
    const id = Number(row.lost_item_id);
    if (Number.isFinite(id)) out[id] = true;
  }
  return out;
}
