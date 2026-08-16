import type { SupabaseClient } from "@supabase/supabase-js";
import { TenantRequestError } from "@/app/lib/tenant/server/resolve-tenant-request";
import type {
  PmOccurrence,
  PmOccurrenceResponses,
  PmTargetOutcome,
} from "./maintenance-types";
import { fetchPmTemplateById, type PmTenantScope } from "./pm-db";
import { fetchPmOccurrenceById, startPmOccurrence, updatePmOccurrence } from "./pm-occurrence-db";
import { getActiveDueDate } from "./schedule-engine";

type ProgramAssignment = {
  id: number;
  area_id: number | null;
  asset_label: string | null;
  start_date: string;
  end_date: string | null;
  status: string;
};

export type PmProgramSessionTarget = {
  assignmentId: number;
  occurrenceId: number | null;
  dueDate: string;
  areaId: number | null;
  areaName: string | null;
  assetLabel: string | null;
  outcome: PmTargetOutcome | null;
  notes: string;
  photoUrl: string | null;
  occurrenceStatus: PmOccurrence["status"] | null;
};

export type PmProgramSession = {
  templateId: number;
  templateName: string;
  assignmentType: "area_location" | "equipment_unit";
  frequency: string;
  checklist: ReturnType<typeof normalizeChecklist>;
  responses: PmOccurrenceResponses;
  sessionNotes: string | null;
  status: "open" | "completed";
  targets: PmProgramSessionTarget[];
  uploadOccurrenceId: number | null;
  createdBy: string | null;
  savedBy: string | null;
  savedAt: string | null;
  completedBy: string | null;
  completedAt: string | null;
  nextDueDate: string | null;
  lastCompletedBy: string | null;
  lastCompletedAt: string | null;
};

function normalizeChecklist(value: unknown) {
  return (value || { categories: [] }) as {
    categories: Array<{
      key: string;
      name: string;
      sortOrder: number;
      steps: Array<{
        key: string;
        label: string;
        required: boolean;
        photoRequiredOnFail: boolean;
        sortOrder: number;
      }>;
    }>;
  };
}

function normalizeTargetOutcome(
  occurrence: PmOccurrence | null
): PmTargetOutcome | null {
  const outcome = occurrence?.responses?.targetOutcome;
  if (outcome === "pass" || outcome === "fail" || outcome === "na") {
    return outcome;
  }
  // Preserve existing grouped PM history created before target-level
  // Pass/Fail/N/A was introduced.
  if (outcome === "complete") return "pass";
  if (outcome === "issue_found") return "fail";
  return occurrence?.status === "completed" ? "pass" : null;
}

