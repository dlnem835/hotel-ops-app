export type ReportTenantScope = {
  organizationId: number;
  propertyId: number;
};

export function isValidReportTenantScope(
  scope: { organizationId?: number | null; propertyId?: number | null } | null | undefined
): scope is ReportTenantScope {
  return (
    typeof scope?.organizationId === "number" &&
    Number.isFinite(scope.organizationId) &&
    scope.organizationId > 0 &&
    typeof scope.propertyId === "number" &&
    Number.isFinite(scope.propertyId) &&
    scope.propertyId > 0
  );
}

export function reportTenantScopeFromIds(
  organizationId?: number | null,
  propertyId?: number | null
): ReportTenantScope | null {
  const scope = { organizationId, propertyId };
  return isValidReportTenantScope(scope) ? scope : null;
}

export function reportTenantScopeFromScheduleRow(row: {
  organization_id?: number | null;
  property_id?: number | null;
}): ReportTenantScope | null {
  return reportTenantScopeFromIds(row.organization_id, row.property_id);
}

export function requireReportTenantScope(
  scope: ReportTenantScope | null | undefined,
  message = "Report tenant scope is required."
): ReportTenantScope {
  if (!isValidReportTenantScope(scope)) {
    throw new Error(message);
  }
  return scope;
}
