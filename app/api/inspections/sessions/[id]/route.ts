import { NextResponse } from "next/server";
import {
  completeInspectionSession,
  fetchInspectionResponses,
  fetchInspectionSession,
  getSupabaseAdmin,
  saveInspectionProgress,
} from "@/app/inspections/lib/inspection-db";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const supabase = getSupabaseAdmin();
    const session = await fetchInspectionSession(supabase, Number(id));
    const responses = await fetchInspectionResponses(supabase, Number(id));
    return NextResponse.json({ session, responses });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Server error";
    return NextResponse.json({ error: message }, { status: 404 });
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const body = await request.json();
    const supabase = getSupabaseAdmin();

    if (body.action === "complete") {
      const session = await completeInspectionSession(supabase, Number(id), {
        responses: body.responses || [],
        sessionNotes: body.sessionNotes,
      });
      return NextResponse.json({ session });
    }

    const session = await saveInspectionProgress(supabase, Number(id), {
      responses: body.responses || [],
      sessionNotes: body.sessionNotes,
    });
    return NextResponse.json({ session });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Server error";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
