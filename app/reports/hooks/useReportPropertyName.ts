"use client";

import { useEffect, useState } from "react";
import {
  clearReportPropertyNameCache,
  loadReportPropertyNameCached,
} from "@/app/reports/lib/report-property";
import { usePropertyContext } from "@/app/components/TenantContextProviders";

export function useReportPropertyName() {
  const { propertyId } = usePropertyContext();
  const activePropertyId = propertyId ?? null;
  const [snapshot, setSnapshot] = useState<{
    propertyId: number | null;
    propertyName: string;
    loading: boolean;
  }>(() => ({
    propertyId: activePropertyId,
    propertyName: "",
    loading: true,
  }));

  useEffect(() => {
    let cancelled = false;
    clearReportPropertyNameCache();

    async function loadPropertyName() {
      const name = await loadReportPropertyNameCached();
      if (!cancelled) {
        setSnapshot({
          propertyId: propertyId ?? null,
          propertyName: name,
          loading: false,
        });
      }
    }

    void loadPropertyName();

    return () => {
      cancelled = true;
    };
  }, [propertyId]);

  const belongsToCurrentProperty = snapshot.propertyId === activePropertyId;
  return {
    propertyName: belongsToCurrentProperty ? snapshot.propertyName : "",
    loading: belongsToCurrentProperty ? snapshot.loading : true,
  };
}

/** Re-apply hotel property name when a report modal opens or the name finishes loading. */
export function useSyncReportPropertyName(
  open: boolean,
  propertyName: string,
  sync: (propertyName: string) => void
) {
  useEffect(() => {
    if (!open || !propertyName) return;
    sync(propertyName);
  }, [open, propertyName, sync]);
}
