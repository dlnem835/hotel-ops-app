export const LOST_FOUND_AGING_RETENTION_LABEL = "Older than 6 months";

export async function fetchReportPropertyName(): Promise<string> {
  try {
    const response = await fetch("/api/hotel-property");
    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.error || "Unable to load hotel property");
    }

    return String(result.property?.hotelName ?? "").trim();
  } catch {
    return "";
  }
}
