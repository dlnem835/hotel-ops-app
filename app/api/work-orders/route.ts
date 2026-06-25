import { NextResponse } from "next/server";
import {
  createWorkOrder,
  fetchWorkOrders,
} from "@/app/maintenance/lib/work-order-db";
import { WorkOrderInput } from "@/app/maintenance/lib/maintenance-types";
import { getSupabaseAdmin } from "@/app/maintenance/lib/pm-db";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const openOnly = searchParams.get("open") === "1";
    const supabase = getSupabaseAdmin();
    const workOrders = await fetchWorkOrders(
      supabase,
      openOnly ? { status: ["Open", "In Progress"] } : undefined
    );
    return NextResponse.json({ workOrders });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as WorkOrderInput;
    if (!body.subject?.trim()) {
      return NextResponse.json({ error: "Subject is required." }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    const workOrder = await createWorkOrder(supabase, body);
    return NextResponse.json({ workOrder });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
