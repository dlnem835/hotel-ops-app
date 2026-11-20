import { NextResponse } from "next/server";
import { createHistoricalShippingLabelSignedUrl } from "@/app/lib/lost-found-shipping/historical-label-access";
import {
  resolveTenantRequest,
  tenantErrorResponse,
} from "@/app/lib/tenant/server/resolve-tenant-request";

type RouteContext = {
  params: Promise<{ id: string }>;
};

/** Staff-only: signed URL for a historical public shipping-labels PDF. */
export async function GET(request: Request, context: RouteContext) {
  try {
    const { supabase, organizationId, propertyId } =
      await resolveTenantRequest(request);
    const { id } = await context.params;
    const lostItemId = Number(id);
    if (!Number.isFinite(lostItemId)) {
      return NextResponse.json({ error: "Invalid id" }, { status: 400 });
    }

    const signed = await createHistoricalShippingLabelSignedUrl(
      supabase,
      { organizationId, propertyId },
      lostItemId
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
