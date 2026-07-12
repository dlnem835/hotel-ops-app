import type { SupabaseClient } from "@supabase/supabase-js";
import type { AdminOnboardingStatus } from "@/app/lib/platform-admin/types";

export type { AdminOnboardingStatus };

export async function buildOrganizationOnboarding(
  supabase: SupabaseClient,
  organizationId: number,
  propertyIds: number[]
): Promise<AdminOnboardingStatus> {
  const { data: invitations } = await supabase
    .from("organization_invitations")
    .select("status")
    .eq("organization_id", organizationId);

  const rows = invitations ?? [];
  const gmInvited = rows.some(
    (row) => row.status === "pending" || row.status === "accepted"
  );
  const gmAccepted = rows.some((row) => row.status === "accepted");

  let hotelConfigured = false;
  if (propertyIds.length > 0) {
    const { count, error } = await supabase
      .from("buildings_and_areas")
      .select("id", { count: "exact", head: true })
      .in("property_id", propertyIds)
      .limit(1);

    if (!error) {
      hotelConfigured = (count ?? 0) > 0;
    }
  }

  return {
    organizationCreated: true,
    propertyCreated: propertyIds.length > 0,
    gmInvited,
    gmAccepted,
    hotelConfigured,
  };
}

export function formatOnboardingSummary(onboarding: AdminOnboardingStatus): string {
  if (onboarding.hotelConfigured && onboarding.gmAccepted) {
    return "Onboarding complete";
  }
  if (onboarding.gmInvited && !onboarding.gmAccepted) {
    return "Awaiting GM acceptance";
  }
  if (onboarding.propertyCreated && !onboarding.gmInvited) {
    return "Property created — invite GM";
  }
  if (onboarding.organizationCreated && !onboarding.propertyCreated) {
    return "Organization created — add property";
  }
  return "In progress";
}
