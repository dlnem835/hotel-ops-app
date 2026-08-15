import type { SupabaseClient } from "@supabase/supabase-js";
import type { ReportPdfTable } from "@/app/reports/lib/extract-report-print-content";
import { fetchInspectionReportSource } from "@/app/reports/lib/inspection-report-data";
import {
  buildAssociateRankingRows,
  buildAverageTimeGroups,
  buildFailedItemGroups,
  buildFailedSectionGroups,
  buildInspectorRoomShareRows,
  buildRoomsDoneRows,
  buildRoomsNotDoneRows,
  buildScoresByRoomGroups,
} from "@/app/reports/lib/inspection-report-filters";
import type { InspectionReportFilters } from "@/app/reports/lib/inspection-report-types";
import {
  buildLostFoundFoundByRows,
  fetchLostFoundReportSource,
} from "@/app/reports/lib/lost-found-report-data";
import {
  filterLostFoundAgingReportRows,
  filterLostFoundAllItemsReportRows,
  filterLostFoundFoundByReportRows,
  filterLostFoundShippingReportRows,
} from "@/app/reports/lib/lost-found-report-filters";
import type {
  LostFoundFoundByReportFilters,
  LostFoundReportFilters,
} from "@/app/reports/lib/report-definitions";
import { fetchPassOnReportSource } from "@/app/reports/lib/pass-on-report-data";
import {
  buildEditedEntryRows,
  buildEntriesByAssociateGroups,
  buildEntriesByShiftGroups,
  buildKeywordSearchRows,
  buildUnreadByUserRows,
} from "@/app/reports/lib/pass-on-report-filters";
import type { PassOnReportFilters, PassOnUnreadReportFilters } from "@/app/reports/lib/report-definitions";
import { getReportDateRangeForPreset } from "@/app/reports/lib/report-date-presets";
import { fetchPmReportSource } from "@/app/reports/lib/pm-report-data";
import {
  buildCompletedPmReportRows,
  buildFailedPmItemReportRows,
  buildMissedPmReportRows,
  buildPmCompletionOverviewReport,
} from "@/app/reports/lib/pm-report-filters";
import type { PmReportFilters } from "@/app/reports/lib/report-definitions";
import {
  formatReportDateRangeLabel,
  formatReportGeneratedAt,
} from "@/app/reports/lib/report-output-utils";
import type { ReportScheduleContext } from "@/app/reports/lib/report-schedule-types";
import {
  buildEmptyReportPdfTables,
  buildInspectionFailedItemPdfTables,
  buildInspectionFailedSectionPdfTables,
  countReportPdfRows,
} from "@/app/reports/lib/report-pdf-table-builders";
import { fetchWorkOrderReportSource } from "@/app/reports/lib/work-order-report-data";
import {
  buildWorkOrdersByAreaRows,
  buildWorkOrdersByCategoryRows,
  buildWorkOrdersByItemIssueRows,
  buildWorkOrdersBySourceRows,
  calculateAverageCompletionTimeHours,
  filterWorkOrdersForAverageCompletionTimeReport,
  filterWorkOrdersForReport,
  filterWorkOrdersForResolutionReport,
  formatAverageCompletionTime,
} from "@/app/reports/lib/work-order-report-filters";
import type { WorkOrderReportFilters } from "@/app/reports/lib/report-definitions";

export type ScheduledReportPayload = {
  reportName: string;
  propertyName: string;
  dateRangeLabel: string;
  filterLines: string[];
  generatedAtLabel: string;
  tables: ReportPdfTable[];
};

function table(headers: string[], rows: string[][], title?: string): ReportPdfTable {
  return { headers, rows, title };
}

function snapshotString(snapshot: Record<string, unknown>, key: string, fallback = "All"): string {
  const value = snapshot[key];
  if (value === null || value === undefined || value === "") return fallback;
  return String(value);
}

