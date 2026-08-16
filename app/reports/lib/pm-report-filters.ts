import { enumerateDueDatesInRange, parseDate } from "@/app/maintenance/lib/schedule-engine";
import type { PmFrequency } from "@/app/maintenance/lib/pm-types";
import { PM_FREQUENCY_LABELS, PM_FREQUENCY_ORDER } from "@/app/maintenance/lib/pm-types";
import type { PmReportFilters } from "@/app/reports/lib/report-definitions";
import {
  addGracePeriodDays,
  calculateDaysMissedAfterGrace,
  classifyPmReportCompletionTiming,
  formatPmReportCompletionStatusLabel,
  isPmMissedAfterGracePeriod,
  type PmOccurrenceLookupStatus,
} from "@/app/reports/lib/pm-report-grace";
import {
  getReportDateRangeBounds,
  isActivePmSchedule,
  matchesPmCompletedByFilter,
  matchesPmDateRange,
  matchesPmTypeFilter,
} from "@/app/reports/lib/pm-report-filter-utils";
import {
  formatOverviewPeriodStatusTitle,
  resolveOverviewPeriodStatus,
} from "@/app/reports/lib/pm-report-overview-timing";
import type {
  PmReportCompletedRow,
  PmReportFailedItemRow,
  PmReportMissedRow,
  PmReportOverviewGroup,
  PmReportOverviewItem,
  PmReportOverviewPeriod,
  PmReportOverviewSummary,
  PmReportSource,
  PmReportSourceOccurrence,
} from "@/app/reports/lib/pm-report-types";

const MONTH_LABELS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
] as const;

const OVERVIEW_FREQUENCY_ORDER: PmFrequency[] = [
  "daily",
  "weekly",
  "monthly",
  "quarterly",
  "triannually",
  "semiannually",
  "yearly",
];

function formatDisplayDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const date = iso.length === 10 ? parseDate(iso) : new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    ...(iso.length > 10 ? { hour: "numeric", minute: "2-digit" } : {}),
  });
}

function toDateOnly(value: string | null | undefined): string {
  if (!value) return "";
  return value.slice(0, 10);
}

function occurrenceKey(assignmentId: number, dueDate: string): string {
  return `${assignmentId}::${dueDate}`;
}

function buildOccurrenceMaps(source: PmReportSource) {
  const byKey = new Map<string, PmReportSourceOccurrence>();
  for (const occurrence of source.occurrences) {
    byKey.set(occurrenceKey(occurrence.assignmentId, occurrence.dueDate), occurrence);
  }
  return byKey;
}

function getScheduleByAssignmentId(source: PmReportSource) {
  return new Map(source.schedules.map((schedule) => [schedule.assignmentId, schedule]));
}

function getReportCycleLabel(
  frequency: PmFrequency,
  dueDateIso: string,
  indexWithinRange: number
): string {
  const dueDate = parseDate(dueDateIso);

  switch (frequency) {
    case "monthly":
    case "bimonthly":
      return MONTH_LABELS[dueDate.getMonth()];
    case "quarterly":
      return `Q${Math.floor(dueDate.getMonth() / 3) + 1}`;
    case "triannually":
      return `P${(indexWithinRange % 3) + 1}`;
    case "semiannually":
      return dueDate.getMonth() < 6 ? "H1" : "H2";
    case "yearly":
      return "Y1";
    case "weekly":
    case "biweekly":
      return `W${indexWithinRange + 1}`;
    case "daily":
      return dueDate.toLocaleDateString(undefined, { month: "short", day: "numeric" });
    default:
      return dueDate.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  }
}

function getOccurrenceLookupStatus(
  occurrence: PmReportSourceOccurrence | undefined
): PmOccurrenceLookupStatus {
  if (!occurrence) return "none";
  return occurrence.status;
}

function enumerateScheduleDueDatesInFilterRange(
  schedule: PmReportSource["schedules"][number],
  filters: PmReportFilters
): string[] {
  const { start, end } = getReportDateRangeBounds(filters);
  return enumerateDueDatesInRange(
    schedule.startDate,
    schedule.frequency,
    schedule.endDate,
    start,
    end
  );
}

