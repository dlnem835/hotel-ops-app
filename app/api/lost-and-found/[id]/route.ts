import { NextResponse } from "next/server";
import {
  resolveTenantRequest,
  tenantErrorResponse,
  TenantRequestError,
} from "@/app/lib/tenant/server/resolve-tenant-request";
import { assertAdminPortalDeleteAccess } from "@/app/lib/org-admin/server/assert-admin-portal-delete-access";
import {
  updateLostItem,
  deleteLostItem,
} from "@/app/lost-and-found/lib/lost-found-server-db";
import {
  coerceLostItemStatusForWrite,
  isShippoOwnedLostItemStatus,
  isStaffEditableLostItemStatus,
} from "@/app/lib/lost-found-shipping/status";
import { lostItemHasLiveShippingTracking } from "@/app/lib/lost-found-shipping/shipping-status-ownership";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { supabase, organizationId, propertyId } =
      await resolveTenantRequest(request);
    const body = await request.json();

    const patch: Record<string, string | number | boolean | null> = {};
    if (typeof body.status === "string") {
      const nextStatus = coerceLostItemStatusForWrite(body.status);
      const hasTracking = await lostItemHasLiveShippingTracking(supabase, {
        lostItemId: Number(id),
        organizationId,
        propertyId,
      });

      if (hasTracking && isShippoOwnedLostItemStatus(nextStatus)) {
        throw new TenantRequestError(
          403,
          "Ready to Ship, Shipped, and Delivered are controlled by carrier tracking once a live label exists. Use Correct Shipment Status (Admin Portal) to override."
        );
      }

      // Still allow operational statuses while tracking is active.
      if (hasTracking && !isStaffEditableLostItemStatus(nextStatus)) {
        throw new TenantRequestError(403, "That status cannot be set manually.");
      }

      patch.status = nextStatus;
      // Clearing tracking-owned statuses via operational edit also clears override badge.
      if (isStaffEditableLostItemStatus(nextStatus)) {
        patch.status_manual_override = false;
        patch.status_manual_override_at = null;
        patch.status_manual_override_by = null;
        patch.status_manual_override_reason = null;
        patch.status_manual_override_previous = null;
      }
    }
    if (typeof body.comments === "string") patch.comments = body.comments;

    if (Object.keys(patch).length === 0) {
      return NextResponse.json(
        { error: "No updatable fields provided" },
        { status: 400 }
      );
    }

    const item = await updateLostItem(
      supabase,
      id,
      { organizationId, propertyId },
      patch
    );
    return NextResponse.json({ item });
  } catch (error) {
    return tenantErrorResponse(error);
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { supabase, user, organizationId, propertyId } =
      await resolveTenantRequest(request);
    await assertAdminPortalDeleteAccess(supabase, user.id, organizationId);
    await deleteLostItem(supabase, id, { organizationId, propertyId });
    return NextResponse.json({ success: true });
  } catch (error) {
    return tenantErrorResponse(error);
  }
}
