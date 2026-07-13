import { createClient } from "@supabase/supabase-js";
import type { SupabaseClient } from "@supabase/supabase-js";

export type AccountSetupState = {
  /** True when the user still needs to complete first-login setup. */
  incomplete: boolean;
  /** True when a user_profiles row exists for this user. */
  hasProfile: boolean;
};

function getServiceClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    throw new Error("Missing Supabase server configuration");
  }

  return createClient(url, serviceKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

/**
 * Reads onboarding state for a user. A missing row means "complete" so legacy
 * users are never forced through onboarding retroactively. Only invited users
 * (or those explicitly backfilled) carry account_setup_completed = false.
 *
 * Pass an existing service-role client to avoid creating a new one.
 */
export async function getAccountSetupState(
  userId: string,
  client?: SupabaseClient
): Promise<AccountSetupState> {
  const supabase = client ?? getServiceClient();

  const { data, error } = await supabase
    .from("user_profiles")
    .select("account_setup_completed")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    // Rollout safety: if migration 042 has not been applied yet, treat the
    // absent table like an absent row (setup complete) so existing users are
    // never broken. Once the table exists the gate activates automatically.
    if (error.code === "42P01" || /does not exist/i.test(error.message)) {
      return { incomplete: false, hasProfile: false };
    }
    throw new Error(error.message);
  }

  if (!data) {
    return { incomplete: false, hasProfile: false };
  }

  return {
    incomplete: data.account_setup_completed === false,
    hasProfile: true,
  };
}

/** Convenience guard used by the tenant data layer. */
export async function isAccountSetupIncomplete(
  userId: string,
  client?: SupabaseClient
): Promise<boolean> {
  const state = await getAccountSetupState(userId, client);
  return state.incomplete;
}
