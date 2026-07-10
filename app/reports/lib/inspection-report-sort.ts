import type {
  InspectionAssociateRankingRow,
  InspectionFailedOccurrenceDetailRow,
  InspectionInspectorShareRow,
  InspectionRoomsDoneRow,
  InspectionRoomsNotDoneRow,
} from "@/app/reports/lib/inspection-report-types";
import { compareRoomNumbers } from "@/app/reports/lib/inspection-report-filter-utils";

export type InspectionReportSortDirection = "asc" | "desc";

export type FailedAreasDetailSortColumn =
  | "itemLabel"
  | "roomNumber"
  | "inspectorName"
  | "associateName"
  | "scorePercent"
  | "completedAt"
  | "notes";

export type FailedItemsDetailSortColumn =
  | "sectionLabel"
  | "roomNumber"
  | "inspectorName"
  | "associateName"
  | "scorePercent"
  | "completedAt"
  | "notes";

export type AssociateRankingSortColumn =
  | "rank"
  | "associateName"
  | "completedCount"
  | "completedPercent"
  | "averageScore"
  | "failedItemCount"
  | "averageTimeLabel";

export type RoomsDoneSortColumn =
  | "roomNumber"
  | "inspectionType"
  | "inspectorName"
  | "associateName"
  | "scorePercent"
  | "failedItemCount"
  | "completedAt"
  | "durationLabel";

export type RoomsNotDoneSortColumn =
  | "roomNumber"
  | "lastDate"
  | "lastInspectorName"
  | "daysSinceLast"
  | "statusLabel";

export type InspectorShareSortColumn = "inspectorName" | "roomCount" | "percent";

function compareStrings(left: string, right: string): number {
  return left.localeCompare(right, undefined, { numeric: true, sensitivity: "base" });
}

function compareNullableNumbers(left: number | null, right: number | null): number {
  if (left === null && right === null) return 0;
  if (left === null) return 1;
  if (right === null) return -1;
  return left - right;
}

function compareIso(left: string | null, right: string | null): number {
  if (!left && !right) return 0;
  if (!left) return 1;
  if (!right) return -1;
  return left.localeCompare(right);
}

export function sortAssociateRankingRows(
  rows: InspectionAssociateRankingRow[],
  column: AssociateRankingSortColumn,
  direction: InspectionReportSortDirection
): InspectionAssociateRankingRow[] {
  const sorted = [...rows].sort((left, right) => {
    let comparison = 0;
    switch (column) {
      case "rank":
        comparison = left.rank - right.rank;
        break;
      case "associateName":
        comparison = compareStrings(left.associateName, right.associateName);
        break;
      case "completedCount":
        comparison = left.completedCount - right.completedCount;
        break;
      case "completedPercent":
        comparison = left.completedPercent - right.completedPercent;
        break;
      case "averageScore":
        comparison = compareNullableNumbers(left.averageScore, right.averageScore);
        break;
      case "failedItemCount":
        comparison = left.failedItemCount - right.failedItemCount;
        break;
      case "averageTimeLabel":
        comparison = compareNullableNumbers(left.averageTimeMs, right.averageTimeMs);
        break;
    }
    return direction === "asc" ? comparison : -comparison;
  });
  return sorted;
}

export function sortRoomsDoneRows(
  rows: InspectionRoomsDoneRow[],
  column: RoomsDoneSortColumn,
  direction: InspectionReportSortDirection
): InspectionRoomsDoneRow[] {
  const sorted = [...rows].sort((left, right) => {
    let comparison = 0;
    switch (column) {
      case "roomNumber":
        comparison = compareRoomNumbers(left.roomNumber, right.roomNumber);
        break;
      case "inspectionType":
        comparison = compareStrings(left.inspectionType, right.inspectionType);
        break;
      case "inspectorName":
        comparison = compareStrings(left.inspectorName, right.inspectorName);
        break;
      case "associateName":
        comparison = compareStrings(left.associateName, right.associateName);
        break;
      case "scorePercent":
        comparison = compareNullableNumbers(left.scorePercent, right.scorePercent);
        break;
      case "failedItemCount":
        comparison = left.failedItemCount - right.failedItemCount;
        break;
      case "completedAt":
        comparison = compareIso(left.completedAtSortIso, right.completedAtSortIso);
        break;
      case "durationLabel":
        comparison = compareNullableNumbers(left.durationMs, right.durationMs);
        break;
    }
    return direction === "asc" ? comparison : -comparison;
  });
  return sorted;
}

export function sortRoomsNotDoneRows(
  rows: InspectionRoomsNotDoneRow[],
  column: RoomsNotDoneSortColumn,
  direction: InspectionReportSortDirection
): InspectionRoomsNotDoneRow[] {
  const sorted = [...rows].sort((left, right) => {
    let comparison = 0;
    switch (column) {
      case "roomNumber":
        comparison = compareRoomNumbers(left.roomNumber, right.roomNumber);
        break;
      case "lastDate":
        comparison = compareIso(left.lastDateSortIso, right.lastDateSortIso);
        break;
      case "lastInspectorName":
        comparison = compareStrings(left.lastInspectorName || "", right.lastInspectorName || "");
        break;
      case "daysSinceLast":
        comparison = compareNullableNumbers(left.daysSinceLast, right.daysSinceLast);
        break;
      case "statusLabel":
        comparison = compareStrings(left.statusLabel, right.statusLabel);
        break;
    }
    return direction === "asc" ? comparison : -comparison;
  });
  return sorted;
}

