"use client";

import { useCallback, useLayoutEffect, useRef, useState } from "react";
import {
  reportTenantScopesEqual,
  type ReportTenantScope,
} from "@/app/reports/lib/report-tenant-scope";

/** Render-time tenant identity for fetched report data. */
export function useTenantScopedReportSnapshot(scope: ReportTenantScope | null) {
  const [loadedScope, setLoadedScope] = useState<ReportTenantScope | null>(null);
  const scopeRef = useRef(scope);

  useLayoutEffect(() => {
    scopeRef.current = scope;
  }, [scope]);

  const belongsToCurrentScope = reportTenantScopesEqual(scope, loadedScope);

  const isCurrentRequest = useCallback((requestScope: ReportTenantScope): boolean => {
    return reportTenantScopesEqual(scopeRef.current, requestScope);
  }, []);

  const markLoaded = useCallback((requestScope: ReportTenantScope): boolean => {
    if (!reportTenantScopesEqual(scopeRef.current, requestScope)) return false;
    setLoadedScope(requestScope);
    return true;
  }, []);

  return { belongsToCurrentScope, isCurrentRequest, markLoaded };
}
