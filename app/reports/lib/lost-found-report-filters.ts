import type {
  LostFoundFoundByReportFilters,
  LostFoundReportFilters,
} from "@/app/reports/lib/report-definitions";
import type {
  SampleLostFoundFoundByRow,
  SampleLostFoundItem,
} from "@/app/reports/lib/lost-found-report-sample-data";

function matchesDateRange(
  createdAtIso: string | null | undefined,
  dateStart: string,
  dateEnd: string
): boolean {
  if (!dateStart && !dateEnd) return true;
  if (!createdAtIso) return false;

  if (dateStart && createdAtIso < dateStart) return false;
  if (dateEnd && createdAtIso > dateEnd) return false;
  return true;
}

export function filterLostFoundAllItemsReportRows(
  rows: SampleLostFoundItem[],
  filters: LostFoundReportFilters
): SampleLostFoundItem[] {
  return rows.filter((row) => {
    if (filters.status !== "All" && row.status !== filters.status) {
      return false;
    }

    if (filters.foundBy !== "All" && row.foundBy !== filters.foundBy) {
      return false;
    }

    if (filters.createdBy !== "All" && row.createdBy !== filters.createdBy) {
      return false;
    }

    if (!matchesDateRange(row.createdAtIso, filters.dateStart, filters.dateEnd)) {
      return false;
    }

    return true;
  });
}

export function filterLostFoundFoundByReportRows(
  rows: SampleLostFoundFoundByRow[],
  filters: LostFoundFoundByReportFilters
): SampleLostFoundFoundByRow[] {
  return rows.filter((row) => {
    if (filters.foundBy !== "All" && row.associateName !== filters.foundBy) {
      return false;
    }

    if (filters.department !== "All" && row.department !== filters.department) {
      return false;
    }

    if (!matchesDateRange(row.lastItemFoundDateIso, filters.dateStart, filters.dateEnd)) {
      return false;
    }

    return true;
  });
}

export function filterLostFoundItemsForAssociateDrillDown(
  items: SampleLostFoundItem[],
  associateName: string,
  filters: LostFoundFoundByReportFilters
): SampleLostFoundItem[] {
  return items.filter((item) => {
    if (item.foundBy !== associateName) return false;
    if (!matchesDateRange(item.createdAtIso, filters.dateStart, filters.dateEnd)) {
      return false;
    }
    return true;
  });
}
