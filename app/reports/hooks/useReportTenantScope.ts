"use client";

import { useMemo } from "react";
import { usePropertyContext } from "@/app/components/TenantContextProviders";
import {
  reportTenantScopeFromIds,
  type ReportTenantScope,
} from "@/app/reports/lib/report-tenant-scope";

export function useReportTenantScope(): {
  scope: ReportTenantScope | null;
  ready: boolean;
} {
  const { organizationId, propertyId, loading } = usePropertyContext();

  return useMemo(() => {
    const scope = loading ? null : reportTenantScopeFromIds(organizationId, propertyId);
    return { scope, ready: scope != null };
  }, [loading, organizationId, propertyId]);
}
