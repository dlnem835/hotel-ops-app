import { PriorityQueueItem } from "./inspection-types";
import { compareInspectionAge } from "./inspection-age";
import { daysSince } from "./period-utils";

export type SummaryRow = {
  area_id: number;
  name: string;
  inspection_program: string;
  last_completed_at: string | null;
  never_inspected: boolean;
};

export function buildPriorityQueue(
  rows: SummaryRow[],
  program: "VR" | "RPM",
  limit = 3,
  now = new Date()
): PriorityQueueItem[] {
  const filtered = rows.filter((row) => {
    if (program === "VR") {
      return (
        row.inspection_program === "VR" ||
        row.inspection_program === "STAYOVER"
      );
    }
    return row.inspection_program === "RPM";
  });

  return filtered
    .slice()
    .sort((a, b) =>
      compareInspectionAge(
        a.never_inspected || !a.last_completed_at,
        a.last_completed_at,
        a.name,
        b.never_inspected || !b.last_completed_at,
        b.last_completed_at,
        b.name,
        now
      )
    )
    .slice(0, limit)
    .map((row) => {
      const neverInspected = row.never_inspected || !row.last_completed_at;
      return {
        areaId: row.area_id,
        name: row.name,
        lastCompletedAt: neverInspected ? null : row.last_completed_at,
        daysSinceInspection: neverInspected
          ? null
          : daysSince(row.last_completed_at, now),
        neverInspected,
      };
    });
}
