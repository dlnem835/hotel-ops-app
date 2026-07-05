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
import { calculatePmPerformanceByPeriod } from "./pm-compliance";
import { countCompletedPmsByAllPeriods } from "./pm-completed-count";
import { isPmCompletedOnTime } from "./pm-compliance";
import { resolvePmHealthStatus } from "./pm-health-status";
import {
  buildPmCycleHistory,
  PmOccurrenceLookupStatus,
} from "./pm-cycle";
import { reconcilePmMissedCycles } from "./pm-cycle-reconcile";
import {
  classifyPmUrgency,
  formatPmDueLabel,
  formatPmTileStatusLine,
  isDateInCurrentMonth,
  PM_URGENCY_ORDER,
} from "./pm-urgency";
import { sortWorkOrdersByPriority,
  normalizeWorkOrder,
  WorkOrderRow,
} from "./work-order-db";
import { fetchMemberDisplayNameResolver } from "@/app/lib/member-display-name";

type OccurrenceRow = {
  id: number;
  assignment_id: number;
  due_date: string;
  status: string;
  completed_at: string | null;
  completed_by: string | null;
  responses: PmOccurrenceResponses;
};

type LastCompletion = {
  completedAt: string;
  completedBy: string | null;
};

function occurrenceKey(assignmentId: number, dueDate: string): string {
  return `${assignmentId}::${dueDate}`;
}

