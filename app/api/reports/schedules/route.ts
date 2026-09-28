import { NextResponse } from "next/server";
import {
  createScheduledReportSchedule,
  listScheduledReportSchedules,
} from "@/app/reports/lib/report-schedule-db";
import { computeNextRunAtUtc } from "@/app/reports/lib/report-schedule-next-run";
import type {
  ReportScheduleContext,
  ReportScheduleFormValues,
} from "@/app/reports/lib/report-schedule-types";
import {
  resolveTenantRequest,
  tenantErrorResponse,
} from "@/app/lib/tenant/server/resolve-tenant-request";

type CreateScheduleBody = {
  schedule: ReportScheduleFormValues;
  context: ReportScheduleContext;
  timezone: string;
};

export async function GET(request: Request) {
  try {
    const { supabase, organizationId, propertyId } = await resolveTenantRequest(request);
    const schedules = await listScheduledReportSchedules(supabase, {
      organizationId,
      propertyId,
    });
    return NextResponse.json({ schedules });
  } catch (error) {
    return tenantErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const { supabase, organizationId, propertyId, user } =
      await resolveTenantRequest(request);
    const body = (await request.json()) as CreateScheduleBody;
    if (!body.schedule?.recipients?.trim()) {
      return NextResponse.json({ error: "At least one recipient email is required." }, { status: 400 });
    }

    const nextRunAt = computeNextRunAtUtc({
      frequency: body.schedule.frequency,
      repeatEvery: body.schedule.repeatEvery,
      intervalUnit: body.schedule.intervalUnit,
      weeklyDay: body.schedule.weeklyDay,
      monthlyDay: body.schedule.monthlyDay,
      time: body.schedule.time,
      startDate: body.schedule.startDate,
      endDate: body.schedule.endDate,
      timezone: body.timezone,
    });

    if (!nextRunAt) {
      return NextResponse.json(
        { error: "Unable to calculate the next run time for this schedule." },
        { status: 400 }
      );
    }

    const schedule = await createScheduledReportSchedule(supabase, {
      createdBy: user.id,
      organizationId,
      propertyId,
      schedule: body.schedule,
      context: body.context,
      timezone: body.timezone,
      nextRunAt,
    });

    return NextResponse.json({ schedule });
  } catch (error) {
    return tenantErrorResponse(error);
  }
}
