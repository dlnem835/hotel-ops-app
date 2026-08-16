import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { canManageStandardPmTemplates } from "@/app/maintenance/lib/standard-pm-access";
import { STANDARD_PM_TEMPLATES } from "@/app/maintenance/lib/standard-pm-templates";
import {
  resolveTenantRequest,
  tenantErrorResponse,
  TenantRequestError,
} from "@/app/lib/tenant/server/resolve-tenant-request";

type ExistingPmTemplate = {
  id: number;
  standard_key: string | null;
  name: string;
  frequency: string;
};

function templateNameKey(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, " ");
}

function findInstalledStandard(
  rows: ExistingPmTemplate[],
  standard: (typeof STANDARD_PM_TEMPLATES)[number]
) {
  return rows.find(
    (row) =>
      row.standard_key === standard.key ||
      (!row.standard_key &&
        row.frequency === standard.frequency &&
        [standard.name, ...(standard.legacyNames || [])]
          .map(templateNameKey)
          .includes(templateNameKey(row.name)))
  );
}

async function resolveDefaultAreaId(
  supabase: SupabaseClient,
  organizationId: number,
  propertyId: number,
  defaultAreaName?: string
) {
  if (!defaultAreaName) return null;

  const { data, error } = await supabase
    .from("buildings_and_areas")
    .select("id, name, area_type")
    .eq("organization_id", organizationId)
    .eq("property_id", propertyId);

  if (error) throw new Error(error.message);
  const key = templateNameKey(defaultAreaName);
  const match = (data || []).find(
    (area) =>
      templateNameKey(String(area.name || "")) === key ||
      templateNameKey(String(area.area_type || "")) === key
  );
  return match ? Number(match.id) : null;
}

async function ensureDefaultUnits(
  supabase: SupabaseClient,
  organizationId: number,
  propertyId: number,
  templateId: number,
  template: (typeof STANDARD_PM_TEMPLATES)[number]
) {
  if (
    template.assignmentType !== "equipment_unit" ||
    !template.defaultUnits?.length
  ) {
    return;
  }

  const { data: assignments, error } = await supabase
    .from("pm_schedule_assignments")
    .select("id, area_id, start_date, end_date, status")
    .eq("template_id", templateId)
    .eq("status", "Active")
    .order("id", { ascending: true });
  if (error) throw new Error(error.message);

  const defaultAreaId = await resolveDefaultAreaId(
    supabase,
    organizationId,
    propertyId,
    template.defaultAreaName
  );
  const activeAssignments = assignments || [];
  const startDate =
    activeAssignments[0]?.start_date ||
    new Date().toISOString().slice(0, 10);

  for (let index = 0; index < template.defaultUnits.length; index += 1) {
    const existing = activeAssignments[index];
    if (existing) {
      const { error: updateError } = await supabase
        .from("pm_schedule_assignments")
        .update({
          asset_label: template.defaultUnits[index],
          area_id: existing.area_id ?? defaultAreaId,
        })
        .eq("id", existing.id)
        .eq("template_id", templateId);
      if (updateError) throw new Error(updateError.message);
    } else {
      const { error: insertError } = await supabase
        .from("pm_schedule_assignments")
        .insert({
          template_id: templateId,
          area_id: defaultAreaId,
          asset_label: template.defaultUnits[index],
          start_date: startDate,
          end_date: null,
          status: "Active",
        });
      if (insertError) throw new Error(insertError.message);
    }
  }
}

async function ensureDefaultLocations(
  supabase: SupabaseClient,
  organizationId: number,
  propertyId: number,
  templateId: number,
  template: (typeof STANDARD_PM_TEMPLATES)[number]
) {
  if (
    template.assignmentType !== "area_location" ||
    (!template.defaultAreaNames?.length &&
      !template.defaultNamedLocations?.length)
  ) {
    return;
  }

  const { count, error: assignmentError } = await supabase
    .from("pm_schedule_assignments")
    .select("id", { count: "exact", head: true })
    .eq("template_id", templateId)
    .eq("status", "Active");
  if (assignmentError) throw new Error(assignmentError.message);
  if ((count || 0) > 0) return;

  const { data: areas, error: areaError } = await supabase
    .from("buildings_and_areas")
    .select("id, name")
    .eq("organization_id", organizationId)
    .eq("property_id", propertyId);
  if (areaError) throw new Error(areaError.message);

  const areaIdByName = new Map(
    (areas || []).map((area) => [
      templateNameKey(String(area.name || "")),
      Number(area.id),
    ])
  );
  const namedLocations = template.defaultNamedLocations || [];
  const areaIds = (template.defaultAreaNames || [])
    .map((name) => areaIdByName.get(templateNameKey(name)) ?? null)
    .filter((areaId): areaId is number => areaId !== null);
  if (areaIds.length === 0 && namedLocations.length === 0) return;

  const startDate = new Date().toISOString().slice(0, 10);
  const { error: insertError } = await supabase
    .from("pm_schedule_assignments")
    .insert(
      [
        ...areaIds.map((areaId) => ({
          template_id: templateId,
          area_id: areaId,
          asset_label: null,
          start_date: startDate,
          end_date: null,
          status: "Active",
        })),
        ...namedLocations.map((name) => ({
          template_id: templateId,
          area_id: areaIdByName.get(templateNameKey(name)) ?? null,
          asset_label: name,
          start_date: startDate,
          end_date: null,
          status: "Active",
        })),
      ]
    );
  if (insertError) throw new Error(insertError.message);
}

