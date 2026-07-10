import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/app/maintenance/lib/pm-db";
import {
  createScheduledReportSchedule,
  listScheduledReportSchedules,
} from "@/app/reports/lib/report-schedule-db";
import { computeNextRunAtUtc } from "@/app/reports/lib/report-schedule-next-run";
import type {
  ReportScheduleContext,
  ReportScheduleFormValues,
} from "@/app/reports/lib/report-schedule-types";

type CreateScheduleBody = {
  schedule: ReportScheduleFormValues;
  context: ReportScheduleContext;
  timezone: string;
  createdBy?: string | null;
};

export async function GET() {
  try {
    const supabase = getSupabaseAdmin();
    const schedules = await listScheduledReportSchedules(supabase);
    return NextResponse.json({ schedules });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to load schedules.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
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

    const supabase = getSupabaseAdmin();
    const schedule = await createScheduledReportSchedule(supabase, {
      createdBy: body.createdBy ?? null,
      schedule: body.schedule,
      context: body.context,
      timezone: body.timezone,
      nextRunAt,
    });

    return NextResponse.json({ schedule });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to save schedule.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
