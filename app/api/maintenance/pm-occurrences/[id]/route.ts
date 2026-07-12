import { NextResponse } from "next/server";
import {
  fetchPmOccurrenceDetail,
  updatePmOccurrence,
} from "@/app/maintenance/lib/pm-occurrence-db";
import { PmOccurrenceResponses } from "@/app/maintenance/lib/maintenance-types";
import {
  resolveTenantRequest,
  tenantErrorResponse,
} from "@/app/lib/tenant/server/resolve-tenant-request";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(request: Request, context: RouteContext) {
  try {
    const { supabase, organizationId, propertyId } = await resolveTenantRequest(
      request
    );
    const { id } = await context.params;
    const scope = { organizationId, propertyId };
    const detail = await fetchPmOccurrenceDetail(supabase, Number(id), scope);
    if (!detail) {
      return NextResponse.json({ error: "PM session not found." }, { status: 404 });
    }
    return NextResponse.json(detail);
  } catch (error: unknown) {
    return tenantErrorResponse(error);
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const { supabase, organizationId, propertyId } = await resolveTenantRequest(
      request
    );
    const { id } = await context.params;
    const body = await request.json();
    const scope = { organizationId, propertyId };

    const patch: {
      responses?: PmOccurrenceResponses;
      sessionNotes?: string | null;
      status?: "open" | "completed";
      completedBy?: string | null;
      savedBy?: string | null;
    } = {};

    if (body.responses !== undefined) patch.responses = body.responses;
    if (body.session_notes !== undefined) patch.sessionNotes = body.session_notes;
    if (body.status !== undefined) patch.status = body.status;
    if (body.completed_by !== undefined) patch.completedBy = body.completed_by;
    if (body.saved_by !== undefined) patch.savedBy = body.saved_by;

    const occurrence = await updatePmOccurrence(
      supabase,
      Number(id),
      patch,
      scope
    );
    return NextResponse.json({ occurrence });
  } catch (error: unknown) {
    return tenantErrorResponse(error);
  }
}
