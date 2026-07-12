import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/app/lib/tenant/server/authenticate-request";
import { createClient } from "@supabase/supabase-js";
import { completeGmInvitationForUser } from "@/app/lib/platform-admin/server/complete-gm-invitation";
import { PlatformAdminRequestError } from "@/app/lib/platform-admin/server/resolve-platform-admin-request";

function getServiceClient() {
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

function invitationErrorResponse(error: unknown): NextResponse {
  if (error instanceof PlatformAdminRequestError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }
  const message = error instanceof Error ? error.message : "Server error";
  return NextResponse.json({ error: message }, { status: 500 });
}

export async function POST(request: Request) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const supabase = getServiceClient();
    const result = await completeGmInvitationForUser(supabase, user);
    return NextResponse.json(result);
  } catch (error) {
    return invitationErrorResponse(error);
  }
}
