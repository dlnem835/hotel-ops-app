import {
  resolveTenantRequest,
  tenantErrorResponse,
} from "@/app/lib/tenant/server/resolve-tenant-request";
import { updateLostItem } from "@/app/lost-and-found/lib/lost-found-server-db";
import { coerceLostItemStatusForWrite } from "@/app/lib/lost-found-shipping/status";

export async function POST(request: Request) {
  try {
    const { supabase, organizationId, propertyId } = await resolveTenantRequest(request);
    const { id, status } = await request.json();

    await updateLostItem(supabase, id, { organizationId, propertyId }, {
      status: coerceLostItemStatusForWrite(status),
    });

    return Response.json({ success: true });
  } catch (error) {
    return tenantErrorResponse(error);
  }
}
