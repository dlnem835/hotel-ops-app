/**
 * Canonical membership roles for organizations and properties.
 *
 * Authorization model (selected):
 *   B — one organization-admin authorization role with descriptive job titles.
 *
 *   org_owner  -> Primary Owner           (org-wide: every current + future property)
 *   org_admin  -> Organization Admin      (Access Scope: Entire Organization;
 *                 titles like Corporate Administrator, VP Operations are descriptive)
 *   org_member -> Property Administrator  (Access Scope: Selected Properties —
 *                 one or more hotels via user_properties; titles like Regional
 *                 Director, Area Manager, General Manager are descriptive)
 *
 * Job title never grants access. Scope comes only from org_role + user_properties.
 * UI presents "Organization Leadership" / "Property Leadership"; auth roles are unchanged.
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
 * membership. Selected-property leaders require explicit user_properties rows.
 */
export function isOrgWideRole(role: string | null | undefined): boolean {
  return role === ORG_ROLE.primaryOwner || role === ORG_ROLE.organizationAdmin;
}

export const ORG_ROLE_LABELS: Record<string, string> = {
  org_owner: "Primary Owner",
  org_admin: "Organization Administrator",
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

/** UI Access Scope for organization leadership invitations. */
export type AdministratorAccessScope =
  | "entire_organization"
  | "selected_properties";

export const ADMINISTRATOR_INVITE_ROLES: {
  value: AdministratorInviteRole;
  label: string;
  description: string;
}[] = [
  {
    value: "organization_admin",
    label: "Organization Administrator",
    description:
      "Entire organization — every current property and any properties added later.",
  },
  {
    value: "property_administrator",
    label: "Property Administrator",
    description: "Selected properties only — explicit hotel assignments.",
  },
];

export function accessScopeFromInviteRole(
  role: AdministratorInviteRole
): AdministratorAccessScope {
  return role === "organization_admin"
    ? "entire_organization"
    : "selected_properties";
}

export function inviteRoleFromAccessScope(
  scope: AdministratorAccessScope
): AdministratorInviteRole {
  return scope === "entire_organization"
    ? "organization_admin"
    : "property_administrator";
}

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

/** Authorization label (internal role), accounting for Primary designation. */
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

/**
 * Visible leadership role for cards and lists — prefers descriptive job title.
 * Primary Owner keeps its protected designation.
 */
export function administratorVisibleRoleLabel(input: {
  isPrimary: boolean;
  orgRole: string;
  jobTitle?: string | null;
}): string {
  if (input.isPrimary) {
    return ORG_ROLE_LABELS.org_owner;
  }
  const title = input.jobTitle?.trim();
  if (title) {
    return title;
  }
  return administratorRoleLabel(input);
}

/** Human label for Access Scope on cards and forms. */
export function administratorScopeLabel(
  orgRole: string,
  assignedPropertyCount = 1
): string {
  if (isOrgWideRole(orgRole)) {
    return "Entire Organization";
  }
  if (assignedPropertyCount > 1) {
    return "Selected Properties";
  }
  return "Selected Properties";
}

/** Card / form label for the property field. */
export function administratorPropertyFieldLabel(orgRole: string): string {
  if (isOrgWideRole(orgRole)) {
    return "Properties";
  }
  return "Properties";
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

export function accessScopeFromOrgRole(orgRole: string): AdministratorAccessScope {
  return isOrgWideRole(orgRole) ? "entire_organization" : "selected_properties";
}

/**
 * Organization Leadership list: Primary Owner, org-wide admins, and multi-hotel
 * selected-property leaders (Regional / Area). Single-hotel property leaders
 * belong on property pages only.
 */
export function isOrganizationLevelAdministrator(input: {
  isPrimary: boolean;
  orgRole: string;
  assignedPropertyIds?: number[];
}): boolean {
  if (input.isPrimary || isOrgWideRole(input.orgRole)) {
    return true;
  }
  if (input.orgRole === ORG_ROLE.member) {
    return (input.assignedPropertyIds?.length ?? 0) > 1;
  }
  return false;
}

/**
 * Property Leadership: single-hotel leaders for this property.
 * Organization Leadership (org-wide or multi-hotel) is excluded so large orgs
 * do not list every Regional Director on every property page.
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
  "VP Operations",
  "Organization Administrator",
] as const;

/** Suggested job titles for property-level invitations (descriptive only). */
export const PROPERTY_ADMIN_JOB_TITLE_SUGGESTIONS = [
  "General Manager",
  "Assistant General Manager",
  "Assistant GM",
  "Director of Engineering",
  "Executive Housekeeper",
  "Operations Manager",
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
