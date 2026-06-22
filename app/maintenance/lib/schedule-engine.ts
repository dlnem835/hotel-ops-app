import { PmDueStatus, PmFrequency } from "./pm-types";

const SOON_DAYS = 7;

function parseDate(iso: string): Date {
  const [year, month, day] = iso.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function formatDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

export function advanceDueDate(dateIso: string, frequency: PmFrequency): string {
  const date = parseDate(dateIso);

  switch (frequency) {
    case "daily":
      date.setDate(date.getDate() + 1);
      break;
    case "weekly":
      date.setDate(date.getDate() + 7);
      break;
    case "biweekly":
      date.setDate(date.getDate() + 14);
      break;
    case "monthly":
      date.setMonth(date.getMonth() + 1);
      break;
    case "quarterly":
      date.setMonth(date.getMonth() + 3);
      break;
    case "triannually":
      date.setMonth(date.getMonth() + 4);
      break;
    case "semiannually":
      date.setMonth(date.getMonth() + 6);
      break;
    case "yearly":
      date.setFullYear(date.getFullYear() + 1);
      break;
    default:
      date.setMonth(date.getMonth() + 1);
  }

  return formatDate(date);
}

export function getActiveDueDate(
  startDateIso: string,
  frequency: PmFrequency,
  endDateIso: string | null,
  now = new Date()
): string | null {
  const today = startOfDay(now);
  const start = parseDate(startDateIso);
  const end = endDateIso ? parseDate(endDateIso) : null;

  if (today < start) {
    return startDateIso;
  }

  if (end && today > end) {
    let due = startDateIso;
    let lastValid = due;

    while (true) {
      if (parseDate(due) > end) break;
      lastValid = due;
      const next = advanceDueDate(due, frequency);
      if (parseDate(next) > end) break;
      due = next;
    }

    return lastValid;
  }

  let due = startDateIso;
  while (true) {
    const dueDate = parseDate(due);
    const next = advanceDueDate(due, frequency);
    const nextDate = parseDate(next);

    if (nextDate > today) {
      return due;
    }

    if (end && nextDate > end) {
      return dueDate <= end ? due : null;
    }

    due = next;
  }
}

export function getDueStatus(
  dueDateIso: string | null,
  now = new Date()
): PmDueStatus {
  if (!dueDateIso) {
    return "inactive";
  }

  const today = startOfDay(now);
  const due = parseDate(dueDateIso);

  if (due < today) {
    return "overdue";
  }

  const soonLimit = new Date(today);
  soonLimit.setDate(soonLimit.getDate() + SOON_DAYS);

  if (due <= soonLimit) {
    return "due_soon";
  }

  return "current";
}

export function formatDueStatusLabel(status: PmDueStatus): string {
  switch (status) {
    case "missing":
      return "No PM assigned";
    case "overdue":
      return "Overdue";
    case "due_soon":
      return "Due soon";
    case "current":
      return "Current";
    case "inactive":
      return "Inactive";
    default:
      return "—";
  }
}

export function formatNextDueLabel(
  dueDateIso: string | null,
  status: PmDueStatus
): string {
  if (!dueDateIso) {
    return "—";
  }

  if (status === "overdue") {
    const today = startOfDay(new Date());
    const due = parseDate(dueDateIso);
    const days = Math.floor(
      (today.getTime() - due.getTime()) / (1000 * 60 * 60 * 24)
    );
    if (days === 0) return "Due today";
    if (days === 1) return "1 day overdue";
    return `${days} days overdue`;
  }

  const today = startOfDay(new Date());
  const due = parseDate(dueDateIso);
  const days = Math.floor(
    (due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
  );

  if (days === 0) return "Due today";
  if (days === 1) return "Due tomorrow";
  return `Due ${due.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  })}`;
}
