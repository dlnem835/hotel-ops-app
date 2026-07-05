import { PmCompliancePeriod, PmPeriodPerformance } from "./maintenance-types";
import { PmFrequency } from "./pm-types";
import { enumerateDueDatesInRange, parseDate } from "./schedule-engine";
import { startOfDay } from "./pm-urgency";

export type PmComplianceSchedule = {
  assignmentId: number;
  startDate: string;
  endDate: string | null;
  frequency: PmFrequency;
};


type CompletedOccurrenceRow = {
  assignment_id: number;
  due_date: string;
  completed_at: string | null;
  status: string;
};

function occurrenceKey(assignmentId: number, dueDate: string): string {
  return `${assignmentId}::${dueDate}`;
}

export function getPmCompliancePeriodStart(
  period: PmCompliancePeriod,
  now = new Date()
): Date {
  switch (period) {
    case "mtd":
      return new Date(now.getFullYear(), now.getMonth(), 1);
    case "qtd": {
      const quarterMonth = Math.floor(now.getMonth() / 3) * 3;
      return new Date(now.getFullYear(), quarterMonth, 1);
    }
    case "ytd":
      return new Date(now.getFullYear(), 0, 1);
  }
}

function isCompletedOnTime(
  completedAt: string | null,
  dueDateIso: string
): boolean {
  if (!completedAt) return false;
  return (
    startOfDay(new Date(completedAt)).getTime() <=
    startOfDay(parseDate(dueDateIso)).getTime()
  );
}

export function isPmCompletedOnTime(
  completedAt: string | null,
  dueDateIso: string
): boolean {
  return isCompletedOnTime(completedAt, dueDateIso);
}

function isPmCompleted(occurrence: CompletedOccurrenceRow | undefined): boolean {
  return occurrence?.status === "completed";
}

export function calculatePmPeriodPerformance(
  schedules: PmComplianceSchedule[],
  completedByKey: Map<string, CompletedOccurrenceRow>,
  period: PmCompliancePeriod,
  now = new Date()
): PmPeriodPerformance {
  const periodStart = getPmCompliancePeriodStart(period, now);
  const reportingEnd = startOfDay(now);

  let scheduled = 0;
  let completed = 0;
  let onTime = 0;

  for (const schedule of schedules) {
    const dueDates = enumerateDueDatesInRange(
      schedule.startDate,
      schedule.frequency,
      schedule.endDate,
      periodStart,
      reportingEnd
    );

    for (const dueDate of dueDates) {
      scheduled += 1;
      const occurrence = completedByKey.get(
        occurrenceKey(schedule.assignmentId, dueDate)
      );
      if (!isPmCompleted(occurrence)) continue;

      completed += 1;
      if (isCompletedOnTime(occurrence!.completed_at, dueDate)) {
        onTime += 1;
      }
    }
  }

  const completionRate =
    scheduled === 0 ? 100 : Math.round((completed / scheduled) * 100);
  const onTimeRate =
    completed === 0 ? null : Math.round((onTime / completed) * 100);

  return { completionRate, onTimeRate };
}

export function calculatePmPerformanceByPeriod(
  schedules: PmComplianceSchedule[],
  completedByKey: Map<string, CompletedOccurrenceRow>,
  now = new Date()
): Record<PmCompliancePeriod, PmPeriodPerformance> {
  return {
    mtd: calculatePmPeriodPerformance(schedules, completedByKey, "mtd", now),
    qtd: calculatePmPeriodPerformance(schedules, completedByKey, "qtd", now),
    ytd: calculatePmPeriodPerformance(schedules, completedByKey, "ytd", now),
  };
}
