import type { SupabaseClient } from "@supabase/supabase-js";
import { TenantRequestError } from "@/app/lib/tenant/server/resolve-tenant-request";

export type TenantScope = {
  organizationId: number;
  propertyId: number;
};

type TenantFilterable = {
  eq: (column: string, value: string | number) => TenantFilterable;
};

/**
 * Adds `organization_id` + `property_id` equality filters to a Supabase query
 * builder. Works with select/update/delete builders.
 */
export function scopeQueryToTenant<T extends TenantFilterable>(
  query: T,
  scope: TenantScope
): T {
  return query
    .eq("organization_id", scope.organizationId)
    .eq("property_id", scope.propertyId) as T;
}

/**
 * Returns a copy of an insert payload stamped with the active tenant columns.
 * Root tables (no DB stamp trigger) must use this on every insert.
 */
export function withTenantColumns<T extends Record<string, unknown>>(
  payload: T,
  scope: TenantScope
): T & { organization_id: number; property_id: number } {
  return {
    ...payload,
    organization_id: scope.organizationId,
    property_id: scope.propertyId,
  };
}

/**
 * Verifies that a single row identified by `id` exists within the active tenant.
 * Throws a 404 `TenantRequestError` when the row is missing or belongs to a
 * different property, preventing cross-property IDOR access.
 */
export async function assertRowInTenant(
  supabase: SupabaseClient,
  table: string,
  id: number | string,
  scope: TenantScope,
  notFoundMessage = "Record not found"
): Promise<void> {
  const { data, error } = await supabase
    .from(table)
    .select("id")
    .eq("id", id)
    .eq("organization_id", scope.organizationId)
    .eq("property_id", scope.propertyId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (!data) {
    throw new TenantRequestError(404, notFoundMessage);
  }
}
