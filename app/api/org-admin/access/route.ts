import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getAuthenticatedUser } from "@/app/lib/tenant/server/authenticate-request";
import { findOrgAdminMembershipForUser } from "@/app/lib/org-admin/server/org-admin-entitlement";

/**
 * Lightweight probe for the current user's Organization Administration
 * entitlement. Used by the sidebar to decide whether to show the "Organization"
 * navigation item. Returns `{ hasAccess, organizationId }`.
 *
 * This is authoritative for showing the nav item only; every customer portal API
 * still independently enforces the entitlement via the org-admin guard.
 */
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

export async function GET(request: Request) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) {
      return NextResponse.json({ hasAccess: false, organizationId: null });
    }

    const supabase = getServiceClient();
    const membership = await findOrgAdminMembershipForUser(supabase, user.id);

    return NextResponse.json({
      hasAccess: Boolean(membership),
      organizationId: membership?.organizationId ?? null,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
