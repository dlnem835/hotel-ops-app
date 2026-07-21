import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import { getAuthenticatedUser } from "@/app/lib/tenant/server/authenticate-request";
import { isOrgWideRole } from "@/app/lib/platform-admin/roles";

/**
 * Customer Organization Administration guard.
 *
 * Authorizes a request for the customer-facing portal (/settings/organization).
 * Access requires an ACTIVE org-wide membership (Primary Owner `org_owner` OR
 * Organization Admin `org_admin`) in the TARGET organization. Platform admin
 * status is neither required nor consulted here — this is intentionally the
 * customer authorization layer, kept separate from `/api/admin/*`.
 *
 * This never allows provisioning (create/delete org or property), suspension,
 * module toggles, permanent Auth deletion, or ownership transfer — those remain
 * One Eyrie Platform Administration concerns enforced on `/api/admin/*` and in
 * the shared server functions via capability checks.
 */
export class OrganizationAdminRequestError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "OrganizationAdminRequestError";
    this.status = status;
  }
}

export type OrganizationAdminContext = {
  user: User;
  supabase: SupabaseClient;
  organizationId: number;
  /** Org-wide role held by the caller: "org_owner" or "org_admin". */
  orgRole: string;
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
 * Authenticates the request and requires an active org-wide membership
 * (org_owner or org_admin) in `organizationId`.
 */
export async function resolveOrganizationAdminRequest(
  request: Request,
  organizationId: number
): Promise<OrganizationAdminContext> {
  const user = await getAuthenticatedUser(request);
  if (!user) {
    throw new OrganizationAdminRequestError(401, "Unauthorized");
  }

  if (!Number.isInteger(organizationId) || organizationId <= 0) {
    throw new OrganizationAdminRequestError(400, "Invalid organization id");
  }

  const supabase = getServiceClient();

  const { data, error } = await supabase
    .from("organization_users")
    .select("role, active")
    .eq("user_id", user.id)
    .eq("organization_id", organizationId)
    .eq("active", true)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (!data || !isOrgWideRole(data.role)) {
    throw new OrganizationAdminRequestError(
      403,
      "Forbidden — organization administrator access required"
    );
  }

  return {
    user,
    supabase,
    organizationId,
    orgRole: data.role as string,
  };
}

/**
 * Resolves an org-admin context from a property id. Looks up the property's
 * organization, then requires org-wide membership in that organization. Prevents
 * reaching another organization's property via the property routes.
 */
export async function resolveOrganizationAdminRequestForProperty(
  request: Request,
  propertyId: number
): Promise<OrganizationAdminContext & { propertyId: number }> {
  const user = await getAuthenticatedUser(request);
  if (!user) {
    throw new OrganizationAdminRequestError(401, "Unauthorized");
  }
  if (!Number.isInteger(propertyId) || propertyId <= 0) {
    throw new OrganizationAdminRequestError(400, "Invalid property id");
  }

  const supabase = getServiceClient();
  const { data: property, error: propertyError } = await supabase
    .from("properties")
    .select("id, organization_id")
    .eq("id", propertyId)
    .maybeSingle();

  if (propertyError) {
    throw new Error(propertyError.message);
  }
  if (!property) {
    throw new OrganizationAdminRequestError(404, "Property not found");
  }

  const organizationId = property.organization_id as number;
  const { data: membership, error: membershipError } = await supabase
    .from("organization_users")
    .select("role, active")
    .eq("user_id", user.id)
    .eq("organization_id", organizationId)
    .eq("active", true)
    .maybeSingle();

  if (membershipError) {
    throw new Error(membershipError.message);
  }
  if (!membership || !isOrgWideRole(membership.role)) {
    // Do not disclose existence of properties in other organizations.
    throw new OrganizationAdminRequestError(404, "Property not found");
  }

  return {
    user,
    supabase,
    organizationId,
    orgRole: membership.role as string,
    propertyId,
  };
}

/**
 * Confirms `propertyId` belongs to `organizationId`, so property routes cannot
 * be used to reach another organization's property. Returns nothing on success.
 */
export async function assertPropertyInOrganization(
  supabase: SupabaseClient,
  organizationId: number,
  propertyId: number
): Promise<void> {
  const { data, error } = await supabase
    .from("properties")
    .select("id, organization_id")
    .eq("id", propertyId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }
  if (!data || data.organization_id !== organizationId) {
    throw new OrganizationAdminRequestError(404, "Property not found");
  }
}

/** Translates a thrown value from the guard into a JSON response. */
export function organizationAdminErrorResponse(error: unknown): NextResponse {
  if (error instanceof OrganizationAdminRequestError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }
  const message = error instanceof Error ? error.message : "Server error";
  return NextResponse.json({ error: message }, { status: 500 });
}