export async function GET(request: Request) {
  try {
    const { supabase, organizationId, propertyId, context } =
      await resolveTenantRequest(request);

    if (!canManageStandardPmTemplates(context)) {
      throw new TenantRequestError(403, "Administrator access required");
    }

    const { data, error } = await supabase
      .from("pm_templates")
      .select("id, standard_key, name, frequency")
      .eq("organization_id", organizationId)
      .eq("property_id", propertyId);

    if (error) throw new Error(error.message);

    const existingRows = (data || []) as ExistingPmTemplate[];
    const available = STANDARD_PM_TEMPLATES.filter(
      (template) =>
        !existingRows.some((row) => row.standard_key === template.key)
    );

    return NextResponse.json({
      canManage: true,
      total: STANDARD_PM_TEMPLATES.length,
      added: STANDARD_PM_TEMPLATES.length - available.length,
      available: available.map((template) => ({
        key: template.key,
        name: template.name,
        frequency: template.frequency,
        category: template.category,
        defaultAreaName: template.defaultAreaName ?? null,
      })),
    });
  } catch (error: unknown) {
    return tenantErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const { supabase, organizationId, propertyId, context } =
      await resolveTenantRequest(request);

    if (!canManageStandardPmTemplates(context)) {
      throw new TenantRequestError(403, "Administrator access required");
    }

    const { data: existingRows, error: existingError } = await supabase
      .from("pm_templates")
      .select("id, standard_key, name, frequency")
      .eq("organization_id", organizationId)
      .eq("property_id", propertyId);

    if (existingError) throw new Error(existingError.message);

    const installedRows = (existingRows || []) as ExistingPmTemplate[];
    const addedNames: string[] = [];
    const adoptedNames: string[] = [];
    let skipped = 0;

    for (const template of STANDARD_PM_TEMPLATES) {
      const installed = findInstalledStandard(installedRows, template);
      if (installed?.standard_key === template.key) {
        skipped += 1;
        continue;
      }

      if (installed) {
        const update: Record<string, unknown> = {
          standard_key: template.key,
        };
        if (template.assignmentType) {
          update.assignment_type = template.assignmentType;
        }
        if (template.defaultNamedLocations?.length) {
          update.named_locations = true;
        }
        if (
          template.legacyNames?.some(
            (name) => templateNameKey(name) === templateNameKey(installed.name)
          )
        ) {
          update.name = template.name;
        }
        const { error } = await supabase
          .from("pm_templates")
          .update(update)
          .eq("id", installed.id)
          .eq("organization_id", organizationId)
          .eq("property_id", propertyId)
          .is("standard_key", null);

        if (error) throw new Error(error.message);
        await ensureDefaultUnits(
          supabase,
          organizationId,
          propertyId,
          installed.id,
          template
        );
        await ensureDefaultLocations(
          supabase,
          organizationId,
          propertyId,
          installed.id,
          template
        );
        installed.standard_key = template.key;
        adoptedNames.push(template.name);
        skipped += 1;
        continue;
      }

      const { data: createdTemplate, error } = await supabase
        .from("pm_templates")
        .insert({
          organization_id: organizationId,
          property_id: propertyId,
          standard_key: template.key,
          name: template.name,
          description: template.description,
          category: template.category,
          frequency: template.frequency,
          estimated_minutes: template.estimatedMinutes ?? null,
          assigned_role: template.assignedRole ?? "Maintenance",
          assigned_member_id: null,
          applies_to: template.appliesTo ?? "asset",
          checklist: template.checklist,
          status: "Active",
          assignment_type: template.assignmentType ?? "area_location",
          named_locations: Boolean(template.defaultNamedLocations?.length),
        })
        .select("id")
        .single();

      if (error) {
        if (error.code === "23505") {
          skipped += 1;
          continue;
        }
        throw new Error(error.message);
      }

      try {
        await ensureDefaultUnits(
          supabase,
          organizationId,
          propertyId,
          Number(createdTemplate.id),
          template
        );
        await ensureDefaultLocations(
          supabase,
          organizationId,
          propertyId,
          Number(createdTemplate.id),
          template
        );
      } catch (unitError) {
        await supabase
          .from("pm_templates")
          .delete()
          .eq("id", Number(createdTemplate.id))
          .eq("organization_id", organizationId)
          .eq("property_id", propertyId);
        throw unitError;
      }

      addedNames.push(template.name);
    }

    return NextResponse.json({
      created: addedNames.length,
      skipped,
      addedNames,
      adoptedNames,
    });
  } catch (error: unknown) {
    return tenantErrorResponse(error);
  }
}
