/**
 * Canonical membership roles for organizations and properties.
 *
 * Authorization model (selected):
 *   B — one organization-admin authorization role with descriptive job titles.
 *
 *   org_owner  -> Primary Owner           (org-wide: every current + future property)
 *   org_admin  -> Organization Admin      (org-wide; titles like Corporate Administrator,
 *                 Regional Director, Area Manager are descriptive only)
 *   org_member -> Property Administrator  (exactly one property; title often General Manager)
 *
 * Job title never grants access. Scope comes only from org_role + user_properties.
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

/**
 * Primary Owner and Organization Admin administer every active property in
 * their organization (including properties added later) through organization
 * membership. Property Administrators require explicit user_properties rows.
 */
export function isOrgWideRole(role: string | null | undefined): boolean {
  return role === ORG_ROLE.primaryOwner || role === ORG_ROLE.organizationAdmin;
}

export const ORG_ROLE_LABELS: Record<string, string> = {
  org_owner: "Primary Owner",
  org_admin: "Organization Admin",
  org_member: "Property Administrator",
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
    description:
      "Entire organization — every current property and any properties added later.",
  },
  {
    value: "property_administrator",
    label: "Property Administrator",
    description: "Scope is a single property.",
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
  if (input.orgRole === ORG_ROLE.member) {
    return "Property Administrator";
  }
  return ORG_ROLE_LABELS[input.orgRole] ?? "Administrator";
}

/** Human label for the scope an administrator can reach. */
export function administratorScopeLabel(
  orgRole: string,
  _assignedPropertyCount = 1
): string {
  if (isOrgWideRole(orgRole)) {
    return "Entire organization";
  }
  return "Single property";
}

/** Card / form label for the property field. */
export function administratorPropertyFieldLabel(orgRole: string): string {
  if (isOrgWideRole(orgRole)) {
    return "Properties";
  }
  return "Property";
}

/** Display value for the properties field on administrator cards. */
export function administratorPropertiesDisplay(input: {
  orgRole: string;
  propertyNames: string[];
}): string {
  if (isOrgWideRole(input.orgRole)) {
    return "All properties";
  }
  if (input.propertyNames.length === 0) {
    return "—";
  }
  return input.propertyNames.join(", ");
}

/** Maps a stored org_role back to the invite/edit role choice (non-primary). */
export function inviteRoleFromOrgRole(orgRole: string): AdministratorInviteRole {
  return orgRole === ORG_ROLE.organizationAdmin
    ? "organization_admin"
    : "property_administrator";
}

/**
 * Organization-page administrators: Primary Owner and org-wide admins.
 * Property Administrators / GMs belong on property pages only.
 */
export function isOrganizationLevelAdministrator(input: {
  isPrimary: boolean;
  orgRole: string;
}): boolean {
  return input.isPrimary || isOrgWideRole(input.orgRole);
}

/**
 * Property-page administrators: property-scoped invitations that cover this
 * property. Org-wide roles are excluded so a 200-property org does not list
 * every GM on the organization page.
 */
export function invitationBelongsOnPropertyPage(
  invitation: {
    isPrimary: boolean;
    orgRole: string;
    propertyId: number;
    assignedPropertyIds: number[];
  },
  propertyId: number
): boolean {
  if (isOrganizationLevelAdministrator(invitation)) {
    return false;
  }
  if (invitation.assignedPropertyIds.includes(propertyId)) {
    return true;
  }
  return invitation.propertyId === propertyId;
}

/** Suggested job titles for organization-level invitations (descriptive only). */
export const ORGANIZATION_ADMIN_JOB_TITLE_SUGGESTIONS = [
  "Corporate Administrator",
  "Regional Director",
  "Area Manager",
  "Organization Administrator",
] as const;

/** Suggested job titles for property-level invitations (descriptive only). */
export const PROPERTY_ADMIN_JOB_TITLE_SUGGESTIONS = [
  "General Manager",
  "Assistant General Manager",
  "Property Administrator",
] as const;

/** Normalize a list of positive property ids (deduped, insertion order preserved). */
export function normalizePropertyIdList(raw: unknown): number[] {
  if (!Array.isArray(raw)) {
    return [];
  }
  const seen = new Set<number>();
  const ids: number[] = [];
  for (const value of raw) {
    const parsed = Number.parseInt(String(value), 10);
    if (!Number.isInteger(parsed) || parsed <= 0 || seen.has(parsed)) {
      continue;
    }
    seen.add(parsed);
    ids.push(parsed);
  }
  return ids;
}