export function resolveScheduledReportDateRange(
  context: ReportScheduleContext,
  runAt = new Date()
): { dateStart: string; dateEnd: string; dateRangeLabel: string } {
  if (context.datePreset === "custom") {
    return {
      dateStart: context.dateStart,
      dateEnd: context.dateEnd,
      dateRangeLabel: formatReportDateRangeLabel(
        context.datePreset,
        context.dateStart,
        context.dateEnd
      ),
    };
  }

  const range = getReportDateRangeForPreset(context.datePreset, runAt);
  return {
    ...range,
    dateRangeLabel: formatReportDateRangeLabel(
      context.datePreset,
      range.dateStart,
      range.dateEnd
    ),
  };
}

function finalizeReportPdfTables(tables: ReportPdfTable[]): ReportPdfTable[] {
  return countReportPdfRows(tables) > 0 ? tables : buildEmptyReportPdfTables();
}

function normalizeScheduledReportId(context: ReportScheduleContext): string {
  if (context.reportModule !== "inspection") {
    return context.reportId;
  }

  const aliases: Record<string, string> = {
    "failed-items": "top-failed-items",
    "failed-sections": "top-failed-sections",
    "rooms-completed": "rooms-done",
    "rooms-not-completed": "rooms-not-done",
  };

  return aliases[context.reportId] ?? context.reportId;
}

export async function generateScheduledReportPayload(
  context: ReportScheduleContext,
  runAt = new Date(),
  supabase?: SupabaseClient
): Promise<ScheduledReportPayload> {
  const dateRange = resolveScheduledReportDateRange(context, runAt);
  const tables = await buildScheduledReportTables(context, dateRange, runAt, supabase);

  return {
    reportName: context.reportName,
    propertyName: context.propertyName,
    dateRangeLabel: dateRange.dateRangeLabel,
    filterLines: context.filterLines,
    generatedAtLabel: formatReportGeneratedAt(runAt),
    tables,
  };
}

async function buildScheduledReportTables(
  context: ReportScheduleContext,
  dateRange: { dateStart: string; dateEnd: string },
  runAt: Date,
  supabase?: SupabaseClient
): Promise<ReportPdfTable[]> {
  switch (context.reportModule) {
    case "pm":
      return buildPmTables(context, dateRange, supabase);
    case "wo":
      return buildWorkOrderTables(context, dateRange, supabase);
    case "inspection":
      return buildInspectionTables(context, dateRange, supabase);
    case "lnf":
      return buildLostFoundTables(context, dateRange, supabase);
    case "pass-on":
      return buildPassOnTables(context, dateRange, runAt, supabase);
    default:
      return buildEmptyReportPdfTables();
  }
}

function buildPmTables(
  context: ReportScheduleContext,
  dateRange: { dateStart: string; dateEnd: string },
  supabase?: SupabaseClient
): Promise<ReportPdfTable[]> {
  const snapshot = context.filterSnapshot as Record<string, unknown>;
  const filters: PmReportFilters = {
    propertyName: context.propertyName,
    pmType: snapshotString(snapshot, "pmType"),
    completedBy: snapshotString(snapshot, "completedBy"),
    dateStart: dateRange.dateStart,
    dateEnd: dateRange.dateEnd,
  };

  return fetchPmReportSource(supabase).then((source) => {
    switch (context.reportId) {
      case "completed-pms": {
        const rows = buildCompletedPmReportRows(source, filters);
        return finalizeReportPdfTables([
          table(
            ["PM Name", "Area", "Type", "Due", "Completed", "Completed By", "Status"],
            rows.map((row) => [
              row.pmName,
              row.areaLabel,
              row.pmType,
              row.dueDate,
              row.completedAt,
              row.completedBy,
              row.completionStatusLabel,
            ])
          ),
        ]);
      }
      case "missed-pms": {
        const rows = buildMissedPmReportRows(source, filters);
        return finalizeReportPdfTables([
          table(
            ["PM Name", "Area", "Type", "Due", "Days Missed", "Status"],
            rows.map((row) => [
              row.pmName,
              row.areaLabel,
              row.pmType,
              row.dueDate,
              String(row.daysMissed),
              row.statusLabel,
            ])
          ),
        ]);
      }
      case "failed-pm-items": {
        const rows = buildFailedPmItemReportRows(source, filters);
        return finalizeReportPdfTables([
          table(
            ["PM Name", "Item", "Area", "Completed By", "Completed", "Notes"],
            rows.map((row) => [
              row.sourcePmName,
              row.itemLabel,
              row.areaLabel,
              row.completedBy,
              row.completedAt,
              row.notes,
            ])
          ),
        ]);
      }
      case "pm-report": {
        const overview = buildPmCompletionOverviewReport(source, filters);
        const rows = overview.groups.flatMap((group) =>
          group.items.map((item) => [
            item.pmName,
            item.areaLabel,
            item.frequency,
            String(item.expectedCycles),
            String(item.completedCount),
            String(item.missedCount),
            `${item.completionPercent}%`,
          ])
        );
        return finalizeReportPdfTables([
          table(
            ["PM Name", "Area", "Frequency", "Expected", "Completed", "Missed", "Completion %"],
            rows,
            "PM Completions Overview"
          ),
        ]);
      }
      default:
        return buildEmptyReportPdfTables();
    }
  });
}

