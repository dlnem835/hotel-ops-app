import { NextResponse } from "next/server";
import {
  fetchWorkOrderById,
  updateWorkOrder,
} from "@/app/maintenance/lib/work-order-db";
import { WorkOrder } from "@/app/maintenance/lib/maintenance-types";
import { getSupabaseAdmin } from "@/app/maintenance/lib/pm-db";
import { fetchMemberDisplayNameResolver } from "@/app/lib/member-display-name";

type RouteContext = { params: Promise<{ id: string }> };

async function enrichWorkOrder(workOrder: WorkOrder) {
  const supabase = getSupabaseAdmin();
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

export async function GET(_request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const supabase = getSupabaseAdmin();
    const workOrder = await fetchWorkOrderById(supabase, Number(id));
    if (!workOrder) {
      return NextResponse.json({ error: "Work order not found." }, { status: 404 });
    }
    return NextResponse.json({ workOrder: await enrichWorkOrder(workOrder) });
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
    const workOrder = await updateWorkOrder(supabase, Number(id), body);
    return NextResponse.json({ workOrder: await enrichWorkOrder(workOrder) });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
