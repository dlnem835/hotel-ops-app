import { NextResponse } from "next/server";
import { fetchMemberDisplayNameResolver } from "@/app/lib/member-display-name";
import {
  resolveTenantRequest,
  tenantErrorResponse,
  TenantRequestError,
} from "@/app/lib/tenant/server/resolve-tenant-request";
import { findLikelyDuplicateWorkOrders } from "@/app/maintenance/lib/work-order-duplicate-detection";
import { fetchWorkOrders } from "@/app/maintenance/lib/work-order-db";
import {
  classifyWorkOrderItemIssue,
  isWorkOrderItemIssue,
} from "@/app/maintenance/lib/work-order-item-issues";

export async function POST(request: Request) {
  try {
    const { supabase, organizationId, propertyId } = await resolveTenantRequest(
      request
    );

    const body = (await request.json().catch(() => null)) as {
      subject?: string;
      description?: string;
      item?: string | null;
      area_id?: number | null;
      area_label?: string | null;
    } | null;

    const subject = String(body?.subject || "").trim();
    const description = String(body?.description || "").trim();
    const areaId =
      typeof body?.area_id === "number" && Number.isFinite(body.area_id)
        ? body.area_id
        : null;
    const areaLabel = String(body?.area_label || "").trim() || null;

    if (!areaId && !areaLabel) {
      throw new TenantRequestError(400, "Location is required for duplicate checks.");
    }
    if (!description) {
      throw new TenantRequestError(400, "Description is required for duplicate checks.");
    }

    const rawItem = String(body?.item || "").trim();
    const item = isWorkOrderItemIssue(rawItem)
      ? rawItem
      : classifyWorkOrderItemIssue({
          structuredItem: rawItem,
          description,
          details: subject,
        });

    const active = await fetchWorkOrders(supabase, {
      status: ["Open", "In Progress"],
      scope: { organizationId, propertyId },
    });

    const memberResolver = await fetchMemberDisplayNameResolver(supabase);
    const enriched = active.map((wo) => ({
      ...wo,
      createdByLabel: wo.createdBy
        ? memberResolver.resolveStoredValue(wo.createdBy)
        : null,
    }));

    const candidates = await findLikelyDuplicateWorkOrders({
      draft: {
        areaId,
        areaLabel,
        item,
        description,
        subject,
      },
      activeWorkOrders: enriched,
    });

    return NextResponse.json({
      hasDuplicates: candidates.length > 0,
      candidates,
    });
  } catch (error: unknown) {
    return tenantErrorResponse(error);
  }
}