function buildWorkOrderTables(
  context: ReportScheduleContext,
  dateRange: { dateStart: string; dateEnd: string },
  supabase?: SupabaseClient
): Promise<ReportPdfTable[]> {
  const snapshot = context.filterSnapshot as Record<string, unknown>;
  const filters: WorkOrderReportFilters = {
    propertyName: context.propertyName,
    search: snapshotString(snapshot, "search"),
    status: snapshotString(snapshot, "status") as WorkOrderReportFilters["status"],
    source: snapshotString(snapshot, "source") as WorkOrderReportFilters["source"],
    category: snapshotString(snapshot, "category"),
    itemIssue: snapshotString(snapshot, "itemIssue") || "All",
    areaId: snapshot.areaId != null ? Number(snapshot.areaId) : null,
    areaLabel: snapshotString(snapshot, "areaLabel"),
    completedBy: snapshotString(snapshot, "completedBy") || "All",
    dateStart: dateRange.dateStart,
    dateEnd: dateRange.dateEnd,
  };

  return fetchWorkOrderReportSource(supabase).then((rows) => {
    switch (context.reportId) {
      case "all-work-orders": {
        const filtered = filterWorkOrdersForReport(rows, filters);
        return finalizeReportPdfTables([
          table(
            ["Title", "Area", "Item / Issue", "Status", "Created By", "Created", "Source"],
            filtered.map((row) => [
              row.title,
              row.area,
              row.itemIssue,
              row.status,
              row.createdBy,
              row.createdAt,
              row.source,
            ])
          ),
        ]);
      }
      case "resolution-report": {
        const completed = filterWorkOrdersForResolutionReport(rows, filters);
        return finalizeReportPdfTables([
          table(
            [
              "Work Order",
              "Issue",
              "Location",
              "Item / Issue",
              "Priority",
              "Created",
              "Created By",
              "Assigned To",
              "Completed",
              "Resolution",
              "Completed By",
              "Hours",
            ],
            completed.map((row) => [
              `#${row.id}`,
              row.description ?? row.title,
              row.area,
              row.itemIssue,
              row.priority,
              row.createdAt,
              row.createdBy,
              row.assignedTo ?? "—",
              row.completedAt ?? "—",
              row.resolution,
              row.completedBy ?? "—",
              row.hoursOpen == null ? "—" : String(row.hoursOpen),
            ])
          ),
        ]);
      }
      case "work-order-completion-time": {
        const completedRows = filterWorkOrdersForAverageCompletionTimeReport(rows, filters);
        const completed = completedRows.filter((row) => row.completedAt);
        const avgHours = calculateAverageCompletionTimeHours(completed);
        return finalizeReportPdfTables([
          table(
            ["Metric", "Value"],
            [
              ["Completed work orders", String(completed.length)],
              ["Average completion time", formatAverageCompletionTime(avgHours)],
            ],
            "Average Completion Time"
          ),
        ]);
      }
      case "work-orders-by-category": {
        const categoryRows = buildWorkOrdersByCategoryRows(
          filterWorkOrdersForReport(rows, filters)
        );
        return finalizeReportPdfTables([
          table(
            ["Category", "Count"],
            categoryRows.map((row) => [row.label, String(row.count)])
          ),
        ]);
      }
      case "work-orders-by-item-issue": {
        const itemRows = buildWorkOrdersByItemIssueRows(
          filterWorkOrdersForReport(rows, filters)
        );
        return finalizeReportPdfTables([
          table(
            ["Item / Issue", "Count"],
            itemRows.map((row) => [row.label, String(row.count)])
          ),
        ]);
      }
      case "work-orders-by-area": {
        const areaRows = buildWorkOrdersByAreaRows(filterWorkOrdersForReport(rows, filters));
        return finalizeReportPdfTables([
          table(["Area", "Count"], areaRows.map((row) => [row.label, String(row.count)])),
        ]);
      }
      case "work-orders-by-source": {
        const sourceRows = buildWorkOrdersBySourceRows(filterWorkOrdersForReport(rows, filters));
        return finalizeReportPdfTables([
          table(
            ["Source", "Total", "Open", "Completed", "Avg Completion", "Avg Days Open"],
            sourceRows.map((row) => [
              row.source,
              String(row.total),
              String(row.open),
              String(row.completed),
              row.avgCompletionTime,
              String(row.avgDaysOpen),
            ])
          ),
        ]);
      }
      default:
        return buildEmptyReportPdfTables();
    }
  });
}

