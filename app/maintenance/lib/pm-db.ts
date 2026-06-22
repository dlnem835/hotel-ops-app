import { createClient, SupabaseClient } from "@supabase/supabase-js";
import {
  AreaPmGridSummary,
  PmAssignmentSchedule,
  PmChecklist,
  PmDueStatus,
  PmFrequency,
  PmTemplate,
  PmTemplateInput,
  PM_FREQUENCY_ORDER,
} from "./pm-types";
import { getActiveDueDate, getDueStatus } from "./schedule-engine";

export function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

type AssignmentRow = {
  id: number;
  template_id: number;
  area_id: number | null;
  asset_label: string | null;
  start_date: string;
  end_date: string | null;
  status: string;
  created_at: string;
};

type TemplateRow = {
  id: number;
  name: string;
  description: string | null;
  category: string;
  frequency: string;
  estimated_minutes: number | null;
  assigned_role: string | null;
  assigned_member_id: string | null;
  applies_to: string;
  checklist: PmChecklist;
  status: string;
  created_at: string;
  updated_at: string;
  pm_schedule_assignments: AssignmentRow[];
};

function normalizeTemplate(row: TemplateRow): PmTemplate {
  return {
    id: Number(row.id),
    name: String(row.name),
    description: row.description ? String(row.description) : null,
    category: row.category as PmTemplate["category"],
    frequency: row.frequency as PmFrequency,
    estimated_minutes:
      row.estimated_minutes === null || row.estimated_minutes === undefined
        ? null
        : Number(row.estimated_minutes),
    assigned_role: row.assigned_role ? String(row.assigned_role) : null,
    assigned_member_id: row.assigned_member_id
      ? String(row.assigned_member_id)
      : null,
    applies_to: row.applies_to as PmTemplate["applies_to"],
    checklist: (row.checklist as PmChecklist) || { categories: [] },
    status: row.status as PmTemplate["status"],
    created_at: String(row.created_at),
    updated_at: String(row.updated_at),
  };
}

function buildAssignmentSchedule(
  template: PmTemplate,
  assignment: AssignmentRow,
  areaName: string | null,
  now = new Date()
): PmAssignmentSchedule {
  const active =
    template.status === "Active" && assignment.status === "Active";
  const nextDueDate = active
    ? getActiveDueDate(
        String(assignment.start_date),
        template.frequency,
        assignment.end_date ? String(assignment.end_date) : null,
        now
      )
    : null;
  const dueStatus: PmDueStatus = active
    ? getDueStatus(nextDueDate, now)
    : "inactive";

  return {
    assignmentId: Number(assignment.id),
    templateId: template.id,
    templateName: template.name,
    frequency: template.frequency,
    category: template.category,
    areaId: assignment.area_id ? Number(assignment.area_id) : null,
    areaName,
    assetLabel: assignment.asset_label ? String(assignment.asset_label) : null,
    startDate: String(assignment.start_date),
    endDate: assignment.end_date ? String(assignment.end_date) : null,
    nextDueDate,
    dueStatus,
    templateStatus: template.status,
    assignmentStatus: assignment.status as PmTemplate["status"],
    estimatedMinutes: template.estimated_minutes,
    assignedRole: template.assigned_role,
  };
}

export async function fetchPmDashboardData(supabase: SupabaseClient) {
  const { data, error } = await supabase
    .from("pm_templates")
    .select("*, pm_schedule_assignments(*)")
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  const { data: areaRows, error: areaError } = await supabase
    .from("buildings_and_areas")
    .select("id, name, area_type, status")
    .neq("area_type", "Guest Room")
    .order("name");

  if (areaError) {
    throw new Error(areaError.message);
  }

  const areaNameById = new Map<number, string>();
  for (const area of areaRows || []) {
    areaNameById.set(Number(area.id), String(area.name));
  }

  const now = new Date();
  const schedules: PmAssignmentSchedule[] = [];

  for (const row of (data || []) as TemplateRow[]) {
    const template = normalizeTemplate(row);
    for (const assignment of row.pm_schedule_assignments || []) {
      const areaName = assignment.area_id
        ? areaNameById.get(Number(assignment.area_id)) || null
        : null;
      schedules.push(
        buildAssignmentSchedule(template, assignment, areaName, now)
      );
    }
  }

  schedules.sort((a, b) => {
    const freqDiff =
      PM_FREQUENCY_ORDER[a.frequency] - PM_FREQUENCY_ORDER[b.frequency];
    if (freqDiff !== 0) return freqDiff;
    return a.templateName.localeCompare(b.templateName);
  });

  const gridSummaries = buildAreaGridSummaries(
    (areaRows || []).map((area) => ({
      id: Number(area.id),
      name: String(area.name),
      area_type: String(area.area_type),
    })),
    schedules
  );

  return {
    templates: (data || []).map((row) => normalizeTemplate(row as TemplateRow)),
    schedules,
    gridSummaries,
  };
}

