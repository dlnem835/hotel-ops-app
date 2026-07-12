import { NextResponse } from "next/server";
import { buildDashboard } from "@/app/inspections/lib/inspection-db";
import {
  resolveTenantRequest,
  tenantErrorResponse,
} from "@/app/lib/tenant/server/resolve-tenant-request";

export async function GET(request: Request) {
  try {
    const { supabase, organizationId, propertyId } = await resolveTenantRequest(
      request
    );
    const { searchParams } = new URL(request.url);
    const period = searchParams.get("period");
    const program = searchParams.get("program");
    const month = searchParams.get("month");
    const year = searchParams.get("year");
    const payload = await buildDashboard(
      supabase,
      period,
      program,
      month,
      year,
      { organizationId, propertyId }
    );
    return NextResponse.json(payload);
  } catch (error: unknown) {
    return tenantErrorResponse(error);
  }
}
