import type { WorkOrderRow } from "@/app/maintenance/lib/work-order-db";
import {
  fetchMemberDisplayNameResolver,
  type MemberDisplayNameResolver,
} from "@/app/lib/member-display-name";
import { createReportsSupabaseClient } from "@/app/reports/lib/lost-found-report-data";
import {
  mapWorkOrderSourceModule,
  resolveWorkOrderReportCreatedByLabel,
  type WorkOrderReportRow,
} from "@/app/reports/lib/work-order-report-types";

function formatDisplayDateTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function toDateOnly(iso: string | null | undefined): string {
  if (!iso) return "";
  return iso.slice(0, 10);
}

function computeHoursOpen(
  createdAt: string | null | undefined,
  completedAt: string | null | undefined,
  now = new Date()
): number | null {
  if (!createdAt) return null;
  const start = new Date(createdAt);
  if (Number.isNaN(start.getTime())) return null;

  const end = completedAt ? new Date(completedAt) : now;
  if (Number.isNaN(end.getTime())) return null;

  const diffMs = end.getTime() - start.getTime();
  return Math.max(0, Math.round(diffMs / (1000 * 60 * 60)));
}

function computeDaysOpen(hoursOpen: number | null): number | null {
  if (hoursOpen == null) return null;
  return Math.max(0, Math.round(hoursOpen / 24));
}

export function mapWorkOrderRowToReportItem(
  row: WorkOrderRow,
  memberResolver: MemberDisplayNameResolver
): WorkOrderReportRow {
  const createdAt = row.created_at ?? "";
  const completedAt = row.completed_at ?? null;
  const hoursOpen = computeHoursOpen(createdAt, completedAt);
  const createdByStored = row.created_by ? memberResolver.resolveStoredValue(row.created_by) : null;
  const completedByStored = row.completed_by
    ? memberResolver.resolveStoredValue(row.completed_by)
    : null;

  return {
    id: String(row.id),
    title: row.subject?.trim() || "—",
    area: row.area_label?.trim() || "—",
    areaId: row.area_id != null ? Number(row.area_id) : null,
    category: row.category?.trim() || "Uncategorized",
    priority: row.priority?.trim() || "Normal",
    status: row.status?.trim() || "Open",
    createdBy: resolveWorkOrderReportCreatedByLabel({
      createdByStoredValue: createdByStored,
    }),
    createdAt: formatDisplayDateTime(createdAt),
    createdAtIso: toDateOnly(createdAt),
    source: mapWorkOrderSourceModule(row.source_module),
    completedBy: completedByStored?.trim() || null,
    completedAt: completedAt ? formatDisplayDateTime(completedAt) : null,
    completedAtIso: completedAt ? toDateOnly(completedAt) : null,
    comments: row.comments?.trim() || "—",
    daysOpen: computeDaysOpen(hoursOpen),
    hoursOpen,
  };
}

export async function fetchWorkOrderReportSource(): Promise<WorkOrderReportRow[]> {
  const supabase = createReportsSupabaseClient();
  const [ordersResult, memberResolver] = await Promise.all([
    supabase.from("work_orders").select("*").order("created_at", { ascending: false }),
    fetchMemberDisplayNameResolver(supabase),
  ]);

  if (ordersResult.error) {
    throw new Error(ordersResult.error.message);
  }

  return ((ordersResult.data ?? []) as WorkOrderRow[]).map((row) =>
    mapWorkOrderRowToReportItem(row, memberResolver)
  );
}
