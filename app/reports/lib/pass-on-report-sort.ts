import type {
  PassOnAssociateGroupRow,
  PassOnEditedEntryRow,
  PassOnKeywordSearchRow,
  PassOnReportDetailRow,
  PassOnShiftGroupRow,
  PassOnUnreadByUserRow,
  PassOnUnreadDetailRow,
} from "@/app/reports/lib/pass-on-report-types";
import { PASS_ON_SHIFT_SORT_ORDER } from "@/app/reports/lib/pass-on-report-filter-utils";

export type PassOnReportSortDirection = "asc" | "desc";

export const ASSOCIATE_GROUP_SORT_COLUMNS = [
  { key: "associateName", label: "Associate Name" },
  { key: "totalPublished", label: "Total Published Entries" },
  { key: "normalCount", label: "Normal Entries" },
  { key: "importantCount", label: "Important Entries" },
  { key: "urgentCount", label: "Urgent Entries" },
  { key: "editedCount", label: "Edited Entries" },
  { key: "mostRecentAt", label: "Most Recent Entry" },
] as const;

export type AssociateGroupSortColumn = (typeof ASSOCIATE_GROUP_SORT_COLUMNS)[number]["key"];

export const ASSOCIATE_DETAIL_SORT_COLUMNS = [
  { key: "subject", label: "Subject" },
  { key: "shift", label: "Shift" },
  { key: "priority", label: "Priority" },
  { key: "createdAt", label: "Created Date/Time" },
  { key: "editedAt", label: "Edited Date/Time" },
  { key: "readCount", label: "Read Count" },
  { key: "unreadCount", label: "Unread Count" },
] as const;

export type AssociateDetailSortColumn = (typeof ASSOCIATE_DETAIL_SORT_COLUMNS)[number]["key"];

export const SHIFT_GROUP_SORT_COLUMNS = [
  { key: "shiftName", label: "Shift Name" },
  { key: "totalPublished", label: "Total Published Entries" },
  { key: "normalCount", label: "Normal Entries" },
  { key: "importantCount", label: "Important Entries" },
  { key: "urgentCount", label: "Urgent Entries" },
  { key: "editedCount", label: "Edited Entries" },
  { key: "mostRecentAt", label: "Most Recent Entry" },
] as const;

export type ShiftGroupSortColumn = (typeof SHIFT_GROUP_SORT_COLUMNS)[number]["key"];

export const SHIFT_DETAIL_SORT_COLUMNS = [
  { key: "subject", label: "Subject" },
  { key: "createdBy", label: "Created By" },
  { key: "priority", label: "Priority" },
  { key: "createdAt", label: "Created Date/Time" },
  { key: "editedAt", label: "Edited Date/Time" },
  { key: "readCount", label: "Read Count" },
  { key: "unreadCount", label: "Unread Count" },
] as const;

export type ShiftDetailSortColumn = (typeof SHIFT_DETAIL_SORT_COLUMNS)[number]["key"];

export const EDITED_ENTRY_SORT_COLUMNS = [
  { key: "subject", label: "Subject" },
  { key: "shift", label: "Shift" },
  { key: "priority", label: "Priority" },
  { key: "createdBy", label: "Created By" },
  { key: "createdAt", label: "Created Date/Time" },
  { key: "editedAt", label: "Edited Date/Time" },
  { key: "preview", label: "Current Entry Preview" },
] as const;

export type EditedEntrySortColumn = (typeof EDITED_ENTRY_SORT_COLUMNS)[number]["key"];

export const KEYWORD_SEARCH_SORT_COLUMNS = [
  { key: "subject", label: "Subject" },
  { key: "shift", label: "Shift" },
  { key: "priority", label: "Priority" },
  { key: "createdBy", label: "Created By" },
  { key: "createdAt", label: "Created Date/Time" },
  { key: "editedAt", label: "Edited Date/Time" },
] as const;

export type KeywordSearchSortColumn = (typeof KEYWORD_SEARCH_SORT_COLUMNS)[number]["key"];

export const UNREAD_USER_SORT_COLUMNS = [
  { key: "userName", label: "User Name" },
  { key: "department", label: "Department / Role" },
  { key: "totalAvailable", label: "Total Published Entries Available to Read" },
  { key: "entriesRead", label: "Entries Read" },
  { key: "entriesUnread", label: "Entries Unread" },
  { key: "readPercent", label: "Read Percentage" },
  { key: "lastEntryReadAt", label: "Last Entry Read" },
] as const;

export type UnreadUserSortColumn = (typeof UNREAD_USER_SORT_COLUMNS)[number]["key"];

