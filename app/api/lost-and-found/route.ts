import { NextResponse } from "next/server";
import {
  resolveTenantRequest,
  tenantErrorResponse,
} from "@/app/lib/tenant/server/resolve-tenant-request";
import {
  listLostItems,
  createLostItem,
} from "@/app/lost-and-found/lib/lost-found-server-db";
import {
  coerceLostItemStatusForWrite,
  LOST_ITEM_STATUS,
} from "@/app/lib/lost-found-shipping/status";

export async function GET(request: Request) {
  try {
    const { supabase, organizationId, propertyId } = await resolveTenantRequest(request);
    const items = await listLostItems(supabase, { organizationId, propertyId });
    return NextResponse.json({ items });
  } catch (error) {
    return tenantErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const { supabase, organizationId, propertyId, user } = await resolveTenantRequest(request);
    const body = await request.json();

    const payload: Record<string, string | null> = {
      item_name: body.item_name ?? null,
      room_number: body.room_number ?? null,
      guest_last_name: body.guest_last_name ?? null,
      found_by: body.found_by ?? null,
      status: coerceLostItemStatusForWrite(
        body.status,
        LOST_ITEM_STATUS.stored
      ),
      created_by: user.id,
    };

    if (body.comments) {
      payload.comments = body.comments;
    }

    const item = await createLostItem(supabase, { organizationId, propertyId }, payload);
    return NextResponse.json({ item });
  } catch (error) {
    return tenantErrorResponse(error);
  }
}
