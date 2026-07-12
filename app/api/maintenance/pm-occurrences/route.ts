import { NextResponse } from "next/server";
import { resolvePmOccurrenceForAssignment } from "@/app/maintenance/lib/pm-occurrence-db";
import {
  resolveTenantRequest,
  tenantErrorResponse,
} from "@/app/lib/tenant/server/resolve-tenant-request";

export async function POST(request: Request) {
  try {
    const { supabase, organizationId, propertyId, user } =
      await resolveTenantRequest(request);
    const body = await request.json();
    const assignmentId = Number(body.assignment_id);
    if (!assignmentId) {
      return NextResponse.json(
        { error: "assignment_id is required." },
        { status: 400 }
      );
    }

    const scope = { organizationId, propertyId };
    const createdBy =
      body.created_by != null ? String(body.created_by) : user.id;
    const occurrence = await resolvePmOccurrenceForAssignment(
      supabase,
      assignmentId,
      createdBy,
      scope
    );
    return NextResponse.json({ occurrence });
  } catch (error: unknown) {
    return tenantErrorResponse(error);
  }
}
