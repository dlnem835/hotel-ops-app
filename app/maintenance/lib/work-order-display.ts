import { WorkOrder } from "./maintenance-types";

export function isGuestImpactingWorkOrder(
  order: Pick<WorkOrder, "areaLabel">
): boolean {
  const label = order.areaLabel?.trim() || "";
  return /^room\s+/i.test(label);
}

export function formatWorkOrderAge(createdAt: string): string {
  const created = new Date(createdAt);
  const now = new Date();
  const days = Math.floor((now.getTime() - created.getTime()) / (1000 * 60 * 60 * 24));
  if (days === 0) return "Opened today";
  if (days === 1) return "Opened yesterday";
  return `Open ${days} days`;
}

export function truncateWorkOrderText(
  value: string | null | undefined,
  max = 120
): string | null {
  if (!value?.trim()) return null;
  const text = value.trim();
  if (text.length <= max) return text;
  return `${text.slice(0, max - 1)}…`;
}
