import { NextResponse } from "next/server";
import {
  createWorkOrder,
  fetchWorkOrders,
} from "@/app/maintenance/lib/work-order-db";
import { WorkOrderInput } from "@/app/maintenance/lib/maintenance-types";
import { isWorkOrderCategory } from "@/app/maintenance/lib/work-order-categories";
import { getSupabaseAdmin } from "@/app/maintenance/lib/pm-db";
import { fetchMemberDisplayNameResolver } from "@/app/lib/member-display-name";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const openOnly = searchParams.get("open") === "1";
    const supabase = getSupabaseAdmin();
    const [workOrders, memberResolver] = await Promise.all([
      fetchWorkOrders(
        supabase,
        openOnly ? { status: ["Open", "In Progress"] } : undefined
      ),
      fetchMemberDisplayNameResolver(supabase),
    ]);

    const enrichedWorkOrders = workOrders.map((order) => ({
      ...order,
      createdByLabel: order.createdBy
        ? memberResolver.resolveStoredValue(order.createdBy)
        : null,
    }));

    return NextResponse.json({ workOrders: enrichedWorkOrders });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as WorkOrderInput;
    if (!body.subject?.trim()) {
      return NextResponse.json(
        { error: "Work order title is required." },
        { status: 400 }
      );
    }
    if (!body.category || !isWorkOrderCategory(body.category)) {
      return NextResponse.json({ error: "Category is required." }, { status: 400 });
    }
    const hasLocation =
      body.area_id != null || Boolean(body.area_label?.trim());
    if (!hasLocation) {
      return NextResponse.json(
        { error: "Location or custom location is required." },
        { status: 400 }
      );
    }
    if (!body.description?.trim()) {
      return NextResponse.json({ error: "Details are required." }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    const workOrder = await createWorkOrder(supabase, body);
    return NextResponse.json({ workOrder });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
