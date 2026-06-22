import { NextResponse } from "next/server";
import {
  createPmTemplate,
  fetchPmDashboardData,
  getSupabaseAdmin,
} from "@/app/maintenance/lib/pm-db";
import { PmTemplateInput } from "@/app/maintenance/lib/pm-types";

export async function GET() {
  try {
    const supabase = getSupabaseAdmin();
    const payload = await fetchPmDashboardData(supabase);
    return NextResponse.json(payload);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as PmTemplateInput;
    if (!body.name?.trim()) {
      return NextResponse.json({ error: "Name is required" }, { status: 400 });
    }
    if (!body.assignment?.start_date) {
      return NextResponse.json(
        { error: "Start date is required" },
        { status: 400 }
      );
    }

    const supabase = getSupabaseAdmin();
    const result = await createPmTemplate(supabase, body);
    return NextResponse.json(result);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Server error";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
