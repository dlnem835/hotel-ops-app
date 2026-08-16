import { NextResponse } from "next/server";
import {
  fetchPmProgramSession,
  savePmProgramSession,
  startPmProgramSession,
} from "@/app/maintenance/lib/pm-program-session-db";
import type {
  PmOccurrenceResponses,
  PmTargetOutcome,
} from "@/app/maintenance/lib/maintenance-types";
import {
  resolveTenantRequest,
  tenantErrorResponse,
  TenantRequestError,
} from "@/app/lib/tenant/server/resolve-tenant-request";

type RouteContext = { params: Promise<{ templateId: string }> };

function parseTemplateId(value: string): number {
  const templateId = Number(value);
  if (!Number.isInteger(templateId) || templateId <= 0) {
    throw new TenantRequestError(400, "Invalid PM template id");
  }
  return templateId;
}

export async function GET(request: Request, context: RouteContext) {
  try {
    const { supabase, organizationId, propertyId } =
      await resolveTenantRequest(request);
    const { templateId: rawTemplateId } = await context.params;
    const session = await fetchPmProgramSession(
      supabase,
      parseTemplateId(rawTemplateId),
      { organizationId, propertyId }
    );
    return NextResponse.json({ session });
  } catch (error: unknown) {
    return tenantErrorResponse(error);
  }
}

export async function POST(request: Request, context: RouteContext) {
  try {
    const { supabase, organizationId, propertyId, user } =
      await resolveTenantRequest(request);
    const { templateId: rawTemplateId } = await context.params;
    const session = await startPmProgramSession(
      supabase,
      parseTemplateId(rawTemplateId),
      user.id,
      { organizationId, propertyId }
    );
    return NextResponse.json({ session });
  } catch (error: unknown) {
    return tenantErrorResponse(error);
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const { supabase, organizationId, propertyId, user } =
      await resolveTenantRequest(request);
    const { templateId: rawTemplateId } = await context.params;
    const body = await request.json();
    const rawOutcomes =
      body.target_outcomes && typeof body.target_outcomes === "object"
        ? body.target_outcomes
        : {};
    const targetOutcomes: Record<string, PmTargetOutcome | null> = {};
    for (const [assignmentId, value] of Object.entries(rawOutcomes)) {
      if (value !== null && value !== "complete" && value !== "issue_found") {
        throw new TenantRequestError(400, "Invalid PM target outcome");
      }
      targetOutcomes[assignmentId] = value as PmTargetOutcome | null;
    }

    const responses =
      body.responses && Array.isArray(body.responses.steps)
        ? (body.responses as PmOccurrenceResponses)
        : { steps: [] };
    const session = await savePmProgramSession(
      supabase,
      parseTemplateId(rawTemplateId),
      {
        responses,
        sessionNotes:
          body.session_notes == null ? null : String(body.session_notes),
        targetOutcomes,
        complete: body.status === "completed",
        actor: user.id,
      },
      { organizationId, propertyId }
    );
    return NextResponse.json({ session });
  } catch (error: unknown) {
    return tenantErrorResponse(error);
  }
}
