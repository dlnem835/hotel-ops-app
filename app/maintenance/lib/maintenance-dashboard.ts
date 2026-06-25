import { SupabaseClient } from "@supabase/supabase-js";
import {
  EngineeringPerformance,
  MaintenanceDashboardPayload,
  MaintenanceMetrics,
  PmOccurrenceResponses,
  PmPriorityQueueItem,
  PmTile,
  WorkOrder,
} from "./maintenance-types";
import { fetchPmDashboardData } from "./pm-db";
import { PM_FREQUENCY_LABELS } from "./pm-types";
import {
  classifyPmUrgency,
  formatLastCompletedLabel,
  formatPmDueLabel,
  formatPmTileStatusLine,
  isDateInCurrentMonth,
  PM_URGENCY_ORDER,
} from "./pm-urgency";
import {
  sortWorkOrdersByPriority,
  normalizeWorkOrder,
  WorkOrderRow,
} from "./work-order-db";

type OccurrenceRow = {
  id: number;
  assignment_id: number;
  due_date: string;
  status: string;
  completed_at: string | null;
  responses: PmOccurrenceResponses;
};

function occurrenceKey(assignmentId: number, dueDate: string): string {
  return `${assignmentId}::${dueDate}`;
}

function countFailedSteps(responses: PmOccurrenceResponses | null | undefined): number {
  return (responses?.steps || []).filter((step) => step.outcome === "fail").length;
}

export async function buildMaintenanceDashboard(
  supabase: SupabaseClient
): Promise<MaintenanceDashboardPayload> {
  const now = new Date();
  const [pmData, workOrderResult, closedWorkOrdersResult, occurrenceResult] =
    await Promise.all([
      fetchPmDashboardData(supabase),
      supabase
        .from("work_orders")
        .select("*")
        .in("status", ["Open", "In Progress"])
        .order("created_at", { ascending: false }),
      supabase
        .from("work_orders")
        .select("id, completed_at")
        .eq("status", "Completed")
        .not("completed_at", "is", null),
      supabase
        .from("pm_occurrences")
        .select("id, assignment_id, due_date, status, completed_at, responses"),
    ]);

  if (workOrderResult.error) {
    throw new Error(workOrderResult.error.message);
  }

  if (closedWorkOrdersResult.error) {
    throw new Error(closedWorkOrdersResult.error.message);
  }

  if (occurrenceResult.error) {
    throw new Error(occurrenceResult.error.message);
  }

  const occurrences = (occurrenceResult.data || []) as OccurrenceRow[];
  const completedByKey = new Map<string, OccurrenceRow>();
  const openByKey = new Map<string, OccurrenceRow>();
  const lastCompletedByAssignment = new Map<number, string>();
  let failedPmItems = 0;

  for (const row of occurrences) {
    const assignmentId = Number(row.assignment_id);
    const key = occurrenceKey(assignmentId, String(row.due_date));

    if (row.status === "completed") {
      completedByKey.set(key, row);
      if (row.completed_at) {
        const existing = lastCompletedByAssignment.get(assignmentId);
        if (!existing || new Date(row.completed_at) > new Date(existing)) {
          lastCompletedByAssignment.set(assignmentId, String(row.completed_at));
        }
      }
    } else if (row.status === "open") {
      openByKey.set(key, row);
      failedPmItems += countFailedSteps(row.responses);
    }
  }

  const activeSchedules = pmData.schedules.filter(
    (schedule) =>
      schedule.templateStatus === "Active" &&
      schedule.assignmentStatus === "Active" &&
      schedule.nextDueDate
  );

  const pmTiles: PmTile[] = activeSchedules.map((schedule) => {
    const dueDate = schedule.nextDueDate!;
    const key = occurrenceKey(schedule.assignmentId, dueDate);
    const isCompleted = completedByKey.has(key);
    const openOccurrence = openByKey.get(key);
    const urgency = classifyPmUrgency(dueDate, isCompleted, now);
    const lastCompletedAt =
      lastCompletedByAssignment.get(schedule.assignmentId) || null;

    return {
      key: `${schedule.assignmentId}-${dueDate}`,
      assignmentId: schedule.assignmentId,
      templateId: schedule.templateId,
      templateName: schedule.templateName,
      areaName: schedule.areaName,
      assetLabel: schedule.assetLabel,
      frequency: schedule.frequency,
      frequencyLabel: PM_FREQUENCY_LABELS[schedule.frequency],
      nextDueDate: dueDate,
      urgency,
      dueLabel: formatPmDueLabel(dueDate, urgency, now),
      dueStatusLine: formatPmTileStatusLine(urgency, dueDate, now),
      occurrenceId: openOccurrence?.id ?? completedByKey.get(key)?.id ?? null,
      estimatedMinutes: schedule.estimatedMinutes,
      lastCompletedAt,
      lastCompletedLabel: formatLastCompletedLabel(lastCompletedAt, now),
    };
  });

  pmTiles.sort((a, b) => {
    const urgencyDiff = PM_URGENCY_ORDER[a.urgency] - PM_URGENCY_ORDER[b.urgency];
    if (urgencyDiff !== 0) return urgencyDiff;
    const dateA = a.nextDueDate || "";
    const dateB = b.nextDueDate || "";
    if (dateA !== dateB) return dateA.localeCompare(dateB);
    return a.templateName.localeCompare(b.templateName);
  });

  const pmPriorityQueue: PmPriorityQueueItem[] = pmTiles
    .filter((tile) => tile.urgency !== "completed" && tile.urgency !== "current")
    .slice(0, 3)
    .map((tile) => ({
      assignmentId: tile.assignmentId,
      templateId: tile.templateId,
      templateName: tile.templateName,
      areaName: tile.areaName,
      assetLabel: tile.assetLabel,
      nextDueDate: tile.nextDueDate,
      urgency: tile.urgency,
      dueLabel: tile.dueLabel,
      occurrenceId: tile.occurrenceId,
    }));

  const workOrders = sortWorkOrdersByPriority(
    ((workOrderResult.data || []) as WorkOrderRow[]).map(normalizeWorkOrder)
  );

  const metrics = buildMetrics(pmTiles, workOrders, completedByKey, now);
  const workOrdersClosedMtd = (
    (closedWorkOrdersResult.data || []) as { completed_at: string }[]
  ).filter((row) => {
    const completedDate = new Date(row.completed_at);
    return (
      completedDate.getFullYear() === now.getFullYear() &&
      completedDate.getMonth() === now.getMonth()
    );
  }).length;

  const engineeringPerformance: EngineeringPerformance = {
    compliancePercent: metrics.compliancePercent,
    completedMtd: metrics.completedMtd,
    pastDueCount: metrics.pastDuePms,
    failedPmItems,
    workOrdersClosedMtd,
  };

  return {
    metrics,
    engineeringPerformance,
    workOrders,
    pmTiles,
    pmPriorityQueue,
  };
}

