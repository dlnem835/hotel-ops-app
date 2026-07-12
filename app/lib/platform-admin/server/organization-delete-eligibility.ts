import type { SupabaseClient } from "@supabase/supabase-js";
import { ORGANIZATION_OPERATIONAL_TABLES } from "@/app/lib/platform-admin/server/organization-constants";

export type OrganizationDeleteEligibility = {
  eligible: boolean;
  blockers: string[];
};

async function countOrgRows(
  supabase: SupabaseClient,
  table: string,
  organizationId: number
): Promise<number> {
  const { count, error } = await supabase
    .from(table)
    .select("*", { count: "exact", head: true })
    .eq("organization_id", organizationId);

  if (error) {
    throw new Error(`${table}: ${error.message}`);
  }

  return count ?? 0;
}

async function countUserPropertiesForOrg(
  supabase: SupabaseClient,
  organizationId: number
): Promise<number> {
  const { data: properties, error: propertyError } = await supabase
    .from("properties")
    .select("id")
    .eq("organization_id", organizationId);

  if (propertyError) {
    throw new Error(propertyError.message);
  }

  const propertyIds = (properties ?? []).map((row) => row.id as number);
  if (propertyIds.length === 0) {
    return 0;
  }

  const { count, error } = await supabase
    .from("user_properties")
    .select("*", { count: "exact", head: true })
    .in("property_id", propertyIds);

  if (error) {
    throw new Error(`user_properties: ${error.message}`);
  }

  return count ?? 0;
}

export async function evaluateOrganizationDeleteEligibility(
  supabase: SupabaseClient,
  organizationId: number
): Promise<OrganizationDeleteEligibility> {
  const blockers: string[] = [];

  for (const table of ORGANIZATION_OPERATIONAL_TABLES) {
    const count = await countOrgRows(supabase, table, organizationId);
    if (count > 0) {
      blockers.push(`${table} (${count})`);
    }
  }

  const userPropertyCount = await countUserPropertiesForOrg(supabase, organizationId);
  if (userPropertyCount > 0) {
    blockers.push(`user_properties (${userPropertyCount})`);
  }

  return {
    eligible: blockers.length === 0,
    blockers,
  };
}
