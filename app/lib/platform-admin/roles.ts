/**
 * Canonical membership roles for organizations and properties.
 *
 * Internal DB values are kept stable (org_owner/org_admin/... and
 * property_admin/...) while the product surfaces cleaner display names. Scope is
 * derived from the org role, so a user can administer one property, several, or
 * the whole organization without a schema/permission-model redesign:
 *
 *   org_owner  -> Primary Owner      (org-wide: every active property)
 *   org_admin  -> Organization Admin (org-wide: every active property)
 *   org_member -> property-scoped    (only explicit user_properties rows)
 */

export type OrgRole = "org_owner" | "org_admin" | "org_member" | "org_billing";

export type PropertyRole =
  | "property_admin"
  | "property_manager"
  | "property_supervisor"
  | "property_staff"
  | "property_read_only";

export const ORG_ROLE = {
  primaryOwner: "org_owner",
  organizationAdmin: "org_admin",
  member: "org_member",
  billing: "org_billing",
} as const;

export const PROPERTY_ROLE = {
  propertyAdministrator: "property_admin",
} as const;

/** Org roles that grant access to every active property in the organization. */
export function isOrgWideRole(role: string | null | undefined): boolean {
  return role === ORG_ROLE.primaryOwner || role === ORG_ROLE.organizationAdmin;
}

export const ORG_ROLE_LABELS: Record<string, string> = {
  org_owner: "Primary Owner",
  org_admin: "Organization Admin",
  org_member: "Member",
  org_billing: "Billing",
};

export const PROPERTY_ROLE_LABELS: Record<string, string> = {
  property_admin: "Property Administrator",
  property_manager: "Property Manager",
  property_supervisor: "Property Supervisor",
  property_staff: "Property Staff",
  property_read_only: "Read Only",
};

/**
 * Role choices offered when inviting an administrator. The Primary Owner is not
 * a choice — it is assigned automatically to the first administrator per org.
 */
export type AdministratorInviteRole =
  | "organization_admin"
  | "property_administrator";

export const ADMINISTRATOR_INVITE_ROLES: {
  value: AdministratorInviteRole;
  label: string;
  description: string;
}[] = [
  {
    value: "organization_admin",
    label: "Organization Admin",
    description: "Administers the entire organization and every property.",
  },
  {
    value: "property_administrator",
    label: "Property Administrator",
    description: "Administers only the selected property.",
  },
];

/** Maps an invite role choice to the stored (org_role, property_role) pair. */
export function resolveInviteRoles(role: AdministratorInviteRole): {
  orgRole: OrgRole;
  propertyRole: PropertyRole;
} {
  if (role === "organization_admin") {
    return { orgRole: "org_admin", propertyRole: "property_admin" };
  }
  return { orgRole: "org_member", propertyRole: "property_admin" };
}

/** Human label for an administrator row, accounting for the Primary designation. */
export function administratorRoleLabel(input: {
  isPrimary: boolean;
  orgRole: string;
}): string {
  if (input.isPrimary) {
    return ORG_ROLE_LABELS.org_owner;
  }
  return ORG_ROLE_LABELS[input.orgRole] ?? "Administrator";
}

/** Human label for the scope an administrator can reach. */
export function administratorScopeLabel(orgRole: string): string {
  return isOrgWideRole(orgRole) ? "Entire organization" : "Assigned property";
}
