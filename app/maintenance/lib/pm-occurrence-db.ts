import { SupabaseClient } from "@supabase/supabase-js";
import {
  PmOccurrence,
  PmOccurrenceResponses,
} from "./maintenance-types";
import { fetchPmTemplateById } from "./pm-db";
import { getActiveDueDate } from "./schedule-engine";

type OccurrenceRow = {
  id: number;
  template_id: number;
  assignment_id: number;
  due_date: string;
  status: string;
  responses: PmOccurrenceResponses;
  session_notes: string | null;
  started_at: string | null;
  completed_at: string | null;
  completed_by: string | null;
  created_at: string;
};

function normalizeOccurrence(row: OccurrenceRow): PmOccurrence {
  return {
    id: Number(row.id),
    templateId: Number(row.template_id),
    assignmentId: Number(row.assignment_id),
    dueDate: String(row.due_date),
    status: row.status as PmOccurrence["status"],
    responses: (row.responses as PmOccurrenceResponses) || { steps: [] },
    sessionNotes: row.session_notes ? String(row.session_notes) : null,
    startedAt: row.started_at ? String(row.started_at) : null,
    completedAt: row.completed_at ? String(row.completed_at) : null,
    completedBy: row.completed_by ? String(row.completed_by) : null,
    createdAt: String(row.created_at),
  };
}

export async function fetchPmOccurrenceById(
  supabase: SupabaseClient,
  id: number
): Promise<PmOccurrence | null> {
  const { data, error } = await supabase
    .from("pm_occurrences")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) return null;
  return normalizeOccurrence(data as OccurrenceRow);
}

export async function startPmOccurrence(
  supabase: SupabaseClient,
  input: {
    assignmentId: number;
    templateId: number;
    dueDate: string;
  }
): Promise<PmOccurrence> {
  const { data: existing, error: existingError } = await supabase
    .from("pm_occurrences")
    .select("*")
    .eq("assignment_id", input.assignmentId)
    .eq("due_date", input.dueDate)
    .eq("status", "open")
    .maybeSingle();

  if (existingError) throw new Error(existingError.message);
  if (existing) {
    return normalizeOccurrence(existing as OccurrenceRow);
  }

  const { data, error } = await supabase
    .from("pm_occurrences")
    .insert({
      template_id: input.templateId,
      assignment_id: input.assignmentId,
      due_date: input.dueDate,
      status: "open",
      started_at: new Date().toISOString(),
      responses: { steps: [] },
    })
    .select("*")
    .single();

  if (error) throw new Error(error.message);
  return normalizeOccurrence(data as OccurrenceRow);
}

export async function resolvePmOccurrenceForAssignment(
  supabase: SupabaseClient,
  assignmentId: number
): Promise<PmOccurrence> {
  const { data: assignment, error: assignmentError } = await supabase
    .from("pm_schedule_assignments")
    .select("*, pm_templates(*)")
    .eq("id", assignmentId)
    .single();

  if (assignmentError) throw new Error(assignmentError.message);

  const template = assignment.pm_templates as {
    id: number;
    frequency: string;
    status: string;
  };

  const dueDate = getActiveDueDate(
    String(assignment.start_date),
    template.frequency as never,
    assignment.end_date ? String(assignment.end_date) : null
  );

  if (!dueDate) {
    throw new Error("This PM assignment has no active due date.");
  }

  return startPmOccurrence(supabase, {
    assignmentId,
    templateId: Number(template.id),
    dueDate,
  });
}

export async function updatePmOccurrence(
  supabase: SupabaseClient,
  id: number,
  patch: {
    responses?: PmOccurrenceResponses;
    sessionNotes?: string | null;
    status?: "open" | "completed" | "missed";
    completedBy?: string | null;
  }
): Promise<PmOccurrence> {
  const payload: Record<string, unknown> = {};

  if (patch.responses !== undefined) payload.responses = patch.responses;
  if (patch.sessionNotes !== undefined) payload.session_notes = patch.sessionNotes;
  if (patch.status !== undefined) {
    payload.status = patch.status;
    if (patch.status === "completed") {
      payload.completed_at = new Date().toISOString();
    }
  }
  if (patch.completedBy !== undefined) payload.completed_by = patch.completedBy;

  const { data, error } = await supabase
    .from("pm_occurrences")
    .update(payload)
    .eq("id", id)
    .select("*")
    .single();

  if (error) throw new Error(error.message);
  return normalizeOccurrence(data as OccurrenceRow);
}

export async function fetchPmOccurrenceDetail(
  supabase: SupabaseClient,
  id: number
) {
  const occurrence = await fetchPmOccurrenceById(supabase, id);
  if (!occurrence) return null;

  const templateResult = await fetchPmTemplateById(supabase, occurrence.templateId);
  if (!templateResult) return null;

  const { template } = templateResult;

  const { data: assignment, error } = await supabase
    .from("pm_schedule_assignments")
    .select("area_id, asset_label, pm_templates(name, checklist, frequency, category)")
    .eq("id", occurrence.assignmentId)
    .single();

  if (error) throw new Error(error.message);

  let areaName: string | null = null;
  if (assignment.area_id) {
    const { data: area } = await supabase
      .from("buildings_and_areas")
      .select("name")
      .eq("id", assignment.area_id)
      .maybeSingle();
    areaName = area?.name ? String(area.name) : null;
  }

  return {
    occurrence,
    templateName: template.name,
    checklist: template.checklist,
    frequency: template.frequency,
    category: template.category,
    areaId: assignment.area_id ? Number(assignment.area_id) : null,
    areaName,
    assetLabel: assignment.asset_label ? String(assignment.asset_label) : null,
  };
}
