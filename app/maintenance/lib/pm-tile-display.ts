import { parseDate } from "./schedule-engine";

export function formatPmNextDueDate(iso: string | null): string {
  if (!iso) return "—";

  return parseDate(iso).toLocaleDateString(undefined, {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

export function formatPmCycleProgressLabel(completedCount: number, totalCount: number): string {
  if (totalCount === 0) return "0 of 0";
  return `${completedCount} of ${totalCount}`;
}
