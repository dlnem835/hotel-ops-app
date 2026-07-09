import type { SavedReportSchedule } from "@/app/reports/lib/report-schedule-types";

const STORAGE_KEY = "one-eyrie-report-schedules";

function readSchedules(): SavedReportSchedule[] {
  if (typeof window === "undefined") return [];

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as SavedReportSchedule[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeSchedules(schedules: SavedReportSchedule[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(schedules));
}

export function listSavedReportSchedules(): SavedReportSchedule[] {
  return readSchedules().sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export function saveReportSchedule(entry: SavedReportSchedule): SavedReportSchedule[] {
  const schedules = readSchedules();
  const next = [entry, ...schedules.filter((item) => item.id !== entry.id)];
  writeSchedules(next);
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("report-schedules-updated"));
  }
  return next;
}

export function deleteReportSchedule(id: string): SavedReportSchedule[] {
  const next = readSchedules().filter((item) => item.id !== id);
  writeSchedules(next);
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("report-schedules-updated"));
  }
  return next;
}

export function createScheduleId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `schedule-${Date.now()}`;
}
