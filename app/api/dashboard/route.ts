import { NextResponse } from "next/server";
import { buildOperationalDashboard } from "@/app/dashboard/lib/operational-dashboard";
import {
  resolveTenantRequest,
  tenantErrorResponse,
} from "@/app/lib/tenant/server/resolve-tenant-request";

export async function GET(request: Request) {
  try {
    const { supabase, organizationId, propertyId, user } =
      await resolveTenantRequest(request);
    const payload = await buildOperationalDashboard(
      supabase,
      {
        organizationId,
        propertyId,
      },
      user.id
    );
    return NextResponse.json(payload);
  } catch (error: unknown) {
    return tenantErrorResponse(error);
  }
}
