import { InspectionPeriod } from "@/app/inspections/lib/inspection-types";
import { getPeriodBounds } from "@/app/inspections/lib/period-utils";
import { PmCompliancePeriod, PmTile } from "./maintenance-types";
import { getPmCompliancePeriodStart } from "./pm-compliance";
import { parseDate, startOfDay } from "./pm-urgency";

type CompletedOccurrenceRow = {
  assignment_id: number;
  due_date: string;
  status: string;
  completed_at: string | null;
};

function occurrenceKey(assignmentId: number, dueDate: string): string {
  return `${assignmentId}::${dueDate}`;
}

function resolvePmCompletionDate(
  row: CompletedOccurrenceRow,
  tile?: PmTile
): Date {
  if (row.completed_at) {
    return startOfDay(new Date(row.completed_at));
  }

  if (tile?.lastCompletedAt) {
    return startOfDay(new Date(tile.lastCompletedAt));
  }

  return startOfDay(parseDate(String(row.due_date)));
}

function countCompletedPmsInDateRange(
  completedByKey: Map<string, CompletedOccurrenceRow>,
  pmTiles: PmTile[],
  periodStart: Date,
  periodEnd: Date
): number {
  const countedKeys = new Set<string>();
  const tileByKey = new Map<string, PmTile>();

  for (const tile of pmTiles) {
    if (!tile.nextDueDate) continue;
    tileByKey.set(occurrenceKey(tile.assignmentId, tile.nextDueDate), tile);
  }

  for (const [, row] of completedByKey) {
    if (row.status !== "completed") continue;

    const key = occurrenceKey(Number(row.assignment_id), String(row.due_date));
    const tile = tileByKey.get(key);
    const completedAt = resolvePmCompletionDate(row, tile);

    if (completedAt >= periodStart && completedAt <= periodEnd) {
      countedKeys.add(key);
    }
  }

  for (const tile of pmTiles) {
    if (tile.urgency !== "completed" || !tile.nextDueDate) continue;

    const key = occurrenceKey(tile.assignmentId, tile.nextDueDate);
    if (countedKeys.has(key)) continue;

    const row = completedByKey.get(key);
    const completedAt = row
      ? resolvePmCompletionDate(row, tile)
      : tile.lastCompletedAt
        ? startOfDay(new Date(tile.lastCompletedAt))
        : periodEnd;

    if (completedAt >= periodStart && completedAt <= periodEnd) {
      countedKeys.add(key);
    }
  }

  return countedKeys.size;
}

export function countCompletedPmsByPeriod(
  completedByKey: Map<string, CompletedOccurrenceRow>,
  pmTiles: PmTile[],
  period: PmCompliancePeriod,
  now = new Date()
): number {
  const periodStart = getPmCompliancePeriodStart(period, now);
  return countCompletedPmsInDateRange(
    completedByKey,
    pmTiles,
    periodStart,
    startOfDay(now)
  );
}

export function countCompletedPmsForKpiPeriod(
  completedByKey: Map<string, CompletedOccurrenceRow>,
  pmTiles: PmTile[],
  period: InspectionPeriod,
  now = new Date()
): number {
  const bounds = getPeriodBounds(period, now);
  return countCompletedPmsInDateRange(
    completedByKey,
    pmTiles,
    startOfDay(new Date(bounds.start)),
    startOfDay(new Date(bounds.end))
  );
}

export function countCompletedPmsByKpiPeriods(
  completedByKey: Map<string, CompletedOccurrenceRow>,
  pmTiles: PmTile[],
  now = new Date()
): Record<InspectionPeriod, number> {
  return {
    today: countCompletedPmsForKpiPeriod(completedByKey, pmTiles, "today", now),
    wtd: countCompletedPmsForKpiPeriod(completedByKey, pmTiles, "wtd", now),
    mtd: countCompletedPmsForKpiPeriod(completedByKey, pmTiles, "mtd", now),
    qtd: countCompletedPmsForKpiPeriod(completedByKey, pmTiles, "qtd", now),
    ytd: countCompletedPmsForKpiPeriod(completedByKey, pmTiles, "ytd", now),
  };
}

export function countCompletedPmsByAllPeriods(
  completedByKey: Map<string, CompletedOccurrenceRow>,
  pmTiles: PmTile[],
  now = new Date()
): Record<PmCompliancePeriod, number> {
  return {
    mtd: countCompletedPmsByPeriod(completedByKey, pmTiles, "mtd", now),
    qtd: countCompletedPmsByPeriod(completedByKey, pmTiles, "qtd", now),
    ytd: countCompletedPmsByPeriod(completedByKey, pmTiles, "ytd", now),
  };
}