export const UNREAD_DETAIL_SORT_COLUMNS = [
  { key: "subject", label: "Subject" },
  { key: "shift", label: "Shift" },
  { key: "priority", label: "Priority" },
  { key: "createdBy", label: "Created By" },
  { key: "createdAt", label: "Created Date/Time" },
  { key: "ageMs", label: "Age of Unread Entry" },
] as const;

export type UnreadDetailSortColumn = (typeof UNREAD_DETAIL_SORT_COLUMNS)[number]["key"];

function compareString(left: string, right: string): number {
  return left.localeCompare(right, undefined, { sensitivity: "base" });
}

function compareNumber(left: number, right: number): number {
  return left - right;
}

function applyDirection<T>(value: number, direction: PassOnReportSortDirection): number {
  return direction === "asc" ? value : -value;
}

function compareNullableString(
  left: string | null | undefined,
  right: string | null | undefined
): number {
  const leftValue = left || "";
  const rightValue = right || "";
  if (!leftValue && rightValue) return 1;
  if (leftValue && !rightValue) return -1;
  return compareString(leftValue, rightValue);
}

export function sortAssociateGroups(
  rows: PassOnAssociateGroupRow[],
  column: AssociateGroupSortColumn,
  direction: PassOnReportSortDirection
): PassOnAssociateGroupRow[] {
  return [...rows].sort((left, right) => {
    let result = 0;
    switch (column) {
      case "associateName":
        result = compareString(left.associateName, right.associateName);
        break;
      case "totalPublished":
        result = compareNumber(left.totalPublished, right.totalPublished);
        break;
      case "normalCount":
        result = compareNumber(left.normalCount, right.normalCount);
        break;
      case "importantCount":
        result = compareNumber(left.importantCount, right.importantCount);
        break;
      case "urgentCount":
        result = compareNumber(left.urgentCount, right.urgentCount);
        break;
      case "editedCount":
        result = compareNumber(left.editedCount, right.editedCount);
        break;
      case "mostRecentAt":
        result = compareString(left.mostRecentAt, right.mostRecentAt);
        break;
      default:
        result = 0;
    }
    return applyDirection(result, direction);
  });
}

export function sortAssociateDetailRows(
  rows: PassOnReportDetailRow[],
  column: AssociateDetailSortColumn,
  direction: PassOnReportSortDirection
): PassOnReportDetailRow[] {
  return [...rows].sort((left, right) => {
    let result = 0;
    switch (column) {
      case "subject":
        result = compareString(left.subject, right.subject);
        break;
      case "shift":
        result =
          PASS_ON_SHIFT_SORT_ORDER[left.shift] - PASS_ON_SHIFT_SORT_ORDER[right.shift];
        break;
      case "priority":
        result = compareString(left.priority, right.priority);
        break;
      case "createdAt":
        result = compareString(left.createdAt, right.createdAt);
        break;
      case "editedAt":
        result = compareNullableString(left.editedAt, right.editedAt);
        break;
      case "readCount":
        result = compareNumber(left.readCount, right.readCount);
        break;
      case "unreadCount":
        result = compareNumber(left.unreadCount, right.unreadCount);
        break;
      default:
        result = 0;
    }
    return applyDirection(result, direction);
  });
}

export function sortShiftGroups(
  rows: PassOnShiftGroupRow[],
  column: ShiftGroupSortColumn,
  direction: PassOnReportSortDirection
): PassOnShiftGroupRow[] {
  return [...rows].sort((left, right) => {
    let result = 0;
    switch (column) {
      case "shiftName":
        result =
          PASS_ON_SHIFT_SORT_ORDER[left.shiftName] - PASS_ON_SHIFT_SORT_ORDER[right.shiftName];
        break;
      case "totalPublished":
        result = compareNumber(left.totalPublished, right.totalPublished);
        break;
      case "normalCount":
        result = compareNumber(left.normalCount, right.normalCount);
        break;
      case "importantCount":
        result = compareNumber(left.importantCount, right.importantCount);
        break;
      case "urgentCount":
        result = compareNumber(left.urgentCount, right.urgentCount);
        break;
      case "editedCount":
        result = compareNumber(left.editedCount, right.editedCount);
        break;
      case "mostRecentAt":
        result = compareString(left.mostRecentAt, right.mostRecentAt);
        break;
      default:
        result = 0;
    }
    return applyDirection(result, direction);
  });
}

