import { NextResponse } from "next/server";
import { issueGuestShippingLink } from "@/app/lib/lost-found-shipping/shipping-requests";
import {
  resolveTenantRequest,
  tenantErrorResponse,
} from "@/app/lib/tenant/server/resolve-tenant-request";

type RouteContext = {
  params: Promise<{ id: string; requestId: string }>;
};

/** Staff-only: issue/rotate a guest shipping URL for copy/open. */
export async function POST(request: Request, context: RouteContext) {
  try {
    const { supabase, user, organizationId, propertyId } =
      await resolveTenantRequest(request);
    const { id, requestId } = await context.params;
    const lostItemId = Number(id);
    const shippingRequestId = Number(requestId);
    if (!Number.isFinite(lostItemId) || !Number.isFinite(shippingRequestId)) {
      return NextResponse.json({ error: "Invalid id" }, { status: 400 });
    }

    const result = await issueGuestShippingLink(
      supabase,
      { organizationId, propertyId },
      {
        lostItemId,
        shippingRequestId,
        createdBy: user.id,
      }
    );

    return NextResponse.json(result);
  } catch (error: unknown) {
    return tenantErrorResponse(error);
  }
}
