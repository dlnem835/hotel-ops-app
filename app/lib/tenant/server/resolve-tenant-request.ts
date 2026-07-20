import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import { getAuthenticatedUser } from "@/app/lib/tenant/server/authenticate-request";
import { resolveTenantContextForUser } from "@/app/lib/tenant/server/resolve-tenant-context";
import { isAccountSetupIncomplete } from "@/app/lib/account-setup/server/account-setup-state";
import { isHotelAccountDisabled } from "@/app/lib/platform-admin/server/hotel-account-disabled";
import { ONE_EYRIE_PROPERTY_HEADER } from "@/app/lib/tenant/server/tenant-headers";
import type { TenantContextResponse } from "@/app/lib/tenant/types";

export { ONE_EYRIE_PROPERTY_HEADER };

/**
 * Error carrying an HTTP status so route handlers can translate a failed tenant
 * resolution into the correct response without leaking service-role details.
 */
export class TenantRequestError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "TenantRequestError";
    this.status = status;
  }
}

export type TenantApiContext = {
  user: User;
  /** Service-role client. Only used AFTER the user has been authenticated + authorized. */
  supabase: SupabaseClient;
  organizationId: number;
  propertyId: number;
  role: string;
  context: TenantContextResponse;
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

function parsePropertyId(value: string | null): number | null {
  if (!value) return null;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

/**
 * Reads the requested property id from the query string first, then the
 * `x-one-eyrie-property-id` header. Returns null when neither is present.
 */
export function readRequestedPropertyId(request: Request): number | null {
  const fromQuery = parsePropertyId(new URL(request.url).searchParams.get("propertyId"));
  if (fromQuery != null) return fromQuery;
  return parsePropertyId(request.headers.get(ONE_EYRIE_PROPERTY_HEADER));
}

/**
 * Authenticates the request, resolves the caller's active organization + property,
 * and fails closed if the caller is unauthenticated, has no membership, or asked
 * for a property they are not assigned to.
 *
 * Unlike `/api/tenant/context`, this helper does NOT silently fall back to the
 * default property when an explicit (but unauthorized) property id is supplied.
 */
export async function resolveTenantRequest(request: Request): Promise<TenantApiContext> {
  const user = await getAuthenticatedUser(request);
  if (!user) {
    throw new TenantRequestError(401, "Unauthorized");
  }

  // Fail closed: authenticated users who have not finished first-login account
  // setup get no access to hotel operational data. This is the security
  // boundary; the client redirect to /onboarding/account is only for UX.
  const serviceClient = getServiceClient();
  if (await isAccountSetupIncomplete(user.id, serviceClient)) {
    throw new TenantRequestError(403, "Account setup incomplete");
  }

  if (await isHotelAccountDisabled(serviceClient, user.id)) {
    throw new TenantRequestError(403, "Account disabled");
  }

  const requestedPropertyId = readRequestedPropertyId(request);
  const context = await resolveTenantContextForUser(user, requestedPropertyId);

  if (!context) {
    throw new TenantRequestError(403, "No tenant membership found for this user");
  }

  // Fail closed: if an explicit property was requested but not honored, the caller
  // is not authorized for it (resolveTenantContextForUser falls back to default).
  if (requestedPropertyId != null && context.activeProperty.id !== requestedPropertyId) {
    throw new TenantRequestError(403, "You are not authorized for the requested property");
  }

  return {
    user,
    supabase: serviceClient,
    organizationId: context.activeProperty.organizationId,
    propertyId: context.activeProperty.id,
    role: context.activeProperty.role,
    context,
  };
}

/** Translates a thrown value from `resolveTenantRequest` into a JSON response. */
export function tenantErrorResponse(error: unknown): NextResponse {
  if (error instanceof TenantRequestError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }
  const message = error instanceof Error ? error.message : "Server error";
  return NextResponse.json({ error: message }, { status: 500 });
}