export function buildCompletedPmReportRows(
  source: PmReportSource,
  filters: PmReportFilters
): PmReportCompletedRow[] {
  const scheduleByAssignment = getScheduleByAssignmentId(source);
  const rows: PmReportCompletedRow[] = [];

  for (const occurrence of source.occurrences) {
    if (occurrence.status !== "completed") continue;

    const schedule = scheduleByAssignment.get(occurrence.assignmentId);
    if (!schedule || !isActivePmSchedule(schedule)) continue;
    if (!matchesPmTypeFilter(schedule.frequency, filters.pmType)) continue;

    const completedAtIso = toDateOnly(occurrence.completedAt);
    if (!matchesPmDateRange(completedAtIso, filters)) continue;

    const completedBy = source.resolveCompletedBy(occurrence.completedBy);
    if (!matchesPmCompletedByFilter(completedBy, filters.completedBy)) continue;

    const timing = classifyPmReportCompletionTiming(occurrence.completedAt, occurrence.dueDate);
    if (!timing) continue;

    rows.push({
      occurrenceId: occurrence.id,
      pmName: schedule.templateName,
      pmType: PM_FREQUENCY_LABELS[schedule.frequency],
      pmTypeKey: schedule.frequency,
      areaLabel: schedule.areaLabel,
      frequency: PM_FREQUENCY_LABELS[schedule.frequency],
      dueDate: formatDisplayDate(occurrence.dueDate),
      dueDateIso: occurrence.dueDate,
      completedAt: formatDisplayDate(occurrence.completedAt),
      completedAtIso,
      completedAtSortIso: occurrence.completedAt || completedAtIso,
      completedBy: completedBy || "—",
      completionStatus: timing,
      completionStatusLabel: `${
        formatPmReportCompletionStatusLabel(timing)
      }${
        occurrence.responses?.targetOutcome === "issue_found" ||
        occurrence.responses?.targetOutcome === "fail"
          ? " · Fail"
          : ""
      }`,
      cycleLabel: getReportCycleLabel(schedule.frequency, occurrence.dueDate, 0),
    });
  }

  return rows;
}

export function buildMissedPmReportRows(
  source: PmReportSource,
  filters: PmReportFilters,
  now = new Date()
): PmReportMissedRow[] {
  const occurrenceByKey = buildOccurrenceMaps(source);
  const rows: PmReportMissedRow[] = [];
  const seen = new Set<string>();

  for (const schedule of source.schedules) {
    if (!isActivePmSchedule(schedule)) continue;
    if (!matchesPmTypeFilter(schedule.frequency, filters.pmType)) continue;

    const dueDates = enumerateScheduleDueDatesInFilterRange(schedule, filters);

    dueDates.forEach((dueDateIso, index) => {
      const key = occurrenceKey(schedule.assignmentId, dueDateIso);
      if (seen.has(key)) return;

      const occurrence = occurrenceByKey.get(key);
      const lookup = getOccurrenceLookupStatus(occurrence);

      if (!isPmMissedAfterGracePeriod(dueDateIso, lookup, now)) return;
      if (!matchesPmDateRange(dueDateIso, filters)) return;

      seen.add(key);
      const graceExpiresAtIso = addGracePeriodDays(dueDateIso);

      rows.push({
        occurrenceId: occurrence?.id ?? null,
        pmName: schedule.templateName,
        pmType: PM_FREQUENCY_LABELS[schedule.frequency],
        pmTypeKey: schedule.frequency,
        areaLabel: schedule.areaLabel,
        frequency: PM_FREQUENCY_LABELS[schedule.frequency],
        dueDate: formatDisplayDate(dueDateIso),
        dueDateIso,
        graceExpiresAt: formatDisplayDate(graceExpiresAtIso),
        graceExpiresAtIso,
        daysMissed: calculateDaysMissedAfterGrace(dueDateIso, now),
        cycleLabel: getReportCycleLabel(schedule.frequency, dueDateIso, index),
        statusLabel: occurrence?.status === "missed" ? "Missed" : "Missed",
      });
    });
  }

  return rows.sort((left, right) => right.dueDateIso.localeCompare(left.dueDateIso));
}

export function buildFailedPmItemReportRows(
  source: PmReportSource,
  filters: PmReportFilters
): PmReportFailedItemRow[] {
  const scheduleByAssignment = getScheduleByAssignmentId(source);
  const rows: PmReportFailedItemRow[] = [];

  for (const occurrence of source.occurrences) {
    if (occurrence.status !== "completed") continue;

    const schedule = scheduleByAssignment.get(occurrence.assignmentId);
    if (!schedule || !isActivePmSchedule(schedule)) continue;
    if (!matchesPmTypeFilter(schedule.frequency, filters.pmType)) continue;

    const completedAtIso = toDateOnly(occurrence.completedAt);
    if (!matchesPmDateRange(completedAtIso, filters)) continue;

    const stepLabels =
      source.stepLabelsByTemplateId.get(schedule.templateId) ?? new Map<string, string>();
    const failedSteps =
      occurrence.responses?.sharedChecklistPrimary === false
        ? []
        : (occurrence.responses?.steps ?? []).filter(
            (step) => step.outcome === "fail"
          );

    for (const step of failedSteps) {
      rows.push({
        id: `${occurrence.id}::${step.stepKey}`,
        occurrenceId: occurrence.id,
        itemLabel: stepLabels.get(step.stepKey) || step.stepKey,
        sourcePmName: schedule.templateName,
        pmType: PM_FREQUENCY_LABELS[schedule.frequency],
        pmTypeKey: schedule.frequency,
        areaLabel: schedule.areaLabel,
        frequency: PM_FREQUENCY_LABELS[schedule.frequency],
        completedBy: source.resolveCompletedBy(occurrence.completedBy) || "—",
        completedAt: formatDisplayDate(occurrence.completedAt),
        completedAtIso,
        completedAtSortIso: occurrence.completedAt || completedAtIso,
        notes: step.notes?.trim() || "—",
      });
    }

    const targetOutcome = occurrence.responses?.targetOutcome;
    if (targetOutcome === "fail" || targetOutcome === "issue_found") {
      rows.push({
        id: `${occurrence.id}::target`,
        occurrenceId: occurrence.id,
        itemLabel: schedule.areaLabel,
        sourcePmName: schedule.templateName,
        pmType: PM_FREQUENCY_LABELS[schedule.frequency],
        pmTypeKey: schedule.frequency,
        areaLabel: schedule.areaLabel,
        frequency: PM_FREQUENCY_LABELS[schedule.frequency],
        completedBy: source.resolveCompletedBy(occurrence.completedBy) || "—",
        completedAt: formatDisplayDate(occurrence.completedAt),
        completedAtIso,
        completedAtSortIso: occurrence.completedAt || completedAtIso,
        notes: occurrence.responses?.targetNotes?.trim() || "—",
      });
    }
  }

  return rows;
}