function sortFailedOccurrenceRows<T extends FailedAreasDetailSortColumn | FailedItemsDetailSortColumn>(
  rows: InspectionFailedOccurrenceDetailRow[],
  column: T,
  direction: InspectionReportSortDirection
): InspectionFailedOccurrenceDetailRow[] {
  const sorted = [...rows].sort((left, right) => {
    let comparison = 0;
    switch (column) {
      case "itemLabel":
        comparison = compareStrings(left.itemLabel, right.itemLabel);
        break;
      case "sectionLabel":
        comparison = compareStrings(left.sectionLabel, right.sectionLabel);
        break;
      case "roomNumber":
        comparison = compareRoomNumbers(left.roomNumber, right.roomNumber);
        break;
      case "inspectorName":
        comparison = compareStrings(left.inspectorName, right.inspectorName);
        break;
      case "associateName":
        comparison = compareStrings(left.associateName, right.associateName);
        break;
      case "scorePercent":
        comparison = compareNullableNumbers(left.scorePercent, right.scorePercent);
        break;
      case "completedAt":
        comparison = compareIso(left.completedAtSortIso, right.completedAtSortIso);
        break;
      case "notes":
        comparison = compareStrings(left.notes, right.notes);
        break;
    }
    return direction === "asc" ? comparison : -comparison;
  });
  return sorted;
}

export function sortFailedAreasDetailRows(
  rows: InspectionFailedOccurrenceDetailRow[],
  column: FailedAreasDetailSortColumn,
  direction: InspectionReportSortDirection
): InspectionFailedOccurrenceDetailRow[] {
  return sortFailedOccurrenceRows(rows, column, direction);
}

export function sortFailedItemsDetailRows(
  rows: InspectionFailedOccurrenceDetailRow[],
  column: FailedItemsDetailSortColumn,
  direction: InspectionReportSortDirection
): InspectionFailedOccurrenceDetailRow[] {
  return sortFailedOccurrenceRows(rows, column, direction);
}

export function sortInspectorShareRows(
  rows: InspectionInspectorShareRow[],
  column: InspectorShareSortColumn,
  direction: InspectionReportSortDirection
): InspectionInspectorShareRow[] {
  const sorted = [...rows].sort((left, right) => {
    let comparison = 0;
    switch (column) {
      case "inspectorName":
        comparison = compareStrings(left.inspectorName, right.inspectorName);
        break;
      case "roomCount":
        comparison = left.roomCount - right.roomCount;
        break;
      case "percent":
        comparison = left.percent - right.percent;
        break;
    }
    return direction === "asc" ? comparison : -comparison;
  });
  return sorted;
}

export const ASSOCIATE_RANKING_SORT_COLUMNS: Array<{
  key: AssociateRankingSortColumn;
  label: string;
}> = [
  { key: "rank", label: "Rank" },
  { key: "associateName", label: "Associate" },
  { key: "completedCount", label: "Completed" },
  { key: "completedPercent", label: "% of total" },
  { key: "averageScore", label: "Average score" },
  { key: "failedItemCount", label: "Failed items" },
  { key: "averageTimeLabel", label: "Avg time" },
];

export const ROOMS_DONE_SORT_COLUMNS: Array<{ key: RoomsDoneSortColumn; label: string }> = [
  { key: "roomNumber", label: "Room" },
  { key: "inspectionType", label: "Type" },
  { key: "inspectorName", label: "Inspector" },
  { key: "associateName", label: "Associate" },
  { key: "scorePercent", label: "Score" },
  { key: "failedItemCount", label: "Failed items" },
  { key: "completedAt", label: "Completed" },
  { key: "durationLabel", label: "Duration" },
];

export const ROOMS_NOT_DONE_SORT_COLUMNS: Array<{
  key: RoomsNotDoneSortColumn;
  label: string;
}> = [
  { key: "roomNumber", label: "Room" },
  { key: "lastDate", label: "Last date" },
  { key: "lastInspectorName", label: "Last inspector" },
  { key: "daysSinceLast", label: "Days since" },
  { key: "statusLabel", label: "Status" },
];

export const FAILED_AREAS_DETAIL_SORT_COLUMNS: Array<{
  key: FailedAreasDetailSortColumn;
  label: string;
}> = [
  { key: "itemLabel", label: "Failed item" },
  { key: "roomNumber", label: "Room" },
  { key: "inspectorName", label: "Inspector" },
  { key: "associateName", label: "Associate" },
  { key: "scorePercent", label: "Score" },
  { key: "completedAt", label: "Completed" },
  { key: "notes", label: "Comments" },
];

export const FAILED_ITEMS_DETAIL_SORT_COLUMNS: Array<{
  key: FailedItemsDetailSortColumn;
  label: string;
}> = [
  { key: "sectionLabel", label: "Failed area" },
  { key: "roomNumber", label: "Room" },
  { key: "inspectorName", label: "Inspector" },
  { key: "associateName", label: "Associate" },
  { key: "scorePercent", label: "Score" },
  { key: "completedAt", label: "Completed" },
  { key: "notes", label: "Comments" },
];

export const INSPECTOR_SHARE_SORT_COLUMNS: Array<{ key: InspectorShareSortColumn; label: string }> =
  [
    { key: "inspectorName", label: "Inspector" },
    { key: "roomCount", label: "Rooms" },
    { key: "percent", label: "% of total" },
  ];
