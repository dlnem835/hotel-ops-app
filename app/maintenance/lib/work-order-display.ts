import { WorkOrder } from "./maintenance-types";
import { formatOneEyrieUpdatedTimestamp } from "@/app/lib/one-eyrie-updated-timestamp";

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

export function formatWorkOrderOpenedTimestamp(
  createdAt: string,
  now = new Date()
): string {
  const created = new Date(createdAt);
  if (Number.isNaN(created.getTime())) return "";

  const timePart = created.toLocaleString([], {
    hour: "numeric",
    minute: "2-digit",
  });

  const isToday =
    created.getFullYear() === now.getFullYear() &&
    created.getMonth() === now.getMonth() &&
    created.getDate() === now.getDate();

  if (isToday) {
    return `Opened today, ${timePart}`;
  }

  const datePart = created.toLocaleString([], {
    month: "short",
    day: "numeric",
  });

  return `Opened ${datePart}, ${timePart}`;
}

export function formatWorkOrderUpdatedTimestamp(
  updatedAt: string,
  now = new Date()
): string {
  return formatOneEyrieUpdatedTimestamp(updatedAt, now);
}

export function formatWorkOrderCardTimestamp(
  order: Pick<WorkOrder, "createdAt" | "commentsUpdatedAt">,
  now = new Date()
): string {
  if (order.commentsUpdatedAt) {
    return formatWorkOrderUpdatedTimestamp(order.commentsUpdatedAt, now);
  }
  return formatWorkOrderOpenedTimestamp(order.createdAt, now);
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

function normalizeWorkOrderText(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

export function workOrderTextsMatch(
  a: string | null | undefined,
  b: string | null | undefined
): boolean {
  if (!a?.trim() || !b?.trim()) return false;
  return normalizeWorkOrderText(a) === normalizeWorkOrderText(b);
}

/** List cards — user-entered details only; skip repeats of subject or source note. */
export function workOrderListDescription(
  order: Pick<WorkOrder, "subject" | "description" | "sourceNote">
): string | null {
  const description = truncateWorkOrderText(order.description);
  if (!description) return null;
  if (workOrderTextsMatch(description, order.subject)) return null;
  if (workOrderTextsMatch(description, order.sourceNote)) return null;
  return description;
}
