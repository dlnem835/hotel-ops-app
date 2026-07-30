import { NextResponse } from "next/server";
import {
  resolveTenantRequest,
  tenantErrorResponse,
} from "@/app/lib/tenant/server/resolve-tenant-request";
import { assertAdminPortalDeleteAccess } from "@/app/lib/org-admin/server/assert-admin-portal-delete-access";
import {
  updateLostItem,
  deleteLostItem,
} from "@/app/lost-and-found/lib/lost-found-server-db";
import { coerceLostItemStatusForWrite } from "@/app/lib/lost-found-shipping/status";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { supabase, organizationId, propertyId } = await resolveTenantRequest(request);
    const body = await request.json();

    const patch: Record<string, string | null> = {};
    if (typeof body.status === "string") {
      patch.status = coerceLostItemStatusForWrite(body.status);
    }
    if (typeof body.comments === "string") patch.comments = body.comments;

    if (Object.keys(patch).length === 0) {
      return NextResponse.json({ error: "No updatable fields provided" }, { status: 400 });
    }

    const item = await updateLostItem(supabase, id, { organizationId, propertyId }, patch);
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
