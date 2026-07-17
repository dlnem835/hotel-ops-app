"use client";

import { useEffect, useState } from "react";
import {
  clearReportPropertyNameCache,
  loadReportPropertyNameCached,
} from "@/app/reports/lib/report-property";
import { usePropertyContext } from "@/app/components/TenantContextProviders";

export function useReportPropertyName() {
  const { propertyId } = usePropertyContext();
  const [propertyName, setPropertyName] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    clearReportPropertyNameCache();
    setPropertyName("");
    setLoading(true);

    async function loadPropertyName() {
      const name = await loadReportPropertyNameCached();
      if (!cancelled) {
        setPropertyName(name);
        setLoading(false);
      }
    }

    void loadPropertyName();

    return () => {
      cancelled = true;
    };
  }, [propertyId]);

  return { propertyName, loading };
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
