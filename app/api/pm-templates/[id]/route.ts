import { NextResponse } from "next/server";
import {
  deletePmTemplate,
  fetchPmTemplateById,
  updatePmTemplate,
} from "@/app/maintenance/lib/pm-db";
import { canManageStandardPmTemplates } from "@/app/maintenance/lib/standard-pm-access";
import { PmTemplateInput } from "@/app/maintenance/lib/pm-types";
import {
  resolveTenantRequest,
  TenantRequestError,
  tenantErrorResponse,
} from "@/app/lib/tenant/server/resolve-tenant-request";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { TenantContextResponse } from "@/app/lib/tenant/types";

type RouteContext = {
  params: Promise<{ id: string }>;
};

async function assertStandardTemplateWriteAccess(
  supabase: SupabaseClient,
  id: number,
  organizationId: number,
  propertyId: number,
  context: TenantContextResponse
) {
  const { data, error } = await supabase
    .from("pm_templates")
    .select("standard_key")
    .eq("id", id)
    .eq("organization_id", organizationId)
    .eq("property_id", propertyId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) throw new TenantRequestError(404, "PM template not found");
  if (data.standard_key && !canManageStandardPmTemplates(context)) {
    throw new TenantRequestError(
      403,
      "Administrator access is required to modify a standard PM template"
    );
  }
}

export async function GET(request: Request, context: RouteContext) {
  try {
    const { supabase, organizationId, propertyId } = await resolveTenantRequest(
      request
    );
    const { id } = await context.params;
    const scope = { organizationId, propertyId };
    const result = await fetchPmTemplateById(supabase, Number(id), scope);
    return NextResponse.json(result);
  } catch (error: unknown) {
    return tenantErrorResponse(error);
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const { supabase, organizationId, propertyId, context: tenantContext } =
      await resolveTenantRequest(request);
    const { id } = await context.params;
    await assertStandardTemplateWriteAccess(
      supabase,
      Number(id),
      organizationId,
      propertyId,
      tenantContext
    );
    const body = (await request.json()) as PmTemplateInput;

    if (!body.name?.trim()) {
      return NextResponse.json({ error: "Name is required" }, { status: 400 });
    }

    const scope = { organizationId, propertyId };
    const result = await updatePmTemplate(supabase, Number(id), body, scope);
    return NextResponse.json(result);
  } catch (error: unknown) {
    if (error instanceof TenantRequestError) {
      return tenantErrorResponse(error);
    }
    const message = error instanceof Error ? error.message : "Server error";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function DELETE(request: Request, context: RouteContext) {
  try {
    const { supabase, organizationId, propertyId, context: tenantContext } =
      await resolveTenantRequest(request);

    if (!canManageStandardPmTemplates(tenantContext)) {
      throw new TenantRequestError(
        403,
        "Property Admin access is required to delete PM templates"
      );
    }

    const { id } = await context.params;
    const scope = { organizationId, propertyId };
    await deletePmTemplate(supabase, Number(id), scope);
    return NextResponse.json({ ok: true });
  } catch (error: unknown) {
    return tenantErrorResponse(error);
  }
}
