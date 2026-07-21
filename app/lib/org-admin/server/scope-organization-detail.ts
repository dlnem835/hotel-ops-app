import { isOrgWideRole } from "@/app/lib/platform-admin/roles";
import type {
  AdminOrganizationDetail,
  AdminOrganizationInvitation,
} from "@/app/lib/platform-admin/types";

/**
 * Property-scoping helpers for selected-properties Organization Administrators.
 *
 * A user may hold the Organization Administration entitlement while only being
 * assigned to a subset of properties (Access Scope = Selected Properties). In
 * that case every list, action, and API response must be limited to those
 * assigned hotels. Org-wide leaders (Primary Owner / Organization Admin) are not
 * shown to a scoped administrator — they sit above the scoped user's remit.
 */

export function invitationIsWithinPropertyScope(
  invitation: AdminOrganizationInvitation,
  allowedPropertyIds: number[]
): boolean {
  if (invitation.isPrimary || isOrgWideRole(invitation.orgRole)) {
    return false;
  }
  const allowed = new Set(allowedPropertyIds);
  if (invitation.assignedPropertyIds.some((id) => allowed.has(id))) {
    return true;
  }
  return allowed.has(invitation.propertyId);
}

export function scopeInvitationsToProperties(
  invitations: AdminOrganizationInvitation[],
  allowedPropertyIds: number[]
): AdminOrganizationInvitation[] {
  return invitations.filter((invitation) =>
    invitationIsWithinPropertyScope(invitation, allowedPropertyIds)
  );
}

export function scopeOrganizationDetailToProperties(
  detail: AdminOrganizationDetail,
  allowedPropertyIds: number[]
): AdminOrganizationDetail {
  const allowed = new Set(allowedPropertyIds);
  const properties = detail.properties.filter((property) =>
    allowed.has(property.id)
  );
  const invitations = scopeInvitationsToProperties(
    detail.invitations,
    allowedPropertyIds
  );

  return {
    ...detail,
    properties,
    propertyCount: properties.length,
    invitations,
    pendingInvitations: invitations.filter((row) => row.status === "pending")
      .length,
  };
}
