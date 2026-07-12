import { NextResponse } from "next/server";
import {
  deletePmTemplate,
  fetchPmTemplateById,
  updatePmTemplate,
} from "@/app/maintenance/lib/pm-db";
import { PmTemplateInput } from "@/app/maintenance/lib/pm-types";
import {
  resolveTenantRequest,
  tenantErrorResponse,
} from "@/app/lib/tenant/server/resolve-tenant-request";

type RouteContext = {
  params: Promise<{ id: string }>;
};

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
    const { supabase, organizationId, propertyId } = await resolveTenantRequest(
      request
    );
    const { id } = await context.params;
    const body = (await request.json()) as PmTemplateInput;

    if (!body.name?.trim()) {
      return NextResponse.json({ error: "Name is required" }, { status: 400 });
    }

    const scope = { organizationId, propertyId };
    const result = await updatePmTemplate(supabase, Number(id), body, scope);
    return NextResponse.json(result);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Server error";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function DELETE(request: Request, context: RouteContext) {
  try {
    const { supabase, organizationId, propertyId } = await resolveTenantRequest(
      request
    );
    const { id } = await context.params;
    const scope = { organizationId, propertyId };
    await deletePmTemplate(supabase, Number(id), scope);
    return NextResponse.json({ ok: true });
  } catch (error: unknown) {
    return tenantErrorResponse(error);
  }
}
