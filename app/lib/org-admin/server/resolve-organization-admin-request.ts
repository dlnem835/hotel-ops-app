import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import { getAuthenticatedUser } from "@/app/lib/tenant/server/authenticate-request";
import { resolveOrgAdminMembership } from "@/app/lib/org-admin/server/org-admin-entitlement";

/**
 * Customer Organization Administration guard.
 *
 * Authorizes a request for the customer-facing portal (/settings/organization).
 * Access requires the explicit `org_admin_portal_access` entitlement on an
 * ACTIVE membership in the TARGET organization — NOT merely an org-wide role.
 * Platform admin status is neither required nor consulted here; this is
 * intentionally the customer authorization layer, kept separate from
 * `/api/admin/*`.
 *
 * The guard also returns the caller's Access Scope (orgWide + assignedPropertyIds)
 * so routes can limit selected-properties administrators to their assigned hotels.
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
  /** Internal role held by the caller (org_owner / org_admin / org_member). */
  orgRole: string;
  /** True when the caller administers every current + future property. */
  orgWide: boolean;
  /** Active property ids the caller may reach (empty + orgWide = all). */
  assignedPropertyIds: number[];
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

  const membership = await resolveOrgAdminMembership(
    supabase,
    user.id,
    organizationId
  );

  if (!membership) {
    throw new OrganizationAdminRequestError(
      403,
      "Forbidden — organization administrator access required"
    );
  }

  return {
    user,
    supabase,
    organizationId,
    orgRole: membership.orgRole,
    orgWide: membership.orgWide,
    assignedPropertyIds: membership.assignedPropertyIds,
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
  const membership = await resolveOrgAdminMembership(
    supabase,
    user.id,
    organizationId
  );

  if (!membership) {
    // Do not disclose existence of properties in other organizations.
    throw new OrganizationAdminRequestError(404, "Property not found");
  }

  // Selected-properties administrators may only reach their assigned hotels.
  if (
    !membership.orgWide &&
    !membership.assignedPropertyIds.includes(propertyId)
  ) {
    throw new OrganizationAdminRequestError(404, "Property not found");
  }

  return {
    user,
    supabase,
    organizationId,
    orgRole: membership.orgRole,
    orgWide: membership.orgWide,
    assignedPropertyIds: membership.assignedPropertyIds,
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

/**
 * Ensures a selected-properties administrator may act on a specific invitation.
 * Org-wide callers pass through. Scoped callers may only manage invitations that
 * belong to one of their assigned properties, and never org-wide / Primary Owner
 * leadership records (those sit above their remit). No-ops for org-wide callers.
 */
export async function assertInvitationWithinScope(
  context: OrganizationAdminContext,
  invitationId: string
): Promise<void> {
  if (context.orgWide) {
    return;
  }

  const { data, error } = await context.supabase
    .from("organization_invitations")
    .select("id, organization_id, property_id, org_role, is_primary")
    .eq("id", invitationId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }
  if (!data || Number(data.organization_id) !== context.organizationId) {
    throw new OrganizationAdminRequestError(404, "Administrator not found");
  }

  const isOrgLevel =
    Boolean(data.is_primary) ||
    ["org_owner", "org_admin"].includes(String(data.org_role ?? ""));
  const propertyId = data.property_id == null ? null : Number(data.property_id);

  if (
    isOrgLevel ||
    propertyId == null ||
    !context.assignedPropertyIds.includes(propertyId)
  ) {
    throw new OrganizationAdminRequestError(404, "Administrator not found");
  }
}

/**
 * Rejects customer attempts to set the One Eyrie-only Organization Administration
 * entitlement, even if manually injected into the request payload. This is a hard
 * server-side boundary — never rely on the client hiding the control.
 */
export function rejectOrgAdminEntitlementField(
  body: Record<string, unknown>
): void {
  if ("orgAdminPortalAccess" in body || "org_admin_portal_access" in body) {
    throw new OrganizationAdminRequestError(
      403,
      "Organization Administration access is managed by One Eyrie and cannot be changed here"
    );
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
