import type {
  LostFoundFoundByReportFilters,
  LostFoundReportFilters,
} from "@/app/reports/lib/report-definitions";
import { isLostFoundItemAging } from "@/app/reports/lib/lost-found-report-data";
import type {
  LostFoundFoundByRow,
  LostFoundReportItem,
} from "@/app/reports/lib/lost-found-report-types";

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

function matchesStatus(
  rowStatus: string,
  filterStatus: LostFoundReportFilters["status"]
): boolean {
  if (filterStatus === "All") return true;
  return rowStatus === filterStatus;
}

function matchesFoundBy(rowFoundBy: string, filterFoundBy: string): boolean {
  if (filterFoundBy === "All") return true;
  return rowFoundBy === filterFoundBy;
}

function matchesCreatedBy(rowCreatedBy: string, filterCreatedBy: string): boolean {
  if (filterCreatedBy === "All") return true;
  return rowCreatedBy === filterCreatedBy;
}

export function filterLostFoundAllItemsReportRows(
  rows: LostFoundReportItem[],
  filters: LostFoundReportFilters
): LostFoundReportItem[] {
  return rows.filter((row) => {
    if (!matchesStatus(row.status, filters.status)) return false;
    if (!matchesFoundBy(row.foundBy, filters.foundBy)) return false;
    if (!matchesCreatedBy(row.createdBy, filters.createdBy)) return false;
    if (!matchesDateRange(row.createdAtIso, filters.dateStart, filters.dateEnd)) {
      return false;
    }
    return true;
  });
}

export function filterLostFoundFoundByReportRows(
  rows: LostFoundFoundByRow[],
  filters: LostFoundFoundByReportFilters
): LostFoundFoundByRow[] {
  return rows.filter((row) => {
    if (!matchesFoundBy(row.associateName, filters.foundBy)) return false;

    if (filters.department !== "All" && row.department !== filters.department) {
      return false;
    }

    if (!matchesDateRange(row.lastItemFoundDateIso, filters.dateStart, filters.dateEnd)) {
      return false;
    }

    return true;
  });
}

export function filterLostFoundItemsForFoundByReport(
  items: LostFoundReportItem[],
  filters: LostFoundFoundByReportFilters
): LostFoundReportItem[] {
  return items.filter((item) => {
    if (!matchesFoundBy(item.foundBy, filters.foundBy)) return false;
    if (!matchesDateRange(item.createdAtIso, filters.dateStart, filters.dateEnd)) {
      return false;
    }
    return true;
  });
}

export function filterLostFoundItemsForAssociateDrillDown(
  items: LostFoundReportItem[],
  associateName: string,
  filters: LostFoundFoundByReportFilters
): LostFoundReportItem[] {
  return items.filter((item) => {
    if (item.foundBy !== associateName) return false;
    if (!matchesDateRange(item.createdAtIso, filters.dateStart, filters.dateEnd)) {
      return false;
    }
    return true;
  });
}

export function filterLostFoundShippingReportRows(
  rows: LostFoundReportItem[],
  filters: Pick<LostFoundReportFilters, "status" | "foundBy" | "dateStart" | "dateEnd">
): LostFoundReportItem[] {
  return rows.filter((row) => {
    if (row.status !== "Shipped") return false;
    if (!matchesStatus(row.status, filters.status)) return false;
    if (!matchesFoundBy(row.foundBy, filters.foundBy)) return false;
    if (!matchesDateRange(row.createdAtIso, filters.dateStart, filters.dateEnd)) {
      return false;
    }
    return true;
  });
}

export function filterLostFoundAgingReportRows(
  rows: LostFoundReportItem[],
  filters: Pick<LostFoundReportFilters, "status" | "foundBy">
): LostFoundReportItem[] {
  return rows.filter((row) => {
    if (!isLostFoundItemAging(row)) return false;
    if (row.status !== filters.status) return false;
    if (!matchesFoundBy(row.foundBy, filters.foundBy)) return false;
    return true;
  });
}
