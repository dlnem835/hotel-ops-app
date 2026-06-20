import { createClient, SupabaseClient } from "@supabase/supabase-js";
import {
  getStandardTemplate,
  resolveStandardKeyFromName,
  standardToPropertyContent,
} from "@/app/inspections/standards";
import {
  PropertyInspectionTemplate,
  PropertyTemplateContent,
  TemplateStatus,
  TemplateType,
} from "@/app/inspections/standards/types";

export function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

function normalizeRow(row: Record<string, unknown>): PropertyInspectionTemplate {
  return {
    id: Number(row.id),
    standard_key: row.standard_key ? String(row.standard_key) : null,
    based_on_standard_version: row.based_on_standard_version
      ? String(row.based_on_standard_version)
      : null,
    name: String(row.name),
    template_type: row.template_type as TemplateType,
    status: row.status as TemplateStatus,
    property_version: Number(row.property_version),
    content: row.content as PropertyTemplateContent,
    last_modified_at: String(row.last_modified_at),
    created_at: String(row.created_at),
  };
}

export async function fetchAllPropertyTemplates(
  supabaseAdmin: SupabaseClient
): Promise<PropertyInspectionTemplate[]> {
  await migrateLegacyTemplatesIfNeeded(supabaseAdmin);

  const { data, error } = await supabaseAdmin
    .from("property_inspection_templates")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  return (data || []).map(normalizeRow);
}

export async function fetchPropertyTemplateById(
  supabaseAdmin: SupabaseClient,
  id: number
): Promise<PropertyInspectionTemplate> {
  const { data, error } = await supabaseAdmin
    .from("property_inspection_templates")
    .select("*")
    .eq("id", id)
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return normalizeRow(data);
}

export async function activateStandardTemplate(
  supabaseAdmin: SupabaseClient,
  standardKey: string
) {
  const standard = getStandardTemplate(standardKey);
  if (!standard) {
    throw new Error("Standard template not found");
  }

  const { data: existing } = await supabaseAdmin
    .from("property_inspection_templates")
    .select("id")
    .eq("standard_key", standardKey)
    .maybeSingle();

  if (existing) {
    throw new Error("This standard template is already activated for your property");
  }

  const content = standardToPropertyContent(standard);

  const { data, error } = await supabaseAdmin
    .from("property_inspection_templates")
    .insert([
      {
        standard_key: standard.key,
        based_on_standard_version: standard.version,
        name: standard.name,
        template_type: standard.templateType,
        status: "Active",
        property_version: 1,
        content,
        last_modified_at: new Date().toISOString(),
      },
    ])
    .select("*")
    .single();

  if (error || !data) {
    throw new Error(error?.message || "Unable to activate template");
  }

  return normalizeRow(data);
}

export async function savePropertyTemplate(
  supabaseAdmin: SupabaseClient,
  id: number,
  payload: {
    name: string;
    template_type: TemplateType;
    status: TemplateStatus;
    content: PropertyTemplateContent;
  }
) {
  const current = await fetchPropertyTemplateById(supabaseAdmin, id);

  const { data, error } = await supabaseAdmin
    .from("property_inspection_templates")
    .update({
      name: payload.name.trim(),
      template_type: payload.template_type,
      status: payload.status,
      content: payload.content,
      property_version: current.property_version + 1,
      last_modified_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select("*")
    .single();

  if (error || !data) {
    throw new Error(error?.message || "Unable to save template");
  }

  return normalizeRow(data);
}

export async function restorePropertyTemplateFromStandard(
  supabaseAdmin: SupabaseClient,
  id: number
) {
  const current = await fetchPropertyTemplateById(supabaseAdmin, id);

  if (!current.standard_key) {
    throw new Error("Custom templates cannot be restored to a standard version");
  }

  const standard = getStandardTemplate(current.standard_key);
  if (!standard) {
    throw new Error("Standard template not found in library");
  }

  const content = standardToPropertyContent(standard);

  const { data, error } = await supabaseAdmin
    .from("property_inspection_templates")
    .update({
      name: standard.name,
      template_type: standard.templateType,
      based_on_standard_version: standard.version,
      content,
      property_version: current.property_version + 1,
      last_modified_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select("*")
    .single();

  if (error || !data) {
    throw new Error(error?.message || "Unable to restore template");
  }

  return normalizeRow(data);
}

export async function duplicatePropertyTemplate(
  supabaseAdmin: SupabaseClient,
  id: number
) {
  const source = await fetchPropertyTemplateById(supabaseAdmin, id);

  const { data, error } = await supabaseAdmin
    .from("property_inspection_templates")
    .insert([
      {
        standard_key: null,
        based_on_standard_version: source.based_on_standard_version,
        name: `${source.name} (Copy)`,
        template_type: source.template_type,
        status: source.status,
        property_version: 1,
        content: source.content,
        last_modified_at: new Date().toISOString(),
      },
    ])
    .select("*")
    .single();

  if (error || !data) {
    throw new Error(error?.message || "Unable to duplicate template");
  }

  return normalizeRow(data);
}

export async function deletePropertyTemplate(
  supabaseAdmin: SupabaseClient,
  id: number
) {
  const { error } = await supabaseAdmin
    .from("property_inspection_templates")
    .delete()
    .eq("id", id);

  if (error) {
    throw new Error(error.message);
  }
}

export async function setPropertyTemplateStatus(
  supabaseAdmin: SupabaseClient,
  id: number,
  status: TemplateStatus
) {
  const { data, error } = await supabaseAdmin
    .from("property_inspection_templates")
    .update({
      status,
      last_modified_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select("*")
    .single();

  if (error || !data) {
    throw new Error(error?.message || "Unable to update status");
  }

  return normalizeRow(data);
}

async function migrateLegacyTemplatesIfNeeded(supabaseAdmin: SupabaseClient) {
  const { count, error: countError } = await supabaseAdmin
    .from("property_inspection_templates")
    .select("id", { count: "exact", head: true });

  if (countError) {
    if (countError.message.includes("does not exist")) return;
    throw new Error(countError.message);
  }

  if ((count ?? 0) > 0) return;

  const { data: legacyRows, error: legacyError } = await supabaseAdmin
    .from("inspection_templates")
    .select(
      `name, template_type, status,
      inspection_template_categories (
        name, sort_order,
        inspection_template_items (label, point_value, required, sort_order)
      )`
    );

  if (legacyError) {
    if (legacyError.message.includes("does not exist")) return;
    return;
  }

  for (const legacy of legacyRows || []) {
    const standardKey = resolveStandardKeyFromName(String(legacy.name));
    if (!standardKey) continue;

    const standard = getStandardTemplate(standardKey);
    if (!standard) continue;

    const { data: exists } = await supabaseAdmin
      .from("property_inspection_templates")
      .select("id")
      .eq("standard_key", standardKey)
      .maybeSingle();

    if (exists) continue;

    await supabaseAdmin.from("property_inspection_templates").insert([
      {
        standard_key: standardKey,
        based_on_standard_version: standard.version,
        name: standard.name,
        template_type: standard.templateType,
        status: legacy.status || "Active",
        property_version: 1,
        content: standardToPropertyContent(standard),
        last_modified_at: new Date().toISOString(),
      },
    ]);
  }
}
