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

export function countCompletedPmsByPeriod(
  completedByKey: Map<string, CompletedOccurrenceRow>,
  pmTiles: PmTile[],
  period: PmCompliancePeriod,
  now = new Date()
): number {
  const periodStart = getPmCompliancePeriodStart(period, now);
  const end = startOfDay(now);
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

    if (completedAt >= periodStart && completedAt <= end) {
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
        : end;

    if (completedAt >= periodStart && completedAt <= end) {
      countedKeys.add(key);
    }
  }

  return countedKeys.size;
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
