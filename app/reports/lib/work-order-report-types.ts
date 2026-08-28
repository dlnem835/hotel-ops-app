import { WORK_ORDER_SOURCE_FILTER_OPTIONS } from "@/app/reports/lib/report-definitions";

/** Where a work order originated — separate from who created it. */
export type WorkOrderReportSource = Exclude<
  (typeof WORK_ORDER_SOURCE_FILTER_OPTIONS)[number],
  "All"
>;

/**
 * Display name for the person who created the work order.
 * Must always be a user/associate name — never a department or workflow label.
 */
export type WorkOrderReportCreatedByLabel = string;

/** Department or module labels that must never appear in Created By. */
export const WORK_ORDER_REPORT_FORBIDDEN_CREATED_BY_LABELS = [
  "Front Desk",
  "Maintenance",
  "Housekeeping",
  "Management",
  "Inspection",
  "Pass-On",
  "PM Checklist",
] as const;

export type WorkOrderReportGroupRow = {
  label: string;
  count: number;
};

export type WorkOrderReportBySourceRow = {
  source: WorkOrderReportSource;
  total: number;
  open: number;
  completed: number;
  avgCompletionTime: string;
  avgDaysOpen: number;
};

export type WorkOrderReportRow = {
  id: string;
  title: string;
  description: string | null;
  area: string;
  areaId: number | null;
  category: string;
  itemIssue: string;
  priority: string;
  status: string;
  /** Person who created the work order (display name). */
  createdBy: WorkOrderReportCreatedByLabel;
  createdAt: string;
  /** ISO date (YYYY-MM-DD) for report date-range filtering. */
  createdAtIso: string;
  /** Origin workflow — not the creator's department. */
  source: WorkOrderReportSource;
  /** Work Orders do not currently have an assignment field; retained for report compatibility. */
  assignedTo: string | null;
  completedBy: string | null;
  completedAt: string | null;
  /** ISO date (YYYY-MM-DD) for report date-range filtering. */
  completedAtIso: string | null;
  comments: string;
  /** Same persisted work_orders.comments value required by Mark Completed. */
  resolution: string;
  daysOpen: number | null;
  hoursOpen: number | null;
};

/**
 * Resolves Created By for Work Order reports.
 * Prefers an explicit display label; falls back to stored user value when it is a person name.
 */
export function resolveWorkOrderReportCreatedByLabel(input: {
  createdByUserId?: string | null;
  createdByDisplayName?: string | null;
  createdByStoredValue?: string | null;
}): string {
  const candidates = [
    input.createdByDisplayName,
    input.createdByStoredValue,
  ].filter((value): value is string => Boolean(value?.trim()));

  for (const candidate of candidates) {
    const trimmed = candidate.trim();
    if (!isForbiddenWorkOrderReportCreatedByLabel(trimmed)) {
      return trimmed;
    }
  }

  return "—";
}

/** Maps work_orders.source_module to report Source filter labels. */
export function mapWorkOrderSourceModule(
  sourceModule: string | null | undefined
): WorkOrderReportSource {
  const value = (sourceModule || "").trim();

  if (!value || value === "Maintenance") return "Manual";
  if (value === "Pass-On Log" || value === "Pass-On") return "Pass-On Log";
  if (value === "Inspections" || value === "Room Inspection") return "Room Inspection";
  if (value === "RPM" || value === "RPM Inspection") return "RPM Inspection";
  if (
    value === "Preventive Maintenance" ||
    value === "PM" ||
    value === "Preventative Maintenance"
  ) {
    return "Preventive Maintenance";
  }
  if (value === "Lost & Found" || value === "Lost and Found") return "Lost & Found";

  // Future: add explicit source_module values as they are introduced in workflows.
  return "Other";
}

export function matchesWorkOrderReportSourceFilter(
  source: WorkOrderReportSource,
  filterSource: WorkOrderReportSource | "All"
): boolean {
  if (filterSource === "All") return true;
  // Backward compatibility for saved report schedules created before the
  // source label was clarified.
  if (String(filterSource) === "RPM") return source === "RPM Inspection";
  return source === filterSource;
}

export function isForbiddenWorkOrderReportCreatedByLabel(
  value: string | null | undefined
): boolean {
  const trimmed = (value || "").trim();
  if (!trimmed) return true;

  return WORK_ORDER_REPORT_FORBIDDEN_CREATED_BY_LABELS.some(
    (forbidden) => forbidden.toLowerCase() === trimmed.toLowerCase()
  );
}
