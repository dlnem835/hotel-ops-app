import { NextResponse } from "next/server";
import {
  createInspectionSession,
  fetchActiveTemplates,
  getSupabaseAdmin,
} from "@/app/inspections/lib/inspection-db";
import { templateMatchesDashboard } from "@/app/inspections/lib/program-map";
import { parseDashboardProgram } from "@/app/inspections/lib/period-utils";

export async function GET() {
  try {
    const supabase = getSupabaseAdmin();
    const templates = await fetchActiveTemplates(supabase);
    return NextResponse.json({ templates });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const areaId = Number(body.areaId);
    const templateId = Number(body.templateId);

    if (!areaId || !templateId) {
      return NextResponse.json(
        { error: "Room and template are required" },
        { status: 400 }
      );
    }

    const supabase = getSupabaseAdmin();

    if (body.program) {
      const program = parseDashboardProgram(String(body.program));
      const templates = await fetchActiveTemplates(supabase);
      const template = templates.find((entry) => entry.id === templateId);
      if (
        template &&
        !templateMatchesDashboard(template.inspection_program, program)
      ) {
        return NextResponse.json(
          { error: "Template does not match selected inspection program" },
          { status: 400 }
        );
      }
    }

    const session = await createInspectionSession(supabase, {
      areaId,
      templateId,
      inspectorId: body.inspectorId ? String(body.inspectorId) : null,
      associateId: body.associateId ? String(body.associateId) : null,
    });

    return NextResponse.json({ session });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
