import type { TenantContextResponse } from "@/app/lib/tenant/types";

const STANDARD_PM_ORGANIZATION_ROLES = new Set(["org_owner", "org_admin"]);
const STANDARD_PM_PROPERTY_ROLES = new Set(["property_admin"]);

export function canManageStandardPmTemplates(
  context: TenantContextResponse | null
): boolean {
  if (!context) return false;
  return (
    STANDARD_PM_ORGANIZATION_ROLES.has(context.organization.role) ||
    STANDARD_PM_PROPERTY_ROLES.has(context.activeProperty.role)
  );
}