function buildInspectionTables(
  context: ReportScheduleContext,
  dateRange: { dateStart: string; dateEnd: string },
  supabase?: SupabaseClient
): Promise<ReportPdfTable[]> {
  const variant = context.inspectionVariant === "rpm" ? "rpm" : "room";
  const snapshot = context.filterSnapshot as Record<string, unknown>;
  const reportId = normalizeScheduledReportId(context);
  const filters: InspectionReportFilters = {
    propertyName: context.propertyName,
    type: snapshotString(snapshot, "type"),
    associate: snapshotString(snapshot, "associate"),
    inspector: snapshotString(snapshot, "inspector"),
    dateStart: dateRange.dateStart,
    dateEnd: dateRange.dateEnd,
  };

  return fetchInspectionReportSource(variant, supabase).then((source) => {
    switch (reportId) {
      case "associate-ranking": {
        const rows = buildAssociateRankingRows(source, filters);
        return finalizeReportPdfTables([
          table(
            ["Associate", "Completed", "Avg Score", "Failed Items"],
            rows.map((row) => [
              row.associateName,
              String(row.completedCount),
              row.averageScore == null ? "—" : `${row.averageScore}%`,
              String(row.failedItemCount),
            ])
          ),
        ]);
      }
      case "average-time": {
        const { groups } = buildAverageTimeGroups(source, filters);
        return finalizeReportPdfTables([
          table(
            ["Inspector", "Sessions", "Average Time"],
            groups.map((group) => [
              group.inspectorName || "—",
              String(group.completedCount),
              group.averageTimeLabel || "—",
            ])
          ),
        ]);
      }
      case "rooms-done":
      case "rooms-completed": {
        const rows = buildRoomsDoneRows(source, filters);
        return finalizeReportPdfTables([
          table(
            ["Room", "Completed", "Inspector", "Score", "Type"],
            rows.map((row) => [
              row.roomNumber,
              row.completedAt,
              row.inspectorName ?? "—",
              row.scorePercent == null ? "—" : `${row.scorePercent}%`,
              row.inspectionType ?? "—",
            ])
          ),
        ]);
      }
      case "rooms-not-done":
      case "rooms-not-completed": {
        const rows = buildRoomsNotDoneRows(source, filters);
        return finalizeReportPdfTables([
          table(
            ["Room", "Last Date", "Last Inspector", "Days Since", "Status"],
            rows.map((row) => [
              row.roomNumber,
              row.lastDate ?? "—",
              row.lastInspectorName ?? "—",
              row.daysSinceLast == null ? "—" : String(row.daysSinceLast),
              row.statusLabel,
            ])
          ),
        ]);
      }
      case "top-failed-sections": {
        return buildInspectionFailedSectionPdfTables(buildFailedSectionGroups(source, filters));
      }
      case "top-failed-items": {
        return buildInspectionFailedItemPdfTables(buildFailedItemGroups(source, filters));
      }
      case "rooms-by-inspector": {
        const { rows, totalCompleted } = buildInspectorRoomShareRows(source, filters);
        return finalizeReportPdfTables([
          table(
            ["Inspector", "Rooms", "% of Total"],
            rows.map((row) => [
              row.inspectorName,
              String(row.roomCount),
              totalCompleted > 0 ? `${row.percent}%` : "—",
            ])
          ),
        ]);
      }
      case "scores-by-room": {
        const groups = buildScoresByRoomGroups(source, filters);
        const rows = groups.flatMap((group) =>
          group.sessions.map((session) => [
            group.roomNumber,
            session.completedAt,
            session.inspectorName ?? "—",
            session.scorePercent == null ? "—" : `${session.scorePercent}%`,
          ])
        );
        return finalizeReportPdfTables([
          table(["Room", "Completed", "Inspector", "Score"], rows),
        ]);
      }
      default:
        return buildEmptyReportPdfTables();
    }
  });
}

