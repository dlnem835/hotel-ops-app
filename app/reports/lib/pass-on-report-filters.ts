import type { PassOnUnreadReportFilters } from "@/app/reports/lib/report-definitions";
import type {
  SamplePassOnUnreadByUserRow,
  SamplePassOnUnreadEntry,
} from "@/app/reports/lib/pass-on-report-sample-data";

function matchesDateRange(
  activityDateIso: string | null | undefined,
  dateStart: string,
  dateEnd: string
): boolean {
  if (!dateStart && !dateEnd) return true;
  if (!activityDateIso) return false;

  if (dateStart && activityDateIso < dateStart) return false;
  if (dateEnd && activityDateIso > dateEnd) return false;
  return true;
}

export function filterPassOnUnreadByUserRows(
  rows: SamplePassOnUnreadByUserRow[],
  filters: PassOnUnreadReportFilters
): SamplePassOnUnreadByUserRow[] {
  return rows
    .filter((row) => {
      if (filters.department !== "All" && row.department !== filters.department) {
        return false;
      }

      if (filters.user !== "All" && row.associateName !== filters.user) {
        return false;
      }

      if (!matchesDateRange(row.activityDateIso, filters.dateStart, filters.dateEnd)) {
        return false;
      }

      return true;
    })
    .sort((a, b) => b.entriesUnread - a.entriesUnread);
}

export function filterPassOnUnreadEntriesForAssociate(
  entries: SamplePassOnUnreadEntry[],
  associateName: string,
  filters: PassOnUnreadReportFilters
): SamplePassOnUnreadEntry[] {
  return entries.filter((entry) => {
    if (entry.associateName !== associateName) return false;
    if (!matchesDateRange(entry.postedAtIso, filters.dateStart, filters.dateEnd)) {
      return false;
    }
    return true;
  });
}
