import { NextResponse } from "next/server";
import {
  fetchPropertyTemplateById,
  restorePropertyTemplateFromStandard,
} from "@/app/inspections/lib/property-template-db";
import { assertCanManagePropertyInspectionTemplates } from "@/app/lib/tenant/server/property-inspection-template-access";
import {
  resolveTenantRequest,
  tenantErrorResponse,
} from "@/app/lib/tenant/server/resolve-tenant-request";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: RouteContext) {
  try {
    const { user, supabase, organizationId, propertyId } =
      await resolveTenantRequest(request);
    await assertCanManagePropertyInspectionTemplates(supabase, user.id, {
      organizationId,
      propertyId,
    });
    const { id } = await context.params;
    const template = await restorePropertyTemplateFromStandard(
      supabase,
      Number(id),
      { organizationId, propertyId }
    );
    return NextResponse.json({ template });
  } catch (error: unknown) {
    return tenantErrorResponse(error);
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
