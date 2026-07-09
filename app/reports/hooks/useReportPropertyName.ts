"use client";

import { useEffect, useState } from "react";
import { fetchReportPropertyName } from "@/app/reports/lib/report-property";

let cachedPropertyName = "";
let propertyNamePromise: Promise<string> | null = null;

function loadReportPropertyName(): Promise<string> {
  if (cachedPropertyName) {
    return Promise.resolve(cachedPropertyName);
  }

  if (!propertyNamePromise) {
    propertyNamePromise = fetchReportPropertyName().then((name) => {
      cachedPropertyName = name;
      propertyNamePromise = null;
      return name;
    });
  }

  return propertyNamePromise;
}

export function useReportPropertyName() {
  const [propertyName, setPropertyName] = useState(cachedPropertyName);
  const [loading, setLoading] = useState(!cachedPropertyName);

  useEffect(() => {
    let cancelled = false;

    async function loadPropertyName() {
      if (!cachedPropertyName) {
        setLoading(true);
      }

      const name = await loadReportPropertyName();
      if (!cancelled) {
        setPropertyName(name);
        setLoading(false);
      }
    }

    void loadPropertyName();

    return () => {
      cancelled = true;
    };
  }, []);

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
