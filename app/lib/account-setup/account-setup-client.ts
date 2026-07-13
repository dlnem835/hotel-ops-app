"use client";

import { supabase } from "@/app/supabaseClient";

export const ACCOUNT_SETUP_PATH = "/onboarding/account";

export type AccountSetupClientState = {
  accountSetupComplete: boolean;
  firstName: string;
  lastName: string;
  username: string;
  appearance: "dark" | "light";
};

/**
 * Reads onboarding state for the current session. Returns null when there is no
 * session or the request fails (caller decides how to degrade). This endpoint
 * is reachable even while setup is incomplete (it does not use the tenant data
 * layer), so it is safe to call before hotel access is granted.
 */
export async function fetchAccountSetupState(): Promise<AccountSetupClientState | null> {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session?.access_token) {
    return null;
  }

  const response = await fetch("/api/onboarding/account", {
    headers: { Authorization: `Bearer ${session.access_token}` },
    cache: "no-store",
  });

  if (!response.ok) {
    return null;
  }

  return (await response.json()) as AccountSetupClientState;
}
