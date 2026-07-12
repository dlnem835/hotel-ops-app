import { NextResponse } from "next/server";
import {
  fetchWorkOrderById,
  updateWorkOrder,
} from "@/app/maintenance/lib/work-order-db";
import { WorkOrder } from "@/app/maintenance/lib/maintenance-types";
import { fetchMemberDisplayNameResolver } from "@/app/lib/member-display-name";
import {
  resolveTenantRequest,
  tenantErrorResponse,
} from "@/app/lib/tenant/server/resolve-tenant-request";
import type { SupabaseClient } from "@supabase/supabase-js";

type RouteContext = { params: Promise<{ id: string }> };

async function enrichWorkOrder(supabase: SupabaseClient, workOrder: WorkOrder) {
  const memberResolver = await fetchMemberDisplayNameResolver(supabase);

  return {
    ...workOrder,
    createdByLabel: workOrder.createdBy
      ? memberResolver.resolveStoredValue(workOrder.createdBy)
      : null,
    completedByLabel: workOrder.completedBy
      ? memberResolver.resolveStoredValue(workOrder.completedBy)
      : null,
  };
}

export async function GET(request: Request, context: RouteContext) {
  try {
    const { supabase, organizationId, propertyId } = await resolveTenantRequest(
      request
    );
    const { id } = await context.params;
    const workOrder = await fetchWorkOrderById(supabase, Number(id), {
      organizationId,
      propertyId,
    });
    if (!workOrder) {
      return NextResponse.json({ error: "Work order not found." }, { status: 404 });
    }
    return NextResponse.json({ workOrder: await enrichWorkOrder(supabase, workOrder) });
  } catch (error: unknown) {
    return tenantErrorResponse(error);
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const { supabase, organizationId, propertyId } = await resolveTenantRequest(
      request
    );
    const scope = { organizationId, propertyId };
    const { id } = await context.params;
    const body = await request.json();
    const existing = await fetchWorkOrderById(supabase, Number(id), scope);
    if (!existing) {
      return NextResponse.json({ error: "Work order not found." }, { status: 404 });
    }
    const workOrder = await updateWorkOrder(supabase, Number(id), body, scope);
    return NextResponse.json({ workOrder: await enrichWorkOrder(supabase, workOrder) });
  } catch (error: unknown) {
    return tenantErrorResponse(error);
  }
}
