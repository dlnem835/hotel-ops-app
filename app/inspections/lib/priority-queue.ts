import { PriorityQueueItem } from "./inspection-types";
import { daysSince } from "./period-utils";

export type SummaryRow = {
  area_id: number;
  name: string;
  inspection_program: string;
  last_completed_at: string | null;
  last_score_percent: number | null;
  last_failed_item_count: number;
  open_deficiency_count: number;
  recurring_deficiency_count: number;
  never_inspected: boolean;
};

export function buildPriorityQueue(
  rows: SummaryRow[],
  program: "VR" | "RPM",
  limit = 3
): PriorityQueueItem[] {
  const filtered = rows.filter((row) => {
    if (program === "VR") {
      return row.inspection_program === "VR" || row.inspection_program === "STAYOVER";
    }
    return row.inspection_program === "RPM";
  });

  const scored = filtered.map((row) => {
    const reasons: string[] = [];
    let priorityScore = 0;

    if (row.never_inspected || !row.last_completed_at) {
      priorityScore += 100;
    } else {
      const days = daysSince(row.last_completed_at) ?? 0;
      const dayPoints = Math.min(days * 2, 60);
      priorityScore += dayPoints;
    }

    if (row.last_score_percent !== null) {
      if (row.last_score_percent < 80) {
        priorityScore += 80 - row.last_score_percent;
        reasons.push(`Low score ${Math.round(row.last_score_percent)}%`);
      } else if (row.last_score_percent < 90) {
        priorityScore += (90 - row.last_score_percent) / 2;
      }
    }

    if (row.last_failed_item_count > 0) {
      priorityScore += 20;
      reasons.push("Failed items on last inspection");
    }

    if (row.open_deficiency_count > 0) {
      priorityScore += row.open_deficiency_count * 10;
      reasons.push(
        `${row.open_deficiency_count} open deficienc${row.open_deficiency_count === 1 ? "y" : "ies"}`
      );
    }

    if (row.recurring_deficiency_count > 0) {
      priorityScore += row.recurring_deficiency_count * 15;
      reasons.push("Recurring deficiencies");
    }

    return {
      areaId: row.area_id,
      name: row.name,
      priorityScore,
      daysSinceInspection: daysSince(row.last_completed_at),
      neverInspected: row.never_inspected || !row.last_completed_at,
      lastScorePercent: row.last_score_percent,
      openDeficiencyCount: row.open_deficiency_count,
      recurringDeficiencyCount: row.recurring_deficiency_count,
      lastFailedItemCount: row.last_failed_item_count,
      reasons: reasons.slice(0, 3),
    };
  });

  return scored
    .sort((a, b) => {
      if (b.priorityScore !== a.priorityScore) {
        return b.priorityScore - a.priorityScore;
      }
      const aDays = a.daysSinceInspection ?? 9999;
      const bDays = b.daysSinceInspection ?? 9999;
      if (bDays !== aDays) return bDays - aDays;
      return Number(a.name) - Number(b.name);
    })
    .slice(0, limit);
}