function buildAreaGridSummaries(
  areas: { id: number; name: string; area_type: string }[],
  schedules: PmAssignmentSchedule[]
): AreaPmGridSummary[] {
  return areas.map((area) => {
    const areaSchedules = schedules.filter(
      (entry) =>
        entry.areaId === area.id &&
        entry.templateStatus === "Active" &&
        entry.assignmentStatus === "Active"
    );

    if (areaSchedules.length === 0) {
      return {
        areaId: area.id,
        areaName: area.name,
        areaType: area.area_type,
        assignedCount: 0,
        nextDueDate: null,
        overdueCount: 0,
        marker: "missing" as const,
      };
    }

    const overdueCount = areaSchedules.filter(
      (entry) => entry.dueStatus === "overdue"
    ).length;
    const hasOverdue = overdueCount > 0;
    const hasDueSoon = areaSchedules.some(
      (entry) => entry.dueStatus === "due_soon"
    );

    const nextDueDate = areaSchedules
      .map((entry) => entry.nextDueDate)
      .filter((value): value is string => Boolean(value))
      .sort()[0];

    let marker: AreaPmGridSummary["marker"] = "none";
    if (hasOverdue) marker = "overdue";
    else if (hasDueSoon) marker = "due_soon";

    return {
      areaId: area.id,
      areaName: area.name,
      areaType: area.area_type,
      assignedCount: areaSchedules.length,
      nextDueDate: nextDueDate || null,
      overdueCount,
      marker,
    };
  });
}

export async function fetchPmTemplateById(
  supabase: SupabaseClient,
  id: number
) {
  const { data, error } = await supabase
    .from("pm_templates")
    .select("*, pm_schedule_assignments(*)")
    .eq("id", id)
    .single();

  if (error) {
    throw new Error(error.message);
  }

  const row = data as TemplateRow;
  const template = normalizeTemplate(row);
  const assignment = row.pm_schedule_assignments?.[0] || null;

  return { template, assignment };
}

export async function createPmTemplate(
  supabase: SupabaseClient,
  input: PmTemplateInput
) {
  const { data: templateRow, error: templateError } = await supabase
    .from("pm_templates")
    .insert({
      name: input.name,
      description: input.description || null,
      category: input.category,
      frequency: input.frequency,
      estimated_minutes: input.estimated_minutes ?? null,
      assigned_role: input.assigned_role || null,
      assigned_member_id: input.assigned_member_id || null,
      applies_to: input.applies_to,
      checklist: input.checklist,
      status: input.status || "Active",
    })
    .select("*")
    .single();

  if (templateError) {
    throw new Error(templateError.message);
  }

  const { data: assignmentRow, error: assignmentError } = await supabase
    .from("pm_schedule_assignments")
    .insert({
      template_id: templateRow.id,
      area_id: input.assignment.area_id ?? null,
      asset_label: input.assignment.asset_label || null,
      start_date: input.assignment.start_date,
      end_date: input.assignment.end_date || null,
      status: input.assignment.status || "Active",
    })
    .select("*")
    .single();

  if (assignmentError) {
    await supabase.from("pm_templates").delete().eq("id", templateRow.id);
    throw new Error(assignmentError.message);
  }

  return {
    template: normalizeTemplate({
      ...(templateRow as TemplateRow),
      pm_schedule_assignments: [],
    }),
    assignment: assignmentRow as AssignmentRow,
  };
}

export async function updatePmTemplate(
  supabase: SupabaseClient,
  id: number,
  input: PmTemplateInput
) {
  const { error: templateError } = await supabase
    .from("pm_templates")
    .update({
      name: input.name,
      description: input.description || null,
      category: input.category,
      frequency: input.frequency,
      estimated_minutes: input.estimated_minutes ?? null,
      assigned_role: input.assigned_role || null,
      assigned_member_id: input.assigned_member_id || null,
      applies_to: input.applies_to,
      checklist: input.checklist,
      status: input.status || "Active",
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (templateError) {
    throw new Error(templateError.message);
  }

  const { data: existingAssignments, error: fetchError } = await supabase
    .from("pm_schedule_assignments")
    .select("id")
    .eq("template_id", id)
    .limit(1);

  if (fetchError) {
    throw new Error(fetchError.message);
  }

  const assignmentPayload = {
    area_id: input.assignment.area_id ?? null,
    asset_label: input.assignment.asset_label || null,
    start_date: input.assignment.start_date,
    end_date: input.assignment.end_date || null,
    status: input.assignment.status || "Active",
  };

  if (existingAssignments?.[0]) {
    const { error: assignmentError } = await supabase
      .from("pm_schedule_assignments")
      .update(assignmentPayload)
      .eq("id", existingAssignments[0].id);

    if (assignmentError) {
      throw new Error(assignmentError.message);
    }
  } else {
    const { error: assignmentError } = await supabase
      .from("pm_schedule_assignments")
      .insert({
        template_id: id,
        ...assignmentPayload,
      });

    if (assignmentError) {
      throw new Error(assignmentError.message);
    }
  }

  return fetchPmTemplateById(supabase, id);
}

export async function deletePmTemplate(supabase: SupabaseClient, id: number) {
  const { error } = await supabase.from("pm_templates").delete().eq("id", id);
  if (error) {
    throw new Error(error.message);
  }
}
