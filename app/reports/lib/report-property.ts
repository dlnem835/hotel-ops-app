import { tenantFetch } from "@/app/lib/tenant/tenant-fetch";

export const LOST_FOUND_AGING_RETENTION_LABEL = "Older than 6 months";

let cachedPropertyName = "";
let propertyNamePromise: Promise<string> | null = null;

export function clearReportPropertyNameCache() {
  cachedPropertyName = "";
  propertyNamePromise = null;
}

export async function fetchReportPropertyName(): Promise<string> {
  try {
    const response = await tenantFetch("/api/hotel-property");
    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.error || "Unable to load hotel property");
    }

    return String(result.property?.hotelName ?? "").trim();
  } catch {
    return "";
  }
}

/** Used by useReportPropertyName — respects clearReportPropertyNameCache(). */
export function loadReportPropertyNameCached(): Promise<string> {
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
