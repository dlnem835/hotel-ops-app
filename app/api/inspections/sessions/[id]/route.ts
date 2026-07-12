import { NextResponse } from "next/server";
import {
  completeInspectionSession,
  fetchInspectionResponses,
  fetchInspectionSession,
  saveInspectionProgress,
} from "@/app/inspections/lib/inspection-db";
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
    const session = await fetchInspectionSession(supabase, Number(id), scope);
    const responses = await fetchInspectionResponses(
      supabase,
      Number(id),
      scope
    );
    return NextResponse.json({ session, responses });
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

    if (body.action === "complete") {
      const session = await completeInspectionSession(
        supabase,
        Number(id),
        {
          responses: body.responses || [],
          sessionNotes: body.sessionNotes,
          completedBy: body.completedBy ?? body.completed_by ?? null,
        },
        scope
      );
      return NextResponse.json({ session });
    }

    const session = await saveInspectionProgress(
      supabase,
      Number(id),
      {
        responses: body.responses || [],
        sessionNotes: body.sessionNotes,
      },
      scope
    );
    return NextResponse.json({ session });
  } catch (error: unknown) {
    return tenantErrorResponse(error);
  }
}
