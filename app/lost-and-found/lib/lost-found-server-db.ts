import type { SupabaseClient } from "@supabase/supabase-js";
import { TenantRequestError } from "@/app/lib/tenant/server/resolve-tenant-request";

export type LostFoundScope = {
  organizationId: number;
  propertyId: number;
};

export async function assertLostItemInTenant(
  supabase: SupabaseClient,
  id: string | number,
  scope: LostFoundScope
): Promise<void> {
  const { data, error } = await supabase
    .from("lost_items")
    .select("id")
    .eq("id", id)
    .eq("organization_id", scope.organizationId)
    .eq("property_id", scope.propertyId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new TenantRequestError(404, "Lost item not found");
}

export async function listLostItems(supabase: SupabaseClient, scope: LostFoundScope) {
  const { data, error } = await supabase
    .from("lost_items")
    .select("*")
    .eq("organization_id", scope.organizationId)
    .eq("property_id", scope.propertyId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function createLostItem(
  supabase: SupabaseClient,
  scope: LostFoundScope,
  payload: Record<string, string | null>
) {
  const { data, error } = await supabase
    .from("lost_items")
    .insert([
      {
        ...payload,
        organization_id: scope.organizationId,
        property_id: scope.propertyId,
      },
    ])
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return data;
}

export async function updateLostItem(
  supabase: SupabaseClient,
  id: string | number,
  scope: LostFoundScope,
  patch: Record<string, string | number | boolean | null>
) {
  await assertLostItemInTenant(supabase, id, scope);
  const { data, error } = await supabase
    .from("lost_items")
    .update(patch)
    .eq("id", id)
    .eq("organization_id", scope.organizationId)
    .eq("property_id", scope.propertyId)
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return data;
}

export async function deleteLostItem(
  supabase: SupabaseClient,
  id: string | number,
  scope: LostFoundScope
) {
  await assertLostItemInTenant(supabase, id, scope);
  const { error } = await supabase
    .from("lost_items")
    .delete()
    .eq("id", id)
    .eq("organization_id", scope.organizationId)
    .eq("property_id", scope.propertyId);
  if (error) throw new Error(error.message);
}
