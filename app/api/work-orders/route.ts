import { NextResponse } from "next/server";
import {
  createWorkOrder,
  fetchWorkOrders,
} from "@/app/maintenance/lib/work-order-db";
import { WorkOrderInput } from "@/app/maintenance/lib/maintenance-types";
import {
  classifyWorkOrderItemIssue,
  isWorkOrderItemIssue,
} from "@/app/maintenance/lib/work-order-item-issues";
import { fetchMemberDisplayNameResolver } from "@/app/lib/member-display-name";
import {
  resolveTenantRequest,
  tenantErrorResponse,
} from "@/app/lib/tenant/server/resolve-tenant-request";

export async function GET(request: Request) {
  try {
    const { supabase, organizationId, propertyId } = await resolveTenantRequest(
      request
    );
    const { searchParams } = new URL(request.url);
    const openOnly = searchParams.get("open") === "1";
    const scope = { organizationId, propertyId };
    const [workOrders, memberResolver] = await Promise.all([
      fetchWorkOrders(supabase, {
        scope,
        ...(openOnly ? { status: ["Open", "In Progress"] } : {}),
      }),
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
    return tenantErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const { supabase, organizationId, propertyId } = await resolveTenantRequest(
      request
    );
    const body = (await request.json()) as WorkOrderInput;
    if (!body.subject?.trim()) {
      return NextResponse.json(
        { error: "Work order title is required." },
        { status: 400 }
      );
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
    body.item = isWorkOrderItemIssue(String(body.item || ""))
      ? body.item
      : classifyWorkOrderItemIssue({
          structuredItem: body.item,
          description: body.description,
          details: body.source_note,
        });

    const workOrder = await createWorkOrder(supabase, body, {
      organizationId,
      propertyId,
    });
    return NextResponse.json({ workOrder });
  } catch (error: unknown) {
    return tenantErrorResponse(error);
  }
}
