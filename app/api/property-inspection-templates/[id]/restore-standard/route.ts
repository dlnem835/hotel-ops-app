import { NextResponse } from "next/server";
import {
  fetchPropertyTemplateById,
  restorePropertyTemplateFromStandard,
} from "@/app/inspections/lib/property-template-db";
import {
  resolveTenantRequest,
  tenantErrorResponse,
} from "@/app/lib/tenant/server/resolve-tenant-request";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: RouteContext) {
  try {
    const { supabase, organizationId, propertyId } = await resolveTenantRequest(
      request
    );
    const { id } = await context.params;
    const template = await restorePropertyTemplateFromStandard(
      supabase,
      Number(id),
      { organizationId, propertyId }
    );
    return NextResponse.json({ template });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Server error";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function GET(request: Request, context: RouteContext) {
  try {
    const { supabase, organizationId, propertyId } = await resolveTenantRequest(
      request
    );
    const { id } = await context.params;
    const template = await fetchPropertyTemplateById(supabase, Number(id), {
      organizationId,
      propertyId,
    });
    return NextResponse.json({ template });
  } catch (error: unknown) {
    return tenantErrorResponse(error);
  }
}
