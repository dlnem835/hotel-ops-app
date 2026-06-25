import { parseDate, formatDate } from "./schedule-engine";
import { PmTileUrgency } from "./maintenance-types";

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function daysBetween(from: Date, to: Date): number {
  return Math.floor((to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24));
}

export function classifyPmUrgency(
  nextDueDate: string | null,
  isCompletedForCycle: boolean,
  now = new Date()
): PmTileUrgency {
  if (isCompletedForCycle) {
    return "completed";
  }

  if (!nextDueDate) {
    return "current";
  }

  const today = startOfDay(now);
  const due = parseDate(nextDueDate);
  const diff = daysBetween(today, due);

  if (diff < 0) return "past_due";
  if (diff === 0) return "due_today";
  if (diff === 1) return "due_tomorrow";
  if (diff <= 7) return "upcoming";
  return "current";
}

export const PM_URGENCY_ORDER: Record<PmTileUrgency, number> = {
  past_due: 0,
  due_today: 1,
  due_tomorrow: 2,
  upcoming: 3,
  current: 4,
  completed: 5,
};

export function formatPmUrgencyLabel(urgency: PmTileUrgency): string {
  switch (urgency) {
    case "past_due":
      return "Past due";
    case "due_today":
      return "Due today";
    case "due_tomorrow":
      return "Due tomorrow";
    case "upcoming":
      return "Upcoming";
    case "completed":
      return "Completed";
    case "current":
    default:
      return "Current";
  }
}

export function formatPmDueLabel(
  nextDueDate: string | null,
  urgency: PmTileUrgency,
  now = new Date()
): string {
  if (urgency === "completed") {
    return "Completed this cycle";
  }

  if (!nextDueDate) {
    return "—";
  }

  const today = startOfDay(now);
  const due = parseDate(nextDueDate);
  const diff = daysBetween(today, due);

  if (diff < 0) {
    const days = Math.abs(diff);
    if (days === 1) return "1 day overdue";
    return `${days} days overdue`;
  }

  if (diff === 0) return "Due today";
  if (diff === 1) return "Due tomorrow";

  return due.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function formatPmTileStatusLine(
  urgency: PmTileUrgency,
  nextDueDate: string | null,
  now = new Date()
): string {
  const label = formatPmUrgencyLabel(urgency);

  if (urgency === "completed") {
    return label;
  }

  if (!nextDueDate) {
    return label;
  }

  const today = startOfDay(now);
  const due = parseDate(nextDueDate);
  const diff = daysBetween(today, due);

  if (urgency === "past_due") {
    const days = Math.abs(diff);
    return `${label} · ${days} day${days === 1 ? "" : "s"}`;
  }

  if (urgency === "due_today") {
    return `${label} · today`;
  }

  if (urgency === "due_tomorrow") {
    return `${label} · tomorrow`;
  }

  return `${label} · ${formatPmDueLabel(nextDueDate, urgency, now)}`;
}

export function formatLastCompletedLabel(
  completedAt: string | null,
  now = new Date()
): string {
  if (!completedAt) {
    return "Never completed";
  }

  const completed = startOfDay(new Date(completedAt));
  const today = startOfDay(now);
  const days = daysBetween(completed, today);

  if (days === 0) return "Last completed: today";
  if (days === 1) return "Last completed: yesterday";
  return `Last completed: ${days} days ago`;
}

export function isDateInCurrentMonth(iso: string, now = new Date()): boolean {
  const date = parseDate(iso);
  return (
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth()
  );
}

export { startOfDay, formatDate, parseDate };