export function sortShiftDetailRows(
  rows: PassOnShiftGroupRow["entries"],
  column: ShiftDetailSortColumn,
  direction: PassOnReportSortDirection
): PassOnShiftGroupRow["entries"] {
  return [...rows].sort((left, right) => {
    let result = 0;
    switch (column) {
      case "subject":
        result = compareString(left.subject, right.subject);
        break;
      case "createdBy":
        result = compareString(left.createdBy, right.createdBy);
        break;
      case "priority":
        result = compareString(left.priority, right.priority);
        break;
      case "createdAt":
        result = compareString(left.createdAt, right.createdAt);
        break;
      case "editedAt":
        result = compareNullableString(left.editedAt, right.editedAt);
        break;
      case "readCount":
        result = compareNumber(left.readCount, right.readCount);
        break;
      case "unreadCount":
        result = compareNumber(left.unreadCount, right.unreadCount);
        break;
      default:
        result = 0;
    }
    return applyDirection(result, direction);
  });
}

export function sortEditedEntryRows(
  rows: PassOnEditedEntryRow[],
  column: EditedEntrySortColumn,
  direction: PassOnReportSortDirection
): PassOnEditedEntryRow[] {
  return [...rows].sort((left, right) => {
    let result = 0;
    switch (column) {
      case "subject":
        result = compareString(left.subject, right.subject);
        break;
      case "shift":
        result =
          PASS_ON_SHIFT_SORT_ORDER[left.shift] - PASS_ON_SHIFT_SORT_ORDER[right.shift];
        break;
      case "priority":
        result = compareString(left.priority, right.priority);
        break;
      case "createdBy":
        result = compareString(left.createdBy, right.createdBy);
        break;
      case "createdAt":
        result = compareString(left.createdAt, right.createdAt);
        break;
      case "editedAt":
        result = compareString(left.editedAt, right.editedAt);
        break;
      case "preview":
        result = compareString(left.preview, right.preview);
        break;
      default:
        result = 0;
    }
    return applyDirection(result, direction);
  });
}

export function sortKeywordSearchRows(
  rows: PassOnKeywordSearchRow[],
  column: KeywordSearchSortColumn,
  direction: PassOnReportSortDirection
): PassOnKeywordSearchRow[] {
  return [...rows].sort((left, right) => {
    let result = 0;
    switch (column) {
      case "subject":
        result = compareString(left.subject, right.subject);
        break;
      case "shift":
        result =
          PASS_ON_SHIFT_SORT_ORDER[left.shift] - PASS_ON_SHIFT_SORT_ORDER[right.shift];
        break;
      case "priority":
        result = compareString(left.priority, right.priority);
        break;
      case "createdBy":
        result = compareString(left.createdBy, right.createdBy);
        break;
      case "createdAt":
        result = compareString(left.createdAt, right.createdAt);
        break;
      case "editedAt":
        result = compareNullableString(left.editedAt, right.editedAt);
        break;
      default:
        result = 0;
    }
    return applyDirection(result, direction);
  });
}

export function sortUnreadUserRows(
  rows: PassOnUnreadByUserRow[],
  column: UnreadUserSortColumn,
  direction: PassOnReportSortDirection
): PassOnUnreadByUserRow[] {
  return [...rows].sort((left, right) => {
    let result = 0;
    switch (column) {
      case "userName":
        result = compareString(left.userName, right.userName);
        break;
      case "department":
        result = compareString(left.department, right.department);
        break;
      case "totalAvailable":
        result = compareNumber(left.totalAvailable, right.totalAvailable);
        break;
      case "entriesRead":
        result = compareNumber(left.entriesRead, right.entriesRead);
        break;
      case "entriesUnread":
        result = compareNumber(left.entriesUnread, right.entriesUnread);
        break;
      case "readPercent":
        result = compareNumber(left.readPercent, right.readPercent);
        break;
      case "lastEntryReadAt":
        result = compareNullableString(left.lastEntryReadAt, right.lastEntryReadAt);
        break;
      default:
        result = 0;
    }
    return applyDirection(result, direction);
  });
}

export function sortUnreadDetailRows(
  rows: PassOnUnreadDetailRow[],
  column: UnreadDetailSortColumn,
  direction: PassOnReportSortDirection
): PassOnUnreadDetailRow[] {
  return [...rows].sort((left, right) => {
    let result = 0;
    switch (column) {
      case "subject":
        result = compareString(left.subject, right.subject);
        break;
      case "shift":
        result =
          PASS_ON_SHIFT_SORT_ORDER[left.shift] - PASS_ON_SHIFT_SORT_ORDER[right.shift];
        break;
      case "priority":
        result = compareString(left.priority, right.priority);
        break;
      case "createdBy":
        result = compareString(left.createdBy, right.createdBy);
        break;
      case "createdAt":
        result = compareString(left.createdAt, right.createdAt);
        break;
      case "ageMs":
        result = compareNumber(left.ageMs, right.ageMs);
        break;
      default:
        result = 0;
    }
    return applyDirection(result, direction);
  });
}
