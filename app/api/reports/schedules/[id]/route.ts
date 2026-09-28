import { NextResponse } from "next/server";
import { deleteScheduledReportSchedule } from "@/app/reports/lib/report-schedule-db";
import {
  resolveTenantRequest,
  tenantErrorResponse,
} from "@/app/lib/tenant/server/resolve-tenant-request";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function DELETE(request: Request, context: RouteContext) {
  try {
    const { supabase, organizationId, propertyId } = await resolveTenantRequest(request);
    const { id } = await context.params;
    const deleted = await deleteScheduledReportSchedule(supabase, id, {
      organizationId,
      propertyId,
    });
    if (!deleted) {
      return NextResponse.json({ error: "Schedule not found." }, { status: 404 });
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    return tenantErrorResponse(error);
  }
}
