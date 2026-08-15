import { NextResponse } from "next/server";
import {
  resolveTenantRequest,
  tenantErrorResponse,
  TenantRequestError,
} from "@/app/lib/tenant/server/resolve-tenant-request";
import { assertAdminPortalDeleteAccess } from "@/app/lib/org-admin/server/assert-admin-portal-delete-access";
import { updateLostItem } from "@/app/lost-and-found/lib/lost-found-server-db";
import {
  coerceLostItemStatusForWrite,
  LOST_ITEM_STATUS,
  normalizeLostItemStatus,
  SHIPPO_OWNED_LOST_ITEM_STATUSES,
} from "@/app/lib/lost-found-shipping/status";
import { lostItemHasLiveShippingTracking } from "@/app/lib/lost-found-shipping/shipping-status-ownership";
import {
  appendShippingEvent,
} from "@/app/lib/lost-found-shipping/shipping-requests";
import { SHIPPING_TIMELINE_EVENTS } from "@/app/lib/lost-found-shipping/timeline";

/**
 * Administrator-only Correct Shipment Status override.
 * Requires confirmation payload: status + mandatory reason.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { supabase, user, organizationId, propertyId } =
      await resolveTenantRequest(request);
    await assertAdminPortalDeleteAccess(supabase, user.id, organizationId);

    const body = await request.json().catch(() => ({}));
    const nextStatus = coerceLostItemStatusForWrite(body.status);
    const reason = String(body.reason || "").trim();
    const confirmed = body.confirmed === true;

    if (!confirmed) {
      throw new TenantRequestError(
        400,
        "Confirmation is required to correct shipment status."
      );
    }
    if (reason.length < 5) {
      throw new TenantRequestError(
        400,
        "A reason of at least 5 characters is required."
      );
    }
    if (
      !(SHIPPO_OWNED_LOST_ITEM_STATUSES as readonly string[]).includes(
        nextStatus
      )
    ) {
      throw new TenantRequestError(
        400,
        "Correct Shipment Status only targets Ready to Ship, Shipped, or Delivered."
      );
    }

    const lostItemId = Number(id);
    const { data: current, error } = await supabase
      .from("lost_items")
      .select("id, status")
      .eq("id", lostItemId)
      .eq("organization_id", organizationId)
      .eq("property_id", propertyId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!current) throw new TenantRequestError(404, "Lost item not found");

    const previousStatus =
      normalizeLostItemStatus(String(current.status || "")) ||
      String(current.status || LOST_ITEM_STATUS.stored);

    if (previousStatus === nextStatus) {
      throw new TenantRequestError(400, "Item is already in that status.");
    }

    const hasTracking = await lostItemHasLiveShippingTracking(supabase, {
      lostItemId,
      organizationId,
      propertyId,
    });
    if (!hasTracking) {
      throw new TenantRequestError(
        400,
        "Correct Shipment Status is only available after a live shipping label and tracking number exist."
      );
    }

    const nowIso = new Date().toISOString();
    const item = await updateLostItem(
      supabase,
      id,
      { organizationId, propertyId },
      {
        status: nextStatus,
        status_manual_override: true,
        status_manual_override_at: nowIso,
        status_manual_override_by: user.id,
        status_manual_override_reason: reason.slice(0, 1000),
        status_manual_override_previous: previousStatus,
      }
    );

    // Prefer attaching timeline to the latest active shipping request.
    const { data: shippingRequest } = await supabase
      .from("lost_found_shipping_requests")
      .select("id")
      .eq("lost_item_id", lostItemId)
      .eq("organization_id", organizationId)
      .eq("property_id", propertyId)
      .is("cancelled_at", null)
      .order("id", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (shippingRequest?.id) {
      await appendShippingEvent(supabase, {
        organizationId,
        propertyId,
        lostItemId,
        shippingRequestId: Number(shippingRequest.id),
        eventType: SHIPPING_TIMELINE_EVENTS.statusManuallyCorrected,
        eventSource: "staff",
        createdBy: user.id,
        eventData: {
          notes: reason.slice(0, 1000),
          previousStatus,
          newStatus: nextStatus,
          correctedBy: user.id,
          correctedAt: nowIso,
          warning:
            "Future carrier tracking updates may overwrite this manual override.",
        },
      });
    }

    return NextResponse.json({
      item,
      previousStatus,
      newStatus: nextStatus,
      manuallyOverridden: true,
    });
  } catch (error) {
    return tenantErrorResponse(error);
  }
}
