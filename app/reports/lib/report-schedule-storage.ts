import type {
  ReportScheduleContext,
  ReportScheduleFormValues,
  SavedReportSchedule,
} from "@/app/reports/lib/report-schedule-types";

const LEGACY_STORAGE_KEY = "one-eyrie-report-schedules";

export const REPORT_SCHEDULES_UPDATED_EVENT = "report-schedules-updated";

function notifySchedulesUpdated() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(REPORT_SCHEDULES_UPDATED_EVENT));
  }
}

function readLegacySchedules(): SavedReportSchedule[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(LEGACY_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as SavedReportSchedule[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function clearLegacySchedules() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(LEGACY_STORAGE_KEY);
}

async function migrateLegacySchedulesIfNeeded(): Promise<void> {
  const legacy = readLegacySchedules();
  if (legacy.length === 0) return;

  const existing = await listSavedReportSchedules();
  if (existing.length > 0) {
    clearLegacySchedules();
    return;
  }

  for (const entry of legacy) {
    await fetch("/api/reports/schedules", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        schedule: entry.schedule,
        context: entry.context,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "America/New_York",
      }),
    });
  }

  clearLegacySchedules();
}

export async function listSavedReportSchedules(): Promise<SavedReportSchedule[]> {
  await migrateLegacySchedulesIfNeeded();
  const response = await fetch("/api/reports/schedules", { cache: "no-store" });
  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload.error || "Unable to load scheduled reports.");
  }
  return payload.schedules as SavedReportSchedule[];
}

export async function saveReportSchedule(input: {
  schedule: ReportScheduleFormValues;
  context: ReportScheduleContext;
  timezone: string;
}): Promise<SavedReportSchedule> {
  const response = await fetch("/api/reports/schedules", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload.error || "Unable to save schedule.");
  }
  notifySchedulesUpdated();
  return payload.schedule as SavedReportSchedule;
}

export async function deleteReportSchedule(id: string): Promise<void> {
  const response = await fetch(`/api/reports/schedules/${id}`, { method: "DELETE" });
  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload.error || "Unable to delete schedule.");
  }
  notifySchedulesUpdated();
}

export async function sendScheduledReportTest(id: string): Promise<{
  ok: boolean;
  resendMessageId?: string | null;
  error?: string | null;
}> {
  const response = await fetch(`/api/reports/schedules/${id}/send-test`, {
    method: "POST",
  });
  const payload = await response.json();
  if (!response.ok) {
    return { ok: false, error: payload.error || "Send test failed." };
  }
  notifySchedulesUpdated();
  return {
    ok: true,
    resendMessageId: payload.result?.resendMessageId ?? null,
    error: null,
  };
}

export function createScheduleId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `schedule-${Date.now()}`;
}
