import { SupabaseClient } from "@supabase/supabase-js";
import { PmFrequency } from "./pm-types";
import { PmTenantScope } from "./pm-db";
import {
  enumeratePastDueDatesBeforeActive,
  getActiveDueDateForAssignment,
} from "./pm-cycle";

export type ReconcileSchedule = {
  assignmentId: number;
  templateId: number;
  startDate: string;
  endDate: string | null;
  frequency: PmFrequency;
};

type OccurrenceRow = {
  id: number;
  assignment_id: number;
  due_date: string;
  status: string;
};

export async function reconcilePmMissedCycles(
  supabase: SupabaseClient,
  schedules: ReconcileSchedule[],
  now = new Date(),
  scope?: PmTenantScope
): Promise<void> {
  if (schedules.length === 0) return;

  const assignmentIds = schedules.map((schedule) => schedule.assignmentId);
  let occurrenceQuery = supabase
    .from("pm_occurrences")
    .select("id, assignment_id, due_date, status")
    .in("assignment_id", assignmentIds);

  if (scope) {
    occurrenceQuery = occurrenceQuery
      .eq("organization_id", scope.organizationId)
      .eq("property_id", scope.propertyId);
  }

  const { data, error } = await occurrenceQuery;

  if (error) throw new Error(error.message);

  const rows = (data || []) as OccurrenceRow[];
  const byKey = new Map<string, OccurrenceRow>();
  for (const row of rows) {
    byKey.set(`${row.assignment_id}::${row.due_date}`, row);
  }

  const toInsert: {
    template_id: number;
    assignment_id: number;
    due_date: string;
    status: "missed";
    organization_id?: number;
    property_id?: number;
  }[] = [];
  const toMarkMissed: number[] = [];

  for (const schedule of schedules) {
    const activeDue = getActiveDueDateForAssignment(
      schedule.startDate,
      schedule.frequency,
      schedule.endDate,
      now
    );
    if (!activeDue) continue;

    const pastDueDates = enumeratePastDueDatesBeforeActive(
      schedule.startDate,
      schedule.frequency,
      schedule.endDate,
      activeDue,
      now
    );

    for (const dueDate of pastDueDates) {
      const key = `${schedule.assignmentId}::${dueDate}`;
      const existing = byKey.get(key);

      if (existing?.status === "completed" || existing?.status === "missed") {
        continue;
      }

      if (existing?.status === "open") {
        toMarkMissed.push(existing.id);
        continue;
      }

      toInsert.push({
        template_id: schedule.templateId,
        assignment_id: schedule.assignmentId,
        due_date: dueDate,
        status: "missed",
        ...(scope
          ? {
              organization_id: scope.organizationId,
              property_id: scope.propertyId,
            }
          : {}),
      });
    }
  }

  if (toMarkMissed.length > 0) {
    let updateQuery = supabase
      .from("pm_occurrences")
      .update({ status: "missed" })
      .in("id", toMarkMissed);

    if (scope) {
      updateQuery = updateQuery
        .eq("organization_id", scope.organizationId)
        .eq("property_id", scope.propertyId);
    }

    const { error: updateError } = await updateQuery;

    if (updateError) throw new Error(updateError.message);
  }

  if (toInsert.length > 0) {
    const { error: insertError } = await supabase
      .from("pm_occurrences")
      .insert(toInsert);

    if (insertError) throw new Error(insertError.message);
  }
}
