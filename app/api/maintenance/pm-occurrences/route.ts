import { NextResponse } from "next/server";
import { resolvePmOccurrenceForAssignment } from "@/app/maintenance/lib/pm-occurrence-db";
import { getSupabaseAdmin } from "@/app/maintenance/lib/pm-db";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const assignmentId = Number(body.assignment_id);
    if (!assignmentId) {
      return NextResponse.json(
        { error: "assignment_id is required." },
        { status: 400 }
      );
    }

    const supabase = getSupabaseAdmin();
    const occurrence = await resolvePmOccurrenceForAssignment(
      supabase,
      assignmentId,
      body.created_by ? String(body.created_by) : null
    );
    return NextResponse.json({ occurrence });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
