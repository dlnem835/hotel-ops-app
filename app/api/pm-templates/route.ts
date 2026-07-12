import { NextResponse } from "next/server";
import {
  createPmTemplate,
  fetchPmDashboardData,
} from "@/app/maintenance/lib/pm-db";
import { PmTemplateInput } from "@/app/maintenance/lib/pm-types";
import {
  resolveTenantRequest,
  tenantErrorResponse,
} from "@/app/lib/tenant/server/resolve-tenant-request";

export async function GET(request: Request) {
  try {
    const { supabase, organizationId, propertyId } = await resolveTenantRequest(
      request
    );
    const payload = await fetchPmDashboardData(supabase, {
      organizationId,
      propertyId,
    });
    return NextResponse.json(payload);
  } catch (error: unknown) {
    return tenantErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const { supabase, organizationId, propertyId } = await resolveTenantRequest(
      request
    );
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

    const scope = { organizationId, propertyId };
    const result = await createPmTemplate(supabase, body, scope);
    return NextResponse.json(result);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Server error";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
