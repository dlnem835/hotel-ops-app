export const RPM_CYCLE_WEEKS = 17;

const MS_PER_DAY = 24 * 60 * 60 * 1000;

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function getWeekStart(date: Date, weekStartsOn: "monday" | "sunday"): Date {
  const day = date.getDay();
  const diff =
    weekStartsOn === "monday" ? (day === 0 ? 6 : day - 1) : day;
  const start = startOfDay(date);
  start.setDate(start.getDate() - diff);
  return start;
}

export type RpmCycleBounds = {
  start: Date;
  end: Date;
  cycleNumber: number;
};

export function getRpmCycleBounds(
  now = new Date(),
  weekStartsOn: "monday" | "sunday" = "monday"
): RpmCycleBounds {
  const today = startOfDay(now);
  const yearAnchor = getWeekStart(new Date(today.getFullYear(), 0, 1), weekStartsOn);
  const cycleDays = RPM_CYCLE_WEEKS * 7;
  const daysSinceAnchor = Math.floor(
    (today.getTime() - yearAnchor.getTime()) / MS_PER_DAY
  );
  const cycleIndex = Math.max(0, Math.floor(daysSinceAnchor / cycleDays));

  const start = new Date(yearAnchor);
  start.setDate(start.getDate() + cycleIndex * cycleDays);

  const end = new Date(start);
  end.setDate(end.getDate() + cycleDays - 1);

  return {
    start,
    end,
    cycleNumber: cycleIndex + 1,
  };
}

export function formatRpmCycleLabel(bounds: RpmCycleBounds): string {
  const formatDate = (date: Date) =>
    date.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
    });

  return `17-week cycle · ${formatDate(bounds.start)} – ${formatDate(bounds.end)}`;
}

export function getRpmCycleEndIso(bounds: RpmCycleBounds): string {
  const end = new Date(bounds.end);
  end.setHours(23, 59, 59, 999);
  return end.toISOString();
}

export type RpmCycleSession = {
  area_id: number;
  inspection_program: string;
  completed_at: string;
};

export function calculateRpmCycleCompliance(
  activeRoomIds: Set<number>,
  sessions: RpmCycleSession[],
  programMatchesRpm: (program: string) => boolean
): {
  compliancePercent: number;
  completedCount: number;
  requiredCount: number;
  remainingCount: number;
} {
  const requiredCount = activeRoomIds.size;
  const completedRoomIds = new Set<number>();

  for (const session of sessions) {
    if (!session.completed_at) continue;
    if (!programMatchesRpm(session.inspection_program)) continue;
    if (!activeRoomIds.has(session.area_id)) continue;
    completedRoomIds.add(session.area_id);
  }

  const completedCount = completedRoomIds.size;
  const remainingCount = Math.max(0, requiredCount - completedCount);
  const compliancePercent =
    requiredCount === 0
      ? 100
      : Math.round((completedCount / requiredCount) * 100);

  return {
    compliancePercent,
    completedCount,
    requiredCount,
    remainingCount,
  };
}
