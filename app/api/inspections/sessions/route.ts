import { NextResponse } from "next/server";
import {
  createInspectionSession,
  fetchActiveTemplates,
  getSupabaseAdmin,
} from "@/app/inspections/lib/inspection-db";
import {
  resolveMemberJobTitle,
} from "@/app/inspections/lib/inspection-associates";
import { templateMatchesDashboard } from "@/app/inspections/lib/program-map";
import { parseDashboardProgram } from "@/app/inspections/lib/period-utils";
import { memberJobTitleMatchesInspectionProgram } from "@/app/lib/role-permissions";

export async function GET() {  try {
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
    let program = body.program ? parseDashboardProgram(String(body.program)) : null;

    if (program) {
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
    } else {
      const templates = await fetchActiveTemplates(supabase);
      const template = templates.find((entry) => entry.id === templateId);
      if (template) {
        program = templateMatchesDashboard(template.inspection_program, "RPM")
          ? "RPM"
          : "VR";
      }
    }

    if (body.associateId && program) {
      const { data: associate, error: associateError } = await supabase
        .from("team_members")
        .select("id, job_title, role, status")
        .eq("id", String(body.associateId))
        .maybeSingle();

      if (associateError) {
        return NextResponse.json({ error: associateError.message }, { status: 500 });
      }

      if (!associate) {
        return NextResponse.json(
          { error: "Selected associate was not found" },
          { status: 400 }
        );
      }

      const status = (associate.status || "Active").trim().toLowerCase();
      if (status !== "active") {
        return NextResponse.json(
          { error: "Selected associate is not active" },
          { status: 400 }
        );
      }

      if (
        !memberJobTitleMatchesInspectionProgram(
          resolveMemberJobTitle(associate),
          program
        )
      ) {
        return NextResponse.json(
          {
            error:
              program === "RPM"
                ? "Only maintenance personnel can be selected for RPM inspections"
                : "Only housekeeping personnel can be selected for room inspections",
          },
          { status: 400 }
        );
      }
    }

    const session = await createInspectionSession(supabase, {      areaId,
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
