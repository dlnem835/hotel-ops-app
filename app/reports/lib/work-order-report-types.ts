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

export type WorkOrderReportRow = {
  id: string;
  title: string;
  area: string;
  category: string;
  priority: string;
  status: string;
  /** Person who created the work order (display name). */
  createdBy: WorkOrderReportCreatedByLabel;
  createdAt: string;
  /** ISO date (YYYY-MM-DD) for report date-range filtering. */
  createdAtIso: string;
  /** Origin workflow — not the creator's department. */
  source: WorkOrderReportSource;
  completedBy: string | null;
  completedAt: string | null;
  /** ISO date (YYYY-MM-DD) for report date-range filtering. */
  completedAtIso: string | null;
  comments: string;
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

export function isForbiddenWorkOrderReportCreatedByLabel(
  value: string | null | undefined
): boolean {
  const trimmed = (value || "").trim();
  if (!trimmed) return true;

  return WORK_ORDER_REPORT_FORBIDDEN_CREATED_BY_LABELS.some(
    (forbidden) => forbidden.toLowerCase() === trimmed.toLowerCase()
  );
}