function buildOverviewItemForSchedule(
  source: PmReportSource,
  schedule: PmReportSource["schedules"][number],
  filters: PmReportFilters,
  occurrenceByKey: Map<string, PmReportSourceOccurrence>,
  now: Date
): PmReportOverviewItem | null {
  if (!isActivePmSchedule(schedule)) return null;
  if (!matchesPmTypeFilter(schedule.frequency, filters.pmType)) return null;

  const dueDates = enumerateScheduleDueDatesInFilterRange(schedule, filters);
  if (dueDates.length === 0) return null;

  const periods: PmReportOverviewPeriod[] = dueDates.map((dueDateIso, index) => {
    const occurrence = occurrenceByKey.get(occurrenceKey(schedule.assignmentId, dueDateIso));
    const status = resolveOverviewPeriodStatus(
      dueDateIso,
      schedule.frequency,
      occurrence,
      now
    );
    return {
      label: getReportCycleLabel(schedule.frequency, dueDateIso, index),
      status,
      title: formatOverviewPeriodStatusTitle(status),
    };
  });

  let completedOnTimeCount = 0;
  let completedBeforeNextDueCount = 0;
  let missedCount = 0;

  for (const period of periods) {
    if (period.status === "completed_on_time") completedOnTimeCount += 1;
    if (period.status === "completed_before_next_due") completedBeforeNextDueCount += 1;
    if (period.status === "missed") missedCount += 1;
  }

  const completedCount = completedOnTimeCount + completedBeforeNextDueCount;
  const expectedCycles = periods.length;
  const completionPercent =
    expectedCycles === 0 ? 0 : Math.round((completedCount / expectedCycles) * 100);

  return {
    pmName: schedule.templateName,
    areaLabel: schedule.areaLabel,
    frequency: PM_FREQUENCY_LABELS[schedule.frequency],
    pmTypeKey: schedule.frequency,
    expectedCycles,
    completedCount,
    completedOnTimeCount,
    completedBeforeNextDueCount,
    missedCount,
    completionPercent,
    periods,
  };
}

export function buildPmCompletionOverviewReport(
  source: PmReportSource,
  filters: PmReportFilters,
  now = new Date()
): { groups: PmReportOverviewGroup[]; summary: PmReportOverviewSummary } {
  const occurrenceByKey = buildOccurrenceMaps(source);
  const grouped = new Map<PmFrequency, PmReportOverviewItem[]>();

  for (const schedule of source.schedules) {
    const item = buildOverviewItemForSchedule(
      source,
      schedule,
      filters,
      occurrenceByKey,
      now
    );
    if (!item) continue;

    const existing = grouped.get(schedule.frequency) ?? [];
    existing.push(item);
    grouped.set(schedule.frequency, existing);
  }

  const groups: PmReportOverviewGroup[] = OVERVIEW_FREQUENCY_ORDER.filter((frequency) =>
    grouped.has(frequency)
  ).map((frequency) => ({
    frequency: PM_FREQUENCY_LABELS[frequency],
    pmTypeKey: frequency,
    items: (grouped.get(frequency) ?? []).sort((left, right) =>
      left.pmName.localeCompare(right.pmName)
    ),
  }));

  const summary = groups.reduce<PmReportOverviewSummary>(
    (acc, group) => {
      for (const item of group.items) {
        acc.totalScheduledCycles += item.expectedCycles;
        acc.completedOnTime += item.completedOnTimeCount;
        acc.completedBeforeNextDue += item.completedBeforeNextDueCount;
        acc.missed += item.missedCount;
      }
      return acc;
    },
    {
      totalScheduledCycles: 0,
      completedOnTime: 0,
      completedBeforeNextDue: 0,
      missed: 0,
      overallCompletionPercent: 0,
    }
  );

  const completedTotal = summary.completedOnTime + summary.completedBeforeNextDue;
  summary.overallCompletionPercent =
    summary.totalScheduledCycles === 0
      ? 0
      : Math.round((completedTotal / summary.totalScheduledCycles) * 100);

  return { groups, summary };
}

export function sortOverviewGroups(groups: PmReportOverviewGroup[]): PmReportOverviewGroup[] {
  return [...groups].sort(
    (left, right) => PM_FREQUENCY_ORDER[left.pmTypeKey] - PM_FREQUENCY_ORDER[right.pmTypeKey]
  );
}
