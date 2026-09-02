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
  TenantRequestError,
} from "@/app/lib/tenant/server/resolve-tenant-request";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  classifyWorkOrderItemIssue,
  isWorkOrderItemIssue,
} from "@/app/maintenance/lib/work-order-item-issues";
import { fetchWorkOrderPhotos } from "@/app/maintenance/lib/work-order-photos-db";

type RouteContext = { params: Promise<{ id: string }> };

async function enrichWorkOrder(
  supabase: SupabaseClient,
  workOrder: WorkOrder,
  scope: { organizationId: number; propertyId: number }
) {
  const memberResolver = await fetchMemberDisplayNameResolver(supabase);
  const photos = await fetchWorkOrderPhotos(supabase, workOrder.id, scope);

  return {
    ...workOrder,
    createdByLabel: workOrder.createdBy
      ? memberResolver.resolveStoredValue(workOrder.createdBy)
      : null,
    completedByLabel: workOrder.completedBy
      ? memberResolver.resolveStoredValue(workOrder.completedBy)
      : null,
    photos: photos.map((photo) => ({
      ...photo,
      uploadedByLabel: photo.uploadedBy
        ? memberResolver.resolveStoredValue(photo.uploadedBy)
        : null,
    })),
  };
}

export async function GET(request: Request, context: RouteContext) {
  try {
    const { supabase, organizationId, propertyId } = await resolveTenantRequest(
      request
    );
    const scope = { organizationId, propertyId };
    const { id } = await context.params;
    const workOrder = await fetchWorkOrderById(supabase, Number(id), scope);
    if (!workOrder) {
      return NextResponse.json({ error: "Work order not found." }, { status: 404 });
    }
    return NextResponse.json({
      workOrder: await enrichWorkOrder(supabase, workOrder, scope),
    });
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
    if (body.status === "Completed") {
      const resolution = String(body.comments ?? "").trim();
      if (!resolution) {
        throw new TenantRequestError(
          400,
          "Resolution is required before completing a work order."
        );
      }
      body.comments = resolution;
    }
    if (body.item !== undefined) {
      const item = String(body.item || "").trim();
      body.item = isWorkOrderItemIssue(item)
        ? item
        : classifyWorkOrderItemIssue({
            structuredItem: item,
            description: existing.description,
            details: existing.sourceNote,
          });
    }
    const workOrder = await updateWorkOrder(supabase, Number(id), body, scope);
    return NextResponse.json({
      workOrder: await enrichWorkOrder(supabase, workOrder, scope),
    });
  } catch (error: unknown) {
    return tenantErrorResponse(error);
  }
}
