export function getInspectionDurationMs(
  startedAt: string | null | undefined,
  completedAt: string | null | undefined
): number | null {
  if (!startedAt || !completedAt) return null;

  const startMs = new Date(startedAt).getTime();
  const endMs = new Date(completedAt).getTime();
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs < startMs) {
    return null;
  }

  return endMs - startMs;
}

export function formatInspectionDuration(
  startedAt: string | null | undefined,
  completedAt: string | null | undefined
): string | null {
  const durationMs = getInspectionDurationMs(startedAt, completedAt);
  if (durationMs === null) return null;

  const totalSeconds = Math.round(durationMs / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours} hr ${minutes} min`;
  }

  if (minutes > 0) {
    return seconds > 0 ? `${minutes} min ${seconds} sec` : `${minutes} min`;
  }

  return `${seconds} sec`;
}
