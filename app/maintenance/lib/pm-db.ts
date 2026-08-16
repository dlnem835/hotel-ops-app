import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { TenantRequestError } from "@/app/lib/tenant/server/resolve-tenant-request";
import { derivePmCategory } from "./pm-category";
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

export type PmTenantScope = {
  organizationId: number;
  propertyId: number;
};

export async function assertPmTemplateInTenant(
  supabase: SupabaseClient,
  id: number,
  scope: PmTenantScope
): Promise<void> {
  const { data, error } = await supabase
    .from("pm_templates")
    .select("id")
    .eq("id", id)
    .eq("organization_id", scope.organizationId)
    .eq("property_id", scope.propertyId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new TenantRequestError(404, "PM template not found");
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
  standard_key: string | null;
  assignment_type: string;
  named_locations: boolean;
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
    standardKey: row.standard_key ? String(row.standard_key) : null,
    assignmentType:
      row.assignment_type === "equipment_unit"
        ? "equipment_unit"
        : "area_location",
    namedLocations: Boolean(row.named_locations),
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
    standardKey: template.standardKey,
    assignmentType: template.assignmentType,
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

export async function fetchPmDashboardData(
  supabase: SupabaseClient,
  scope?: PmTenantScope
) {
  let templatesQuery = supabase
    .from("pm_templates")
    .select("*, pm_schedule_assignments(*)")
    .order("created_at", { ascending: false });

  if (scope) {
    templatesQuery = templatesQuery
      .eq("organization_id", scope.organizationId)
      .eq("property_id", scope.propertyId);
  }

  const { data, error } = await templatesQuery;

  if (error) {
    throw new Error(error.message);
  }

  let areasQuery = supabase
    .from("buildings_and_areas")
    .select("id, name, area_type, status")
    .neq("area_type", "Guest Room")
    .order("name");

  if (scope) {
    areasQuery = areasQuery
      .eq("organization_id", scope.organizationId)
      .eq("property_id", scope.propertyId);
  }

  const { data: areaRows, error: areaError } = await areasQuery;

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
      if (String(assignment.status) !== "Active") continue;
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
  id: number,
  scope?: PmTenantScope
) {
  let query = supabase
    .from("pm_templates")
    .select("*, pm_schedule_assignments(*)")
    .eq("id", id);

  if (scope) {
    query = query
      .eq("organization_id", scope.organizationId)
      .eq("property_id", scope.propertyId);
  }

  const { data, error } = await query.single();

  if (error) {
    throw new Error(error.message);
  }

  const row = data as TemplateRow;
  const template = normalizeTemplate(row);
  const assignments = row.pm_schedule_assignments || [];
  const assignment =
    assignments.find((entry) => String(entry.status) === "Active") ||
    assignments[0] ||
    null;

  return {
    template,
    assignment,
    assignments,
  };
}

async function resolveTemplateCategory(
  supabase: SupabaseClient,
  input: PmTemplateInput,
  scope?: PmTenantScope
): Promise<PmTemplate["category"]> {
  if (input.category) {
    return input.category;
  }

  let areaType: string | null = null;
  let areaName: string | null = null;

  if (input.assignment.area_id) {
    let areaQuery = supabase
      .from("buildings_and_areas")
      .select("area_type, name")
      .eq("id", input.assignment.area_id);

    if (scope) {
      areaQuery = areaQuery
        .eq("organization_id", scope.organizationId)
        .eq("property_id", scope.propertyId);
    }

    const { data } = await areaQuery.maybeSingle();

    areaType = data?.area_type ? String(data.area_type) : null;
    areaName = data?.name ? String(data.name) : null;
  }

  return derivePmCategory({
    areaType,
    areaName,
    customAreaLabel: input.assignment.asset_label,
    templateName: input.name,
  });
}

async function assertPmAreasInTenant(
  supabase: SupabaseClient,
  areaIds: number[],
  scope?: PmTenantScope
) {
  if (!scope || areaIds.length === 0) return;

  const { data, error } = await supabase
    .from("buildings_and_areas")
    .select("id")
    .in("id", areaIds)
    .eq("organization_id", scope.organizationId)
    .eq("property_id", scope.propertyId);

  if (error) throw new Error(error.message);
  if ((data || []).length !== areaIds.length) {
    throw new TenantRequestError(400, "One or more selected PM areas are invalid");
  }
}

export async function createPmTemplate(
  supabase: SupabaseClient,
  input: PmTemplateInput,
  scope?: PmTenantScope
) {
  const category = await resolveTemplateCategory(supabase, input, scope);
  const isEquipmentPm = input.assignment_type === "equipment_unit";
  const usesNamedTargets = isEquipmentPm || Boolean(input.named_locations);
  const targetNoun = isEquipmentPm ? "equipment unit" : "location";
  const units = (input.units || []).map((unit) => ({
    assignment_id: unit.assignment_id,
    name: unit.name.trim(),
    area_id: unit.area_id ?? null,
  }));
  if (usesNamedTargets && units.some((unit) => !unit.name)) {
    throw new TenantRequestError(400, `Each ${targetNoun} requires a name`);
  }
  if (usesNamedTargets && units.length === 0) {
    throw new TenantRequestError(400, `Add at least one ${targetNoun}`);
  }
  const unitAssignmentIds = units
    .map((unit) => unit.assignment_id)
    .filter((assignmentId): assignmentId is number => Boolean(assignmentId));
  if (
    usesNamedTargets &&
    new Set(unitAssignmentIds).size !== unitAssignmentIds.length
  ) {
    throw new TenantRequestError(400, "PM target assignments must be unique");
  }

  const areaIds = Array.from(
    new Set(
      (usesNamedTargets
        ? units.map((unit) => unit.area_id)
        : input.assignment.area_ids?.length
          ? input.assignment.area_ids
          : input.assignment.area_id
            ? [input.assignment.area_id]
            : []
      ).filter(
        (id): id is number =>
          typeof id === "number" && Number.isInteger(id) && id > 0
      )
    )
  );
  await assertPmAreasInTenant(supabase, areaIds, scope);

  const templateInsert: Record<string, unknown> = {
    name: input.name,
    description: input.description || null,
    category,
    frequency: input.frequency,
    estimated_minutes: input.estimated_minutes ?? null,
    assigned_role: input.assigned_role || "Maintenance",
    assigned_member_id: input.assigned_member_id || null,
    applies_to: input.applies_to || "asset",
    checklist: input.checklist,
    status: input.status || "Active",
    assignment_type: input.assignment_type || "area_location",
    named_locations: Boolean(input.named_locations),
  };

  if (scope) {
    templateInsert.organization_id = scope.organizationId;
    templateInsert.property_id = scope.propertyId;
  }

  const { data: templateRow, error: templateError } = await supabase
    .from("pm_templates")
    .insert(templateInsert)
    .select("*")
    .single();

  if (templateError) {
    throw new Error(templateError.message);
  }

  const assignmentRows = (
    usesNamedTargets
      ? units.map((unit) => ({
          area_id: unit.area_id,
          asset_label: unit.name,
        }))
      : input.assignment.unassigned
        ? []
        : areaIds.length > 0
          ? areaIds.map((areaId) => ({
              area_id: areaId,
              asset_label: null,
            }))
          : [
              {
                area_id: null,
                asset_label: input.assignment.asset_label || null,
              },
            ]
  ).map((assignment) => ({
      template_id: templateRow.id,
      area_id: assignment.area_id,
      asset_label: assignment.asset_label,
      start_date: input.assignment.start_date,
      end_date: input.assignment.end_date || null,
      status: input.assignment.status || "Active",
    }));

  const assignmentResult =
    assignmentRows.length > 0
      ? await supabase
          .from("pm_schedule_assignments")
          .insert(assignmentRows)
          .select("*")
      : { data: [], error: null };
  const { data: createdAssignments, error: assignmentError } = assignmentResult;

  if (assignmentError) {
    await supabase.from("pm_templates").delete().eq("id", templateRow.id);
    throw new Error(assignmentError.message);
  }

  return {
    template: normalizeTemplate({
      ...(templateRow as TemplateRow),
      pm_schedule_assignments: [],
    }),
    assignment: (createdAssignments?.[0] as AssignmentRow | undefined) || null,
    assignments: (createdAssignments || []) as AssignmentRow[],
  };
}

export async function updatePmTemplate(
  supabase: SupabaseClient,
  id: number,
  input: PmTemplateInput,
  scope?: PmTenantScope
) {
  if (scope) {
    await assertPmTemplateInTenant(supabase, id, scope);
  }

  const category = await resolveTemplateCategory(supabase, input, scope);

  let templateUpdate = supabase
    .from("pm_templates")
    .update({
      name: input.name,
      description: input.description || null,
      category,
      frequency: input.frequency,
      estimated_minutes: input.estimated_minutes ?? null,
      assigned_role: input.assigned_role || "Maintenance",
      assigned_member_id: input.assigned_member_id || null,
      applies_to: input.applies_to || "asset",
      checklist: input.checklist,
      status: input.status || "Active",
      assignment_type: input.assignment_type || "area_location",
      named_locations: Boolean(input.named_locations),
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (scope) {
    templateUpdate = templateUpdate
      .eq("organization_id", scope.organizationId)
      .eq("property_id", scope.propertyId);
  }

  const { error: templateError } = await templateUpdate;

  if (templateError) {
    throw new Error(templateError.message);
  }

  const { data: existingAssignments, error: fetchError } = await supabase
    .from("pm_schedule_assignments")
    .select("id, area_id, asset_label, status")
    .eq("template_id", id);

  if (fetchError) {
    throw new Error(fetchError.message);
  }

  const isEquipmentPm = input.assignment_type === "equipment_unit";
  const usesNamedTargets = isEquipmentPm || Boolean(input.named_locations);
  const targetNoun = isEquipmentPm ? "equipment unit" : "location";
  const units = (input.units || []).map((unit) => ({
    assignment_id: unit.assignment_id,
    name: unit.name.trim(),
    area_id: unit.area_id ?? null,
  }));
  if (usesNamedTargets && units.some((unit) => !unit.name)) {
    throw new TenantRequestError(400, `Each ${targetNoun} requires a name`);
  }
  if (usesNamedTargets && units.length === 0) {
    throw new TenantRequestError(400, `Add at least one ${targetNoun}`);
  }
  const updateUnitAssignmentIds = units
    .map((unit) => unit.assignment_id)
    .filter((assignmentId): assignmentId is number => Boolean(assignmentId));
  if (
    usesNamedTargets &&
    new Set(updateUnitAssignmentIds).size !== updateUnitAssignmentIds.length
  ) {
    throw new TenantRequestError(400, "PM target assignments must be unique");
  }

  const areaIds = Array.from(
    new Set(
      (usesNamedTargets
        ? units.map((unit) => unit.area_id)
        : input.assignment.area_ids?.length
          ? input.assignment.area_ids
          : input.assignment.area_id
            ? [input.assignment.area_id]
            : []
      ).filter(
        (areaId): areaId is number =>
          typeof areaId === "number" &&
          Number.isInteger(areaId) &&
          areaId > 0
      )
    )
  );
  await assertPmAreasInTenant(supabase, areaIds, scope);

  const assignmentSchedule = {
    start_date: input.assignment.start_date,
    end_date: input.assignment.end_date || null,
    status: input.assignment.status || "Active",
  };

  if (usesNamedTargets) {
    const existingById = new Map(
      (existingAssignments || []).map((assignment) => [
        Number(assignment.id),
        assignment,
      ])
    );
    const retainedIds = new Set<number>();

    for (const unit of units) {
      if (unit.assignment_id) {
        const existing = existingById.get(unit.assignment_id);
        if (!existing) {
          throw new TenantRequestError(400, `Invalid ${targetNoun} assignment`);
        }
        retainedIds.add(unit.assignment_id);
        const { error } = await supabase
          .from("pm_schedule_assignments")
          .update({
            area_id: unit.area_id,
            asset_label: unit.name,
            ...assignmentSchedule,
          })
          .eq("id", unit.assignment_id)
          .eq("template_id", id);
        if (error) throw new Error(error.message);
      } else {
        const { data, error } = await supabase
          .from("pm_schedule_assignments")
          .insert({
            template_id: id,
            area_id: unit.area_id,
            asset_label: unit.name,
            ...assignmentSchedule,
          })
          .select("id")
          .single();
        if (error) throw new Error(error.message);
        retainedIds.add(Number(data.id));
      }
    }

    for (const assignment of existingAssignments || []) {
      if (
        !retainedIds.has(Number(assignment.id)) &&
        assignment.status !== "Inactive"
      ) {
        const { error } = await supabase
          .from("pm_schedule_assignments")
          .update({ status: "Inactive" })
          .eq("id", assignment.id)
          .eq("template_id", id);
        if (error) throw new Error(error.message);
      }
    }
  } else if (areaIds.length > 0) {
    const selectedAreaIds = new Set(areaIds);
    const existingAreaIds = new Set<number>();

    for (const assignment of existingAssignments || []) {
      const assignmentAreaId = assignment.area_id ? Number(assignment.area_id) : null;
      if (assignmentAreaId && selectedAreaIds.has(assignmentAreaId)) {
        existingAreaIds.add(assignmentAreaId);
        const { error } = await supabase
          .from("pm_schedule_assignments")
          .update({
            area_id: assignmentAreaId,
            asset_label: null,
            ...assignmentSchedule,
          })
          .eq("id", assignment.id);
        if (error) throw new Error(error.message);
      } else if (assignment.status !== "Inactive") {
        const { error } = await supabase
          .from("pm_schedule_assignments")
          .update({ status: "Inactive" })
          .eq("id", assignment.id);
        if (error) throw new Error(error.message);
      }
    }

    const newAreaIds = areaIds.filter((areaId) => !existingAreaIds.has(areaId));
    if (newAreaIds.length > 0) {
      const { error } = await supabase.from("pm_schedule_assignments").insert(
        newAreaIds.map((areaId) => ({
          template_id: id,
          area_id: areaId,
          asset_label: null,
          ...assignmentSchedule,
        }))
      );
      if (error) throw new Error(error.message);
    }
  } else {
    const customAssignment = (existingAssignments || []).find(
      (assignment) => assignment.area_id === null
    );

    for (const assignment of existingAssignments || []) {
      if (assignment.id === customAssignment?.id) continue;
      if (assignment.status !== "Inactive") {
        const { error } = await supabase
          .from("pm_schedule_assignments")
          .update({ status: "Inactive" })
          .eq("id", assignment.id);
        if (error) throw new Error(error.message);
      }
    }

    if (customAssignment) {
      const { error } = await supabase
        .from("pm_schedule_assignments")
        .update({
          area_id: null,
          asset_label: input.assignment.asset_label || null,
          ...assignmentSchedule,
        })
        .eq("id", customAssignment.id);
      if (error) throw new Error(error.message);
    } else {
      const { error } = await supabase.from("pm_schedule_assignments").insert({
        template_id: id,
        area_id: null,
        asset_label: input.assignment.asset_label || null,
        ...assignmentSchedule,
      });
      if (error) throw new Error(error.message);
    }
  }

  return fetchPmTemplateById(supabase, id, scope);
}

export async function deletePmTemplate(
  supabase: SupabaseClient,
  id: number,
  scope?: PmTenantScope
) {
  if (scope) {
    await assertPmTemplateInTenant(supabase, id, scope);
  }

  let deleteQuery = supabase.from("pm_templates").delete().eq("id", id);
  if (scope) {
    deleteQuery = deleteQuery
      .eq("organization_id", scope.organizationId)
      .eq("property_id", scope.propertyId);
  }

  const { error } = await deleteQuery;
  if (error) {
    throw new Error(error.message);
  }
}
