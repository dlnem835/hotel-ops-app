import { NextResponse } from "next/server";
import { buildMaintenanceDashboard } from "@/app/maintenance/lib/maintenance-dashboard";
import {
  resolveTenantRequest,
  tenantErrorResponse,
} from "@/app/lib/tenant/server/resolve-tenant-request";

export async function GET(request: Request) {
  try {
    const { supabase, organizationId, propertyId } = await resolveTenantRequest(
      request
    );
    const payload = await buildMaintenanceDashboard(supabase, {
      organizationId,
      propertyId,
    });
    return NextResponse.json(payload);
  } catch (error: unknown) {
    return tenantErrorResponse(error);
  }
}