async function loadProgramState(
  supabase: SupabaseClient,
  templateId: number,
  scope: PmTenantScope
) {
  const result = await fetchPmTemplateById(supabase, templateId, scope);
  if (!result) {
    throw new TenantRequestError(404, "PM program not found");
  }

  const assignments = (result.assignments as ProgramAssignment[])
    .filter((assignment) => assignment.status === "Active")
    .sort((a, b) => Number(a.id) - Number(b.id));
  if (assignments.length < 1) {
    throw new TenantRequestError(
      400,
      "A PM program requires at least one active item"
    );
  }

  const assignmentStates = assignments.map((assignment) => {
    const dueDate = getActiveDueDate(
      String(assignment.start_date),
      result.template.frequency,
      assignment.end_date ? String(assignment.end_date) : null
    );
    if (!dueDate) {
      throw new TenantRequestError(
        400,
        "One or more PM assignments has no active due date"
      );
    }
    return { assignment, dueDate };
  });

  const areaIds = Array.from(
    new Set(
      assignments
        .map((assignment) => assignment.area_id)
        .filter((id): id is number => typeof id === "number" && id > 0)
    )
  );
  const areaNameById = new Map<number, string>();
  if (areaIds.length > 0) {
    const { data, error } = await supabase
      .from("buildings_and_areas")
      .select("id, name")
      .in("id", areaIds)
      .eq("organization_id", scope.organizationId)
      .eq("property_id", scope.propertyId);
    if (error) throw new Error(error.message);
    for (const area of data || []) {
      areaNameById.set(Number(area.id), String(area.name));
    }
  }

  const assignmentIds = assignments.map((assignment) => Number(assignment.id));
  const dueDates = Array.from(
    new Set(assignmentStates.map((state) => state.dueDate))
  );
  const { data: occurrenceRows, error: occurrenceError } = await supabase
    .from("pm_occurrences")
    .select("id, assignment_id, due_date, status")
    .in("assignment_id", assignmentIds)
    .in("due_date", dueDates)
    .in("status", ["open", "completed"])
    .eq("organization_id", scope.organizationId)
    .eq("property_id", scope.propertyId)
    .order("id", { ascending: false });
  if (occurrenceError) throw new Error(occurrenceError.message);

  const { data: lastCompletedRows, error: lastCompletedError } = await supabase
    .from("pm_occurrences")
    .select("completed_at, completed_by")
    .eq("template_id", templateId)
    .eq("status", "completed")
    .eq("organization_id", scope.organizationId)
    .eq("property_id", scope.propertyId)
    .not("completed_at", "is", null)
    .order("completed_at", { ascending: false })
    .limit(1);
  if (lastCompletedError) throw new Error(lastCompletedError.message);

  const occurrenceIdByKey = new Map<string, number>();
  for (const row of occurrenceRows || []) {
    const key = `${Number(row.assignment_id)}::${String(row.due_date)}`;
    if (!occurrenceIdByKey.has(key) || row.status === "completed") {
      occurrenceIdByKey.set(key, Number(row.id));
    }
  }

  const states = await Promise.all(
    assignmentStates.map(async ({ assignment, dueDate }) => {
      const occurrenceId =
        occurrenceIdByKey.get(`${Number(assignment.id)}::${dueDate}`) ?? null;
      const occurrence = occurrenceId
        ? await fetchPmOccurrenceById(supabase, occurrenceId, scope)
        : null;
      return {
        assignment,
        dueDate,
        occurrence,
        areaName: assignment.area_id
          ? areaNameById.get(Number(assignment.area_id)) || null
          : null,
      };
    })
  );

  return {
    template: result.template,
    states,
    lastCompleted: lastCompletedRows?.[0] || null,
  };
}

function buildSession(
  state: Awaited<ReturnType<typeof loadProgramState>>
): PmProgramSession {
  const occurrences = state.states
    .map((entry) => entry.occurrence)
    .filter((occurrence): occurrence is PmOccurrence => Boolean(occurrence));
  const sharedOccurrence =
    occurrences
      .filter((occurrence) => occurrence.status === "open")
      .sort(
        (a, b) =>
          (b.responses?.steps?.length || 0) - (a.responses?.steps?.length || 0)
      )[0] ||
    occurrences[0] ||
    null;
  const allCompleted =
    state.states.length > 0 &&
    state.states.every((entry) => entry.occurrence?.status === "completed");

  return {
    templateId: state.template.id,
    templateName: state.template.name,
    assignmentType: state.template.assignmentType,
    frequency: state.template.frequency,
    checklist: normalizeChecklist(state.template.checklist),
    responses: {
      steps: sharedOccurrence?.responses?.steps || [],
    },
    sessionNotes: sharedOccurrence?.sessionNotes || null,
    status: allCompleted ? "completed" : "open",
    targets: state.states.map((entry) => ({
      assignmentId: Number(entry.assignment.id),
      occurrenceId: entry.occurrence?.id ?? null,
      dueDate: entry.dueDate,
      areaId: entry.assignment.area_id
        ? Number(entry.assignment.area_id)
        : null,
      areaName: entry.areaName,
      assetLabel: entry.assignment.asset_label
        ? String(entry.assignment.asset_label)
        : null,
      outcome: normalizeTargetOutcome(entry.occurrence),
      notes: entry.occurrence?.responses?.targetNotes || "",
      photoUrl: entry.occurrence?.responses?.targetPhotoUrl || null,
      occurrenceStatus: entry.occurrence?.status ?? null,
    })),
    uploadOccurrenceId:
      occurrences.find((occurrence) => occurrence.status === "open")?.id ??
      occurrences[0]?.id ??
      null,
    createdBy: sharedOccurrence?.createdBy || null,
    savedBy: sharedOccurrence?.lastSavedBy || null,
    savedAt: sharedOccurrence?.lastSavedAt || null,
    completedBy: allCompleted
      ? occurrences.find((occurrence) => occurrence.completedBy)?.completedBy ||
        null
      : null,
    completedAt: allCompleted
      ? occurrences
          .map((occurrence) => occurrence.completedAt)
          .filter((value): value is string => Boolean(value))
          .sort()
          .at(-1) || null
      : null,
    nextDueDate:
      state.states
        .map((entry) => entry.dueDate)
        .sort((left, right) => left.localeCompare(right))[0] || null,
    lastCompletedBy: state.lastCompleted?.completed_by
      ? String(state.lastCompleted.completed_by)
      : null,
    lastCompletedAt: state.lastCompleted?.completed_at
      ? String(state.lastCompleted.completed_at)
      : null,
  };
}

