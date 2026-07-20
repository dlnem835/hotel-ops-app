import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getAuthenticatedUser } from "@/app/lib/tenant/server/authenticate-request";
import { resolveTenantContextForUser } from "@/app/lib/tenant/server/resolve-tenant-context";
import { isAccountSetupIncomplete } from "@/app/lib/account-setup/server/account-setup-state";
import { isHotelAccountDisabled } from "@/app/lib/platform-admin/server/hotel-account-disabled";

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    throw new Error("Missing Supabase server configuration");
  }
  return createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function parseRequestedPropertyId(request: Request): number | null {
  const value = new URL(request.url).searchParams.get("propertyId");
  if (!value) return null;

  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

export async function GET(request: Request) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const serviceClient = getServiceClient();

    // Fail closed until first-login account setup is complete.
    if (await isAccountSetupIncomplete(user.id, serviceClient)) {
      return NextResponse.json(
        { error: "Account setup incomplete" },
        { status: 403 }
      );
    }

    if (await isHotelAccountDisabled(serviceClient, user.id)) {
      return NextResponse.json({ error: "Account disabled" }, { status: 403 });
    }

    const requestedPropertyId = parseRequestedPropertyId(request);
    const context = await resolveTenantContextForUser(user, requestedPropertyId);

    if (!context) {
      return NextResponse.json(
        { error: "No tenant membership found for this user" },
        { status: 403 }
      );
    }

    return NextResponse.json(context);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