function buildMetrics(
  pmTiles: PmTile[],
  workOrders: WorkOrder[],
  completedByKey: Map<string, OccurrenceRow>,
  now: Date
): MaintenanceMetrics {
  const pastDuePms = pmTiles.filter((tile) => tile.urgency === "past_due").length;
  const dueTodayPms = pmTiles.filter((tile) => tile.urgency === "due_today").length;
  const dueTomorrowPms = pmTiles.filter((tile) => tile.urgency === "due_tomorrow").length;
  const upcomingThisWeekPms = pmTiles.filter(
    (tile) => tile.urgency === "upcoming"
  ).length;

  let dueMtd = 0;
  let completedMtd = 0;

  for (const tile of pmTiles) {
    if (!tile.nextDueDate) continue;
    if (!isDateInCurrentMonth(tile.nextDueDate, now) && tile.urgency !== "past_due") {
      continue;
    }
    dueMtd += 1;
    const key = occurrenceKey(tile.assignmentId, tile.nextDueDate);
    if (completedByKey.has(key)) {
      completedMtd += 1;
    }
  }

  for (const [, row] of completedByKey) {
    if (row.completed_at) {
      const completedDate = new Date(row.completed_at);
      if (
        completedDate.getFullYear() === now.getFullYear() &&
        completedDate.getMonth() === now.getMonth()
      ) {
        const counted = pmTiles.some(
          (tile) =>
            tile.assignmentId === Number(row.assignment_id) &&
            tile.nextDueDate === String(row.due_date)
        );
        if (!counted) {
          completedMtd += 1;
        }
      }
    }
  }

  const compliancePercent =
    dueMtd === 0 ? 100 : Math.round((completedMtd / dueMtd) * 100);

  return {
    openWorkOrders: workOrders.length,
    pastDuePms,
    dueTodayPms,
    dueTomorrowPms,
    upcomingThisWeekPms,
    completedMtd,
    compliancePercent,
  };
}
