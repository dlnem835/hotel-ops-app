import type { PmFrequency } from "@/app/maintenance/lib/pm-types";
import type { PmReportCompletionTiming } from "@/app/reports/lib/pm-report-grace";
import type { PmReportOverviewPeriodStatus } from "@/app/reports/lib/pm-report-overview-timing";

export type PmReportCompletedRow = {
  occurrenceId: number;
  pmName: string;
  pmType: string;
  pmTypeKey: PmFrequency;
  areaLabel: string;
  frequency: string;
  dueDate: string;
  dueDateIso: string;
  completedAt: string;
  completedAtIso: string;
  completedAtSortIso: string;
  completedBy: string;
  completionStatus: PmReportCompletionTiming;
  completionStatusLabel: string;
  cycleLabel: string;
};

export type PmReportMissedRow = {
  occurrenceId: number | null;
  pmName: string;
  pmType: string;
  pmTypeKey: PmFrequency;
  areaLabel: string;
  frequency: string;
  dueDate: string;
  dueDateIso: string;
  graceExpiresAt: string;
  graceExpiresAtIso: string;
  daysMissed: number;
  cycleLabel: string;
  statusLabel: string;
};

export type PmReportFailedItemRow = {
  id: string;
  occurrenceId: number;
  itemLabel: string;
  sourcePmName: string;
  pmType: string;
  pmTypeKey: PmFrequency;
  areaLabel: string;
  frequency: string;
  completedBy: string;
  completedAt: string;
  completedAtIso: string;
  completedAtSortIso: string;
  notes: string;
};

export type PmReportOverviewPeriod = {
  label: string;
  status: PmReportOverviewPeriodStatus;
  title: string;
};

export type PmReportOverviewItem = {
  pmName: string;
  areaLabel: string;
  frequency: string;
  pmTypeKey: PmFrequency;
  expectedCycles: number;
  completedCount: number;
  completedOnTimeCount: number;
  completedBeforeNextDueCount: number;
  missedCount: number;
  completionPercent: number;
  periods: PmReportOverviewPeriod[];
};

export type PmReportOverviewGroup = {
  frequency: string;
  pmTypeKey: PmFrequency;
  items: PmReportOverviewItem[];
};

export type PmReportOverviewSummary = {
  totalScheduledCycles: number;
  completedOnTime: number;
  completedBeforeNextDue: number;
  missed: number;
  overallCompletionPercent: number;
};

export type PmReportFilterOptions = {
  completedBy: string[];
};

export type PmReportSourceOccurrence = {
  id: number;
  templateId: number;
  assignmentId: number;
  dueDate: string;
  status: "open" | "completed" | "missed";
  responses: {
    steps?: Array<{
      stepKey: string;
      outcome: "pass" | "fail" | "na";
      notes?: string;
    }>;
  } | null;
  completedAt: string | null;
  completedBy: string | null;
};

export type PmReportSourceSchedule = {
  assignmentId: number;
  templateId: number;
  templateName: string;
  frequency: PmFrequency;
  areaLabel: string;
  startDate: string;
  endDate: string | null;
  templateStatus: string;
  assignmentStatus: string;
};

export type PmReportSource = {
  schedules: PmReportSourceSchedule[];
  occurrences: PmReportSourceOccurrence[];
  completedByOptions: string[];
  stepLabelsByTemplateId: Map<number, Map<string, string>>;
  resolveCompletedBy: (stored: string | null | undefined) => string;
};