function buildLostFoundTables(
  context: ReportScheduleContext,
  dateRange: { dateStart: string; dateEnd: string },
  supabase?: SupabaseClient
): Promise<ReportPdfTable[]> {
  const snapshot = context.filterSnapshot as Record<string, unknown>;

  return fetchLostFoundReportSource(supabase).then((source) => {
    if (context.reportId === "found-by") {
      const filters: LostFoundFoundByReportFilters = {
        propertyName: context.propertyName,
        foundBy: snapshotString(snapshot, "foundBy"),
        department: snapshotString(snapshot, "department") as LostFoundFoundByReportFilters["department"],
        dateStart: dateRange.dateStart,
        dateEnd: dateRange.dateEnd,
      };
      const foundByRows = buildLostFoundFoundByRows(source.items, source.teamMembers);
      const rows = filterLostFoundFoundByReportRows(foundByRows, filters);
      return finalizeReportPdfTables([
        table(
          ["Associate", "Department", "Items Found", "Last Item Found"],
          rows.map((row) => [
            row.associateName,
            row.department,
            String(row.itemsFound),
            row.lastItemFoundDate,
          ])
        ),
      ]);
    }

    const filters: LostFoundReportFilters = {
      propertyName: context.propertyName,
      status: snapshotString(snapshot, "status") as LostFoundReportFilters["status"],
      foundBy: snapshotString(snapshot, "foundBy"),
      createdBy: snapshotString(snapshot, "createdBy"),
      dateStart: dateRange.dateStart,
      dateEnd: dateRange.dateEnd,
    };

    if (context.reportId === "ready-to-discard") {
      const rows = filterLostFoundAgingReportRows(source.items, filters);
      return finalizeReportPdfTables([
        table(
          ["Item", "Room", "Status", "Found By", "Created"],
          rows.map((row) => [
            row.itemName,
            row.roomNumber,
            row.status,
            row.foundBy,
            row.createdAt,
          ])
        ),
      ]);
    }

    if (context.reportId === "shipped-items") {
      const rows = filterLostFoundShippingReportRows(source.items, filters);
      return finalizeReportPdfTables([
        table(
          ["Item", "Room", "Guest", "Status", "Label Sent"],
          rows.map((row) => [
            row.itemName,
            row.roomNumber,
            row.guestLastName,
            row.status,
            row.labelSentAt ?? "—",
          ])
        ),
      ]);
    }

    const rows = filterLostFoundAllItemsReportRows(source.items, filters);
    return finalizeReportPdfTables([
      table(
        ["Item", "Room", "Status", "Found By", "Created By", "Created"],
        rows.map((row) => [
          row.itemName,
          row.roomNumber,
          row.status,
          row.foundBy,
          row.createdBy,
          row.createdAt,
        ])
      ),
    ]);
  });
}