export async function fetchPmProgramSession(
  supabase: SupabaseClient,
  templateId: number,
  scope: PmTenantScope
): Promise<PmProgramSession> {
  return buildSession(await loadProgramState(supabase, templateId, scope));
}

export async function startPmProgramSession(
  supabase: SupabaseClient,
  templateId: number,
  createdBy: string | null,
  scope: PmTenantScope
): Promise<PmProgramSession> {
  const state = await loadProgramState(supabase, templateId, scope);
  for (const entry of state.states) {
    if (entry.occurrence) continue;
    await startPmOccurrence(
      supabase,
      {
        assignmentId: Number(entry.assignment.id),
        templateId,
        dueDate: entry.dueDate,
        createdBy,
      },
      scope
    );
  }
  return fetchPmProgramSession(supabase, templateId, scope);
}

export async function savePmProgramSession(
  supabase: SupabaseClient,
  templateId: number,
  input: {
    responses: PmOccurrenceResponses;
    sessionNotes?: string | null;
    targetOutcomes: Record<string, PmTargetOutcome | null>;
    targetNotes: Record<string, string>;
    targetPhotoUrls: Record<string, string | null>;
    complete?: boolean;
    actor: string | null;
  },
  scope: PmTenantScope
): Promise<PmProgramSession> {
  const session = await startPmProgramSession(
    supabase,
    templateId,
    input.actor,
    scope
  );
  const primaryAssignmentId = session.targets[0]?.assignmentId ?? null;
  for (const target of session.targets) {
    const assignmentKey = String(target.assignmentId);
    const outcome = Object.prototype.hasOwnProperty.call(
      input.targetOutcomes,
      assignmentKey
    )
      ? input.targetOutcomes[assignmentKey]
      : target.outcome;
    const notes = Object.prototype.hasOwnProperty.call(
      input.targetNotes,
      assignmentKey
    )
      ? input.targetNotes[assignmentKey]
      : target.notes;
    const photoUrl = Object.prototype.hasOwnProperty.call(
      input.targetPhotoUrls,
      assignmentKey
    )
      ? input.targetPhotoUrls[assignmentKey]
      : target.photoUrl;
    if (
      outcome !== null &&
      outcome !== "pass" &&
      outcome !== "fail" &&
      outcome !== "na"
    ) {
      throw new TenantRequestError(400, "Invalid PM target outcome");
    }
    if (input.complete && !outcome) {
      throw new TenantRequestError(
        400,
        "Select Pass, Fail, or N/A for every PM item"
      );
    }
    if (!target.occurrenceId || target.occurrenceStatus === "completed") {
      continue;
    }

    await updatePmOccurrence(
      supabase,
      target.occurrenceId,
      {
        responses: {
          steps: input.responses?.steps || [],
          targetOutcome: outcome,
          targetNotes: notes || "",
          targetPhotoUrl: photoUrl || null,
          sharedChecklistPrimary:
            target.assignmentId === primaryAssignmentId,
        },
        sessionNotes: input.sessionNotes ?? null,
        savedBy: input.actor,
        status: input.complete ? "completed" : "open",
        completedBy: input.complete ? input.actor : undefined,
      },
      scope
    );
  }

  return fetchPmProgramSession(supabase, templateId, scope);
}
