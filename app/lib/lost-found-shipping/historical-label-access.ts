import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { assertLostItemInTenant } from "@/app/lost-and-found/lib/lost-found-server-db";
import type { LostFoundShippingScope } from "@/app/lib/lost-found-shipping/shipping-requests";
import {
  HISTORICAL_SHIPPING_LABELS_BUCKET,
  isHistoricalLabelPathAllowedForTenant,
  parsePublicShippingLabelsObjectPath,
} from "@/app/lib/lost-found-shipping/historical-label-path";

const HISTORICAL_LABEL_SIGNED_TTL_SECONDS = 120;

/** Staff reprint of a legacy public shipping-labels object stored on lost_items.label_url. */
export async function createHistoricalShippingLabelSignedUrl(
  supabase: SupabaseClient,
  scope: LostFoundShippingScope,
  lostItemId: number
): Promise<{ url: string } | null> {
  await assertLostItemInTenant(supabase, lostItemId, scope);

  const { data: row, error } = await supabase
    .from("lost_items")
    .select("id, label_url")
    .eq("id", lostItemId)
    .eq("organization_id", scope.organizationId)
    .eq("property_id", scope.propertyId)
    .maybeSingle();

  if (error) throw new Error(error.message);

  const objectPath = parsePublicShippingLabelsObjectPath(
    typeof row?.label_url === "string" ? row.label_url : null
  );
  if (!objectPath) return null;

  if (
    !isHistoricalLabelPathAllowedForTenant(
      objectPath,
      scope.organizationId,
      scope.propertyId
    )
  ) {
    return null;
  }

  const { data: signed, error: signError } = await supabase.storage
    .from(HISTORICAL_SHIPPING_LABELS_BUCKET)
    .createSignedUrl(objectPath, HISTORICAL_LABEL_SIGNED_TTL_SECONDS);

  if (signError) throw new Error(signError.message);
  if (!signed?.signedUrl) return null;
  return { url: signed.signedUrl };
}