function buildPassOnTables(
  context: ReportScheduleContext,
  dateRange: { dateStart: string; dateEnd: string },
  runAt: Date,
  supabase?: SupabaseClient
): Promise<ReportPdfTable[]> {
  const snapshot = context.filterSnapshot as Record<string, unknown>;
  const reportVariant = snapshotString(snapshot, "reportVariant", context.reportId);

  return fetchPassOnReportSource(supabase).then((source) => {
    if (reportVariant === "unread-entries-by-user") {
      const filters: PassOnUnreadReportFilters = {
        propertyName: context.propertyName,
        department: snapshotString(snapshot, "department"),
        user: snapshotString(snapshot, "user"),
        shift: snapshotString(snapshot, "shift") as PassOnUnreadReportFilters["shift"],
        dateStart: dateRange.dateStart,
        dateEnd: dateRange.dateEnd,
      };
      const rows = buildUnreadByUserRows(source, filters);
      return finalizeReportPdfTables([
        table(
          ["User", "Department", "Available", "Read", "Unread", "Read %", "Last Read"],
          rows.map((row) => [
            row.userName,
            row.department,
            String(row.totalAvailable),
            String(row.entriesRead),
            String(row.entriesUnread),
            `${row.readPercent}%`,
            row.lastEntryReadAtDisplay,
          ])
        ),
      ]);
    }

    const filters: PassOnReportFilters = {
      propertyName: context.propertyName,
      associate: snapshotString(snapshot, "associate"),
      shift: snapshotString(snapshot, "shift") as PassOnReportFilters["shift"],
      priority: snapshotString(snapshot, "priority") as PassOnReportFilters["priority"],
      keyword: snapshotString(snapshot, "keyword", ""),
      editedBy: snapshotString(snapshot, "editedBy"),
      dateStart: dateRange.dateStart,
      dateEnd: dateRange.dateEnd,
    };

    if (context.reportId === "entries-by-associate") {
      const groups = buildEntriesByAssociateGroups(source, filters);
      const rows = groups.flatMap((group) =>
        group.entries.map((entry) => [
          group.associateName,
          entry.subject,
          entry.shift,
          entry.priority,
          entry.createdAtDisplay,
          String(entry.readCount),
        ])
      );
      return finalizeReportPdfTables([
        table(
          ["Associate", "Subject", "Shift", "Priority", "Created", "Read Count"],
          rows
        ),
      ]);
    }

    if (context.reportId === "entries-by-shift") {
      const groups = buildEntriesByShiftGroups(source, filters);
      const rows = groups.flatMap((group) =>
        group.entries.map((entry) => [
          group.shiftName,
          entry.subject,
          entry.createdBy,
          entry.priority,
          entry.createdAtDisplay,
        ])
      );
      return finalizeReportPdfTables([
        table(["Shift", "Subject", "Created By", "Priority", "Created"], rows),
      ]);
    }

    if (context.reportId === "edited-entries") {
      const rows = buildEditedEntryRows(source, filters);
      return finalizeReportPdfTables([
        table(
          ["Subject", "Shift", "Priority", "Created By", "Created", "Edited", "Preview"],
          rows.map((row) => [
            row.subject,
            row.shift,
            row.priority,
            row.createdBy,
            row.createdAtDisplay,
            row.editedAtDisplay,
            row.preview,
          ])
        ),
      ]);
    }

    if (context.reportId === "keyword-search") {
      const keyword = filters.keyword.trim();
      if (!keyword) {
        return [table(["Message"], [["Enter a keyword or phrase to search Pass-On entries."]])];
      }
      const rows = buildKeywordSearchRows(source, filters);
      return finalizeReportPdfTables([
        table(
          ["Subject", "Shift", "Priority", "Created By", "Created", "Snippet"],
          rows.map((row) => [
            row.subject,
            row.shift,
            row.priority,
            row.createdBy,
            row.createdAtDisplay,
            `${row.snippet.before}${row.snippet.match}${row.snippet.after}`,
          ])
        ),
      ]);
    }

    void runAt;
    return buildEmptyReportPdfTables();
  });
}
