import { NextResponse } from "next/server";
import { getScheduledReportScheduleRowForTenant } from "@/app/reports/lib/report-schedule-db";
import {
  getScheduledReportSafeError,
  processScheduledReportRow,
  SCHEDULED_REPORT_SAFE_ERRORS,
} from "@/app/reports/lib/scheduled-report-processor";
import {
  resolveTenantRequest,
  TenantRequestError,
  tenantErrorResponse,
} from "@/app/lib/tenant/server/resolve-tenant-request";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function POST(request: Request, context: RouteContext) {
  try {
    const { supabase, organizationId, propertyId } = await resolveTenantRequest(request);
    const { id } = await context.params;
    const dbRow = await getScheduledReportScheduleRowForTenant(supabase, id, {
      organizationId,
      propertyId,
    });

    if (!dbRow) {
      return NextResponse.json(
        { ok: false, error: SCHEDULED_REPORT_SAFE_ERRORS.databaseQueryFailed },
        { status: 404 }
      );
    }

    const result = await processScheduledReportRow(supabase, dbRow, {
      triggeredBy: "test",
      updateNextRun: false,
    });

    if (result.status === "failed") {
      return NextResponse.json(
        {
          ok: false,
          error: result.error,
          result,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      result: {
        scheduleId: result.scheduleId,
        status: result.status,
        resendMessageId: result.resendMessageId,
        testSentAt: result.testSentAt,
      },
    });
  } catch (error) {
    if (error instanceof TenantRequestError) {
      return tenantErrorResponse(error);
    }
    return NextResponse.json(
      { ok: false, error: getScheduledReportSafeError(error) },
      { status: 500 }
    );
  }
}
