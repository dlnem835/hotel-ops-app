import type { SupabaseClient, User } from "@supabase/supabase-js";
import {
  normalizeUsername,
  validateUsername,
} from "@/app/lib/account-setup/username";

export class AccountSetupError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "AccountSetupError";
    this.status = status;
  }
}

export type AccountSetupInput = {
  firstName: string;
  lastName: string;
  username: string;
};

export type AccountSetupResult = {
  completed: true;
  username: string;
};

/** Internal login identity format. Never surfaced to the user directly. */
function usernameToAuthEmail(normalizedUsername: string): string {
  return `${normalizedUsername}@oneeyrie.local`;
}

export function parseAccountSetupInput(
  body: Record<string, unknown>
): AccountSetupInput {
  const firstName = String(body.firstName ?? body.first_name ?? "").trim();
  const lastName = String(body.lastName ?? body.last_name ?? "").trim();
  const rawUsername = String(body.username ?? "");

  if (!firstName) {
    throw new AccountSetupError(400, "First name is required");
  }
  if (!lastName) {
    throw new AccountSetupError(400, "Last name is required");
  }

  const usernameResult = validateUsername(rawUsername);
  if (!usernameResult.ok) {
    throw new AccountSetupError(400, usernameResult.error);
  }

  return {
    firstName,
    lastName,
    username: usernameResult.normalized,
  };
}

/**
 * Finalizes first-login setup for an invited user.
 *
 * The caller (client) sets the password separately via `supabase.auth.updateUser`
 * using its own session, so the raw password never reaches this server code.
 * Here we canonicalize the login identity to `<username>@oneeyrie.local` (keeping
 * username login compatible with existing staff), persist profile fields, and
 * flip the durable onboarding flag to complete.
 *
 * Appearance is intentionally not part of setup — existing
 * `appearance_preference` rows are left unchanged.
 */
export async function completeAccountSetup(
  supabase: SupabaseClient,
  user: User,
  input: AccountSetupInput
): Promise<AccountSetupResult> {
  const normalizedUsername = normalizeUsername(input.username);

  const { data: existing, error: existingError } = await supabase
    .from("user_profiles")
    .select("user_id")
    .eq("username_normalized", normalizedUsername)
    .neq("user_id", user.id)
    .maybeSingle();

  if (existingError) {
    throw new Error(existingError.message);
  }
  if (existing) {
    throw new AccountSetupError(409, "That username is already taken");
  }

  const authEmail = usernameToAuthEmail(normalizedUsername);

  const { error: authUpdateError } = await supabase.auth.admin.updateUserById(
    user.id,
    {
      email: authEmail,
      email_confirm: true,
      user_metadata: {
        ...user.user_metadata,
        first_name: input.firstName,
        last_name: input.lastName,
        username: normalizedUsername,
      },
    }
  );

  if (authUpdateError) {
    const message = authUpdateError.message.toLowerCase();
    if (message.includes("already") || message.includes("registered")) {
      throw new AccountSetupError(409, "That username is already taken");
    }
    throw new Error(authUpdateError.message);
  }

  const timestamp = new Date().toISOString();

  // Do not write appearance_preference — preserve invite-time / existing value.
  const { error: profileError } = await supabase.from("user_profiles").upsert(
    {
      user_id: user.id,
      first_name: input.firstName,
      last_name: input.lastName,
      username: normalizedUsername,
      username_normalized: normalizedUsername,
      account_setup_completed: true,
      updated_at: timestamp,
    },
    { onConflict: "user_id" }
  );

  if (profileError) {
    if (profileError.code === "23505") {
      throw new AccountSetupError(409, "That username is already taken");
    }
    throw new Error(profileError.message);
  }

  const { error: teamMemberError } = await supabase
    .from("team_members")
    .update({
      first_name: input.firstName,
      last_name: input.lastName,
      username: normalizedUsername,
      auth_email: authEmail,
    })
    .eq("auth_user_id", user.id);

  if (teamMemberError) {
    throw new Error(teamMemberError.message);
  }

  return {
    completed: true,
    username: normalizedUsername,
  };
}
