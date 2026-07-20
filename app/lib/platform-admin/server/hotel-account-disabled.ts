import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Returns true when a hotel-staff user should be refused a working session.
 * Active Platform Owners/Admins are never blocked here (portal access).
 * Users with at least one active organization membership may continue.
 */
export async function isHotelAccountDisabled(
  supabase: SupabaseClient,
  userId: string
): Promise<boolean> {
  const { data: platformAdmin, error: platformError } = await supabase
    .from("platform_admins")
    .select("id")
    .eq("user_id", userId)
    .eq("active", true)
    .maybeSingle();

  if (platformError) {
    throw new Error(platformError.message);
  }
  if (platformAdmin) {
    return false;
  }

  const { data: activeMemberships, error: membershipError } = await supabase
    .from("organization_users")
    .select("id")
    .eq("user_id", userId)
    .eq("active", true)
    .limit(1);

  if (membershipError) {
    throw new Error(membershipError.message);
  }

  if ((activeMemberships ?? []).length > 0) {
    return false;
  }

  // No active org membership: treat as disabled when they have any inactive
  // membership (revoked/disabled admin) or no memberships after invite revoke.
  const { count, error: anyMembershipError } = await supabase
    .from("organization_users")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId);

  if (anyMembershipError) {
    throw new Error(anyMembershipError.message);
  }

  return (count ?? 0) > 0;
}
