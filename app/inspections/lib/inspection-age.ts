import { daysSince } from "./period-utils";

export function formatInspectionAgeLabel(
  neverInspected: boolean,
  lastCompletedAt: string | null,
  now = new Date()
): string {
  if (neverInspected || !lastCompletedAt) {
    return "Never Inspected";
  }

  const days = daysSince(lastCompletedAt, now);
  if (days === null) {
    return "Never Inspected";
  }
  if (days === 0) {
    return "Inspected Today";
  }
  if (days === 1) {
    return "1 Day Since Inspection";
  }
  return `${days} Days Since Inspection`;
}

export function compareInspectionAge(
  aNever: boolean,
  aLastCompletedAt: string | null,
  aName: string,
  bNever: boolean,
  bLastCompletedAt: string | null,
  bName: string,
  now = new Date()
): number {
  if (aNever !== bNever) {
    return aNever ? -1 : 1;
  }

  if (aNever) {
    return Number(aName) - Number(bName);
  }

  const aDays = daysSince(aLastCompletedAt, now) ?? 0;
  const bDays = daysSince(bLastCompletedAt, now) ?? 0;
  if (bDays !== aDays) {
    return bDays - aDays;
  }

  return Number(aName) - Number(bName);
}