function parseOccurrenceDueDate(iso: string): Date {
  const [year, month, day] = iso.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function buildPmHealthSummary(
  pmTiles: PmTile[],
  completedByKey: Map<string, OccurrenceRow>,
  missedByKey: Map<string, OccurrenceRow>,
  now: Date
) {
  const yearStart = new Date(now.getFullYear(), 0, 1);
  let completedOnTime = 0;
  let completedLate = 0;
  let missedCount = 0;
  const pastDueCount = pmTiles.filter((tile) => tile.urgency === "past_due").length;

  for (const [, row] of completedByKey) {
    const dueDate = parseOccurrenceDueDate(String(row.due_date));
    if (dueDate < yearStart) continue;

    if (isPmCompletedOnTime(row.completed_at, String(row.due_date))) {
      completedOnTime += 1;
    } else {
      completedLate += 1;
    }
  }

  for (const [, row] of missedByKey) {
    const dueDate = parseOccurrenceDueDate(String(row.due_date));
    if (dueDate >= yearStart) {
      missedCount += 1;
    }
  }

  const status = resolvePmHealthStatus({
    completedOnTime,
    completedLate,
    pastDueCount,
    missedCount,
  });

  return {
    status,
    currentPms: pmTiles.filter((tile) => tile.urgency !== "completed").length,
    completedOnTime,
    completedLate,
    pastDueCount,
    missedCount,
  };
}

function countFailedSteps(responses: PmOccurrenceResponses | null | undefined): number {
  return (responses?.steps || []).filter((step) => step.outcome === "fail").length;
}

export async function buildMaintenanceDashboard(
  supabase: SupabaseClient
): Promise<MaintenanceDashboardPayload> {
  const now = new Date();
  const pmData = await fetchPmDashboardData(supabase);

  const reconcileSchedules = pmData.schedules
    .filter(
      (schedule) =>
        schedule.templateStatus === "Active" &&
        schedule.assignmentStatus === "Active" &&
        schedule.nextDueDate
    )
    .map((schedule) => ({
      assignmentId: schedule.assignmentId,
      templateId: schedule.templateId,
      startDate: schedule.startDate,
      endDate: schedule.endDate,
      frequency: schedule.frequency,
    }));

  await reconcilePmMissedCycles(supabase, reconcileSchedules, now);

  const [workOrderResult, closedWorkOrdersResult, occurrenceResult] =
    await Promise.all([
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
        .select("id, assignment_id, due_date, status, completed_at, completed_by, responses"),
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
  const missedByKey = new Map<string, OccurrenceRow>();
  const occurrenceStatusByAssignment = new Map<number, Map<string, PmOccurrenceLookupStatus>>();
  const lastCompletedByAssignment = new Map<number, LastCompletion>();
  let failedPmItems = 0;

  const yearStart = new Date(now.getFullYear(), 0, 1);

  for (const row of occurrences) {
    const assignmentId = Number(row.assignment_id);
    const key = occurrenceKey(assignmentId, String(row.due_date));

    if (!occurrenceStatusByAssignment.has(assignmentId)) {
      occurrenceStatusByAssignment.set(assignmentId, new Map());
    }
    occurrenceStatusByAssignment
      .get(assignmentId)!
      .set(String(row.due_date), row.status as PmOccurrenceLookupStatus);

    if (row.status === "completed") {
      completedByKey.set(key, row);
      if (row.completed_at) {
        const existing = lastCompletedByAssignment.get(assignmentId);
        const completedAt = String(row.completed_at);
        if (!existing || new Date(completedAt) > new Date(existing.completedAt)) {
          lastCompletedByAssignment.set(assignmentId, {
            completedAt,
            completedBy: row.completed_by ? String(row.completed_by) : null,
          });
        }
      }
    } else if (row.status === "open") {
      openByKey.set(key, row);
      failedPmItems += countFailedSteps(row.responses);
    } else if (row.status === "missed") {
      missedByKey.set(key, row);
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
    const lastCompletion = lastCompletedByAssignment.get(schedule.assignmentId);
    const occurrenceByDueDate =
      occurrenceStatusByAssignment.get(schedule.assignmentId) ?? new Map();
    const cycleHistory = buildPmCycleHistory({
      frequency: schedule.frequency,
      startDate: schedule.startDate,
      endDate: schedule.endDate,
      activeDueDate: dueDate,
      occurrenceByDueDate,
      now,
    });

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
      lastCompletedAt: lastCompletion?.completedAt ?? null,
      lastCompletedBy: lastCompletion?.completedBy ?? null,
      cycleHistory,
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

  const memberResolver = await fetchMemberDisplayNameResolver(supabase);

  const workOrdersWithLabels = workOrders.map((order) => ({
    ...order,
    createdByLabel: order.createdBy
      ? memberResolver.resolveStoredValue(order.createdBy)
      : null,
    completedByLabel: order.completedBy
      ? memberResolver.resolveStoredValue(order.completedBy)
      : null,
  }));

  const pmTilesWithLabels = pmTiles.map((tile) => ({
    ...tile,
    lastCompletedByLabel: tile.lastCompletedBy
      ? memberResolver.resolveStoredValue(tile.lastCompletedBy)
      : null,
  }));

  const metrics = buildMetrics(pmTiles, workOrders, completedByKey, now);
  const completedByPeriod = countCompletedPmsByAllPeriods(completedByKey, pmTiles, now);
  const complianceSchedules = pmData.schedules
    .filter(
      (schedule) =>
        schedule.templateStatus === "Active" && schedule.assignmentStatus === "Active"
    )
    .map((schedule) => ({
      assignmentId: schedule.assignmentId,
      startDate: schedule.startDate,
      endDate: schedule.endDate,
      frequency: schedule.frequency,
    }));

  const performanceByPeriod = calculatePmPerformanceByPeriod(
    complianceSchedules,
    completedByKey,
    now
  );
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
    pmHealth: buildPmHealthSummary(pmTiles, completedByKey, missedByKey, now),
    performanceByPeriod,
    completedMtd: completedByPeriod.mtd,
    completedByPeriod,
    pastDueCount: metrics.pastDuePms,
    failedPmItems,
    workOrdersClosedMtd,
  };

  return {
    metrics,
    engineeringPerformance,
    workOrders: workOrdersWithLabels,
    pmTiles: pmTilesWithLabels,
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

  const completedByPeriod = countCompletedPmsByAllPeriods(completedByKey, pmTiles, now);
  const completedMtd = completedByPeriod.mtd;

  const dueMtd = pmTiles.filter((tile) => {
    if (!tile.nextDueDate) return false;
    return isDateInCurrentMonth(tile.nextDueDate, now) || tile.urgency === "past_due";
  }).length;

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
