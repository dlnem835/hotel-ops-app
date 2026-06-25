import { NextResponse } from "next/server";
import {
  fetchPmOccurrenceDetail,
  updatePmOccurrence,
} from "@/app/maintenance/lib/pm-occurrence-db";
import { PmOccurrenceResponses } from "@/app/maintenance/lib/maintenance-types";
import { getSupabaseAdmin } from "@/app/maintenance/lib/pm-db";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const supabase = getSupabaseAdmin();
    const detail = await fetchPmOccurrenceDetail(supabase, Number(id));
    if (!detail) {
      return NextResponse.json({ error: "PM session not found." }, { status: 404 });
    }
    return NextResponse.json(detail);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const body = await request.json();
    const supabase = getSupabaseAdmin();

    const patch: {
      responses?: PmOccurrenceResponses;
      sessionNotes?: string | null;
      status?: "open" | "completed";
      completedBy?: string | null;
    } = {};

    if (body.responses !== undefined) patch.responses = body.responses;
    if (body.session_notes !== undefined) patch.sessionNotes = body.session_notes;
    if (body.status !== undefined) patch.status = body.status;
    if (body.completed_by !== undefined) patch.completedBy = body.completed_by;

    const occurrence = await updatePmOccurrence(supabase, Number(id), patch);
    return NextResponse.json({ occurrence });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
