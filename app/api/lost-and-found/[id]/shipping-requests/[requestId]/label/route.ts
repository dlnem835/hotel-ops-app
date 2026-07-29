import { NextResponse } from "next/server";
import { createShippingLabelSignedUrl } from "@/app/lib/lost-found-shipping/shipping-requests";
import {
  resolveTenantRequest,
  tenantErrorResponse,
} from "@/app/lib/tenant/server/resolve-tenant-request";

type RouteContext = {
  params: Promise<{ id: string; requestId: string }>;
};

/** Staff-only: signed URL for purchased automated shipping label PDF. */
export async function GET(request: Request, context: RouteContext) {
  try {
    const { supabase, organizationId, propertyId } =
      await resolveTenantRequest(request);
    const { id, requestId } = await context.params;
    const lostItemId = Number(id);
    const shippingRequestId = Number(requestId);
    if (!Number.isFinite(lostItemId) || !Number.isFinite(shippingRequestId)) {
      return NextResponse.json({ error: "Invalid id" }, { status: 400 });
    }

    const signed = await createShippingLabelSignedUrl(
      supabase,
      { organizationId, propertyId },
      { lostItemId, shippingRequestId }
    );

    if (!signed) {
      return NextResponse.json(
        { error: "No shipping label file is available." },
        { status: 404 }
      );
    }

    return NextResponse.json({ url: signed.url });
  } catch (error: unknown) {
    return tenantErrorResponse(error);
  }
}
