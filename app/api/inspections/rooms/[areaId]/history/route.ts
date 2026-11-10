import { NextResponse } from "next/server";
import { fetchRoomHistory } from "@/app/inspections/lib/inspection-db";
import { signRoomHistoryPhotos } from "@/app/lib/storage/server/operational-photo-display";
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
    const scope = { organizationId, propertyId };
    const result = await fetchRoomHistory(supabase, Number(areaId), scope);
    return NextResponse.json({
      ...result,
      history: await signRoomHistoryPhotos(supabase, result.history, scope),
    });
  } catch (error: unknown) {
    return tenantErrorResponse(error);
  }
}
