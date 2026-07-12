import { NextResponse } from "next/server";
import { fetchRoomHistory } from "@/app/inspections/lib/inspection-db";
import {
  resolveTenantRequest,
  tenantErrorResponse,
} from "@/app/lib/tenant/server/resolve-tenant-request";

type RouteContext = { params: Promise<{ areaId: string }> };

export async function GET(request: Request, context: RouteContext) {
  try {
    const { supabase, organizationId, propertyId } = await resolveTenantRequest(
      request
    );
    const { areaId } = await context.params;
    const result = await fetchRoomHistory(supabase, Number(areaId), {
      organizationId,
      propertyId,
    });
    return NextResponse.json(result);
  } catch (error: unknown) {
    return tenantErrorResponse(error);
  }
}
