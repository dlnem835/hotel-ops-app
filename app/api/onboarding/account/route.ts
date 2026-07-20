import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getAuthenticatedUser } from "@/app/lib/tenant/server/authenticate-request";
import {
  AccountSetupError,
  completeAccountSetup,
  parseAccountSetupInput,
} from "@/app/lib/account-setup/server/complete-account-setup";
import { getAccountSetupState } from "@/app/lib/account-setup/server/account-setup-state";
import { isLightModeAllowedForUser } from "@/app/lib/theme/server/light-mode-access";

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

function errorResponse(error: unknown): NextResponse {
  if (error instanceof AccountSetupError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }
  const message = error instanceof Error ? error.message : "Server error";
  return NextResponse.json({ error: message }, { status: 500 });
}

export async function GET(request: Request) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const supabase = getServiceClient();
    const state = await getAccountSetupState(user.id, supabase);

    const { data: profile } = await supabase
      .from("user_profiles")
      .select("first_name, last_name, username, appearance_preference")
      .eq("user_id", user.id)
      .maybeSingle();

    const metadata = user.user_metadata ?? {};

    // Enforce on read: only an authorized user may ever see "light"; any stored
    // or tampered value resolves to Dark for everyone else.
    const storedAppearance = profile?.appearance_preference;
    const appearance =
      storedAppearance === "light" && isLightModeAllowedForUser(user.id)
        ? "light"
        : "dark";

    return NextResponse.json({
      accountSetupComplete: !state.incomplete,
      firstName: profile?.first_name ?? metadata.first_name ?? "",
      lastName: profile?.last_name ?? metadata.last_name ?? "",
      username: profile?.username ?? "",
      appearance,
    });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const input = parseAccountSetupInput(body);

    const supabase = getServiceClient();
    const result = await completeAccountSetup(supabase, user, input);

    return NextResponse.json(result);
  } catch (error) {
    return errorResponse(error);
  }
}
