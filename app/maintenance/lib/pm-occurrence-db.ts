import { SupabaseClient } from "@supabase/supabase-js";
import { TenantRequestError } from "@/app/lib/tenant/server/resolve-tenant-request";
import {
  PmOccurrence,
  PmOccurrenceResponses,
} from "./maintenance-types";
import { fetchPmTemplateById, PmTenantScope } from "./pm-db";
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
  created_by: string | null;
  last_saved_at: string | null;
  last_saved_by: string | null;
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
    createdBy: row.created_by ? String(row.created_by) : null,
    lastSavedAt: row.last_saved_at ? String(row.last_saved_at) : null,
    lastSavedBy: row.last_saved_by ? String(row.last_saved_by) : null,
  };
}

export async function assertPmOccurrenceInTenant(
  supabase: SupabaseClient,
  id: number,
  scope: PmTenantScope
): Promise<void> {
  const { data, error } = await supabase
    .from("pm_occurrences")
    .select("id")
    .eq("id", id)
    .eq("organization_id", scope.organizationId)
    .eq("property_id", scope.propertyId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new TenantRequestError(404, "PM session not found");
}

export async function fetchPmOccurrenceById(
  supabase: SupabaseClient,
  id: number,
  scope?: PmTenantScope
): Promise<PmOccurrence | null> {
  let query = supabase.from("pm_occurrences").select("*").eq("id", id);
  if (scope) {
    query = query
      .eq("organization_id", scope.organizationId)
      .eq("property_id", scope.propertyId);
  }

  const { data, error } = await query.maybeSingle();

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
    createdBy?: string | null;
  },
  scope?: PmTenantScope
): Promise<PmOccurrence> {
  let existingQuery = supabase
    .from("pm_occurrences")
    .select("*")
    .eq("assignment_id", input.assignmentId)
    .eq("due_date", input.dueDate)
    .eq("status", "open");

  if (scope) {
    existingQuery = existingQuery
      .eq("organization_id", scope.organizationId)
      .eq("property_id", scope.propertyId);
  }

  const { data: existing, error: existingError } = await existingQuery.maybeSingle();

  if (existingError) throw new Error(existingError.message);
  if (existing) {
    const normalized = normalizeOccurrence(existing as OccurrenceRow);
    if (!normalized.createdBy && input.createdBy) {
      let updateQuery = supabase
        .from("pm_occurrences")
        .update({ created_by: input.createdBy })
        .eq("id", normalized.id);
      if (scope) {
        updateQuery = updateQuery
          .eq("organization_id", scope.organizationId)
          .eq("property_id", scope.propertyId);
      }
      const { data, error } = await updateQuery.select("*").single();
      if (error) throw new Error(error.message);
      return normalizeOccurrence(data as OccurrenceRow);
    }
    return normalized;
  }

  const insertPayload: Record<string, unknown> = {
    template_id: input.templateId,
    assignment_id: input.assignmentId,
    due_date: input.dueDate,
    status: "open",
    started_at: new Date().toISOString(),
    created_by: input.createdBy ?? null,
    responses: { steps: [] },
  };

  if (scope) {
    insertPayload.organization_id = scope.organizationId;
    insertPayload.property_id = scope.propertyId;
  }

  const { data, error } = await supabase
    .from("pm_occurrences")
    .insert(insertPayload)
    .select("*")
    .single();

  if (error) throw new Error(error.message);
  return normalizeOccurrence(data as OccurrenceRow);
}

export async function resolvePmOccurrenceForAssignment(
  supabase: SupabaseClient,
  assignmentId: number,
  createdBy?: string | null,
  scope?: PmTenantScope
): Promise<PmOccurrence> {
  let assignmentQuery = supabase
    .from("pm_schedule_assignments")
    .select("*, pm_templates(*)")
    .eq("id", assignmentId);

  if (scope) {
    assignmentQuery = assignmentQuery
      .eq("organization_id", scope.organizationId)
      .eq("property_id", scope.propertyId);
  }

  const { data: assignment, error: assignmentError } = await assignmentQuery.single();

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

  return startPmOccurrence(
    supabase,
    {
      assignmentId,
      templateId: Number(template.id),
      dueDate,
      createdBy,
    },
    scope
  );
}

export async function updatePmOccurrence(
  supabase: SupabaseClient,
  id: number,
  patch: {
    responses?: PmOccurrenceResponses;
    sessionNotes?: string | null;
    status?: "open" | "completed" | "missed";
    completedBy?: string | null;
    savedBy?: string | null;
  },
  scope?: PmTenantScope
): Promise<PmOccurrence> {
  if (scope) {
    await assertPmOccurrenceInTenant(supabase, id, scope);
  }

  const payload: Record<string, unknown> = {};

  if (patch.responses !== undefined) payload.responses = patch.responses;
  if (patch.sessionNotes !== undefined) payload.session_notes = patch.sessionNotes;
  if (patch.savedBy !== undefined) {
    payload.last_saved_by = patch.savedBy;
    payload.last_saved_at = new Date().toISOString();
  }
  if (patch.status !== undefined) {
    payload.status = patch.status;
    if (patch.status === "completed") {
      payload.completed_at = new Date().toISOString();
      if (patch.completedBy !== undefined) {
        payload.completed_by = patch.completedBy;
      }
    }
  } else if (patch.completedBy !== undefined) {
    payload.completed_by = patch.completedBy;
  }

  let updateQuery = supabase.from("pm_occurrences").update(payload).eq("id", id);
  if (scope) {
    updateQuery = updateQuery
      .eq("organization_id", scope.organizationId)
      .eq("property_id", scope.propertyId);
  }

  const { data, error } = await updateQuery.select("*").single();

  if (error) throw new Error(error.message);
  return normalizeOccurrence(data as OccurrenceRow);
}

export async function fetchPmOccurrenceDetail(
  supabase: SupabaseClient,
  id: number,
  scope?: PmTenantScope
) {
  const occurrence = await fetchPmOccurrenceById(supabase, id, scope);
  if (!occurrence) return null;

  const templateResult = await fetchPmTemplateById(
    supabase,
    occurrence.templateId,
    scope
  );
  if (!templateResult) return null;

  const { template } = templateResult;

  let assignmentQuery = supabase
    .from("pm_schedule_assignments")
    .select("area_id, asset_label, pm_templates(name, checklist, frequency, category)")
    .eq("id", occurrence.assignmentId);

  if (scope) {
    assignmentQuery = assignmentQuery
      .eq("organization_id", scope.organizationId)
      .eq("property_id", scope.propertyId);
  }

  const { data: assignment, error } = await assignmentQuery.single();

  if (error) throw new Error(error.message);

  let areaName: string | null = null;
  if (assignment.area_id) {
    let areaQuery = supabase
      .from("buildings_and_areas")
      .select("name")
      .eq("id", assignment.area_id);

    if (scope) {
      areaQuery = areaQuery
        .eq("organization_id", scope.organizationId)
        .eq("property_id", scope.propertyId);
    }

    const { data: area } = await areaQuery.maybeSingle();
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
