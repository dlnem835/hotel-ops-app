import { NextResponse } from "next/server";
import { retryLabelForPaidShippingRequest } from "@/app/lib/lost-found-shipping/retry-label-for-paid-request";
import {
  resolveTenantRequest,
  tenantErrorResponse,
} from "@/app/lib/tenant/server/resolve-tenant-request";

type RouteContext = {
  params: Promise<{ id: string; requestId: string }>;
};

/**
 * Staff: retry Shippo label purchase after Stripe payment succeeded.
 * Never creates a new guest charge. Tenant-scoped to the active property.
 */
export async function POST(request: Request, context: RouteContext) {
  try {
    const { supabase, organizationId, propertyId } =
      await resolveTenantRequest(request);
    const { id, requestId } = await context.params;
    const lostItemId = Number(id);
    const shippingRequestId = Number(requestId);
    if (!Number.isFinite(lostItemId) || !Number.isFinite(shippingRequestId)) {
      return NextResponse.json({ error: "Invalid id" }, { status: 400 });
    }

    const { data: row, error } = await supabase
      .from("lost_found_shipping_requests")
      .select("id, organization_id, property_id, lost_item_id, payment_status")
      .eq("id", shippingRequestId)
      .eq("lost_item_id", lostItemId)
      .eq("organization_id", organizationId)
      .eq("property_id", propertyId)
      .maybeSingle();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    if (!row) {
      return NextResponse.json(
        { error: "Shipping request not found for this property." },
        { status: 404 }
      );
    }
    if (String(row.payment_status) !== "paid") {
      return NextResponse.json(
        {
          error:
            "Payment is not paid yet. Retry Label Creation is only available after Stripe payment succeeds.",
        },
        { status: 409 }
      );
    }

    const result = await retryLabelForPaidShippingRequest(
      supabase,
      shippingRequestId,
      { actor: "staff" }
    );

    if (!result.ok && !result.skipped) {
      return NextResponse.json(
        {
          error: result.message || "Label purchase failed",
          trackingNumber: result.trackingNumber,
        },
        { status: 502 }
      );
    }

    return NextResponse.json({
      ok: result.ok,
      skipped: result.skipped,
      message: result.message,
      trackingNumber: result.trackingNumber,
      providerRateId: result.providerRateId,
    });
  } catch (error: unknown) {
    return tenantErrorResponse(error);
  }
}
