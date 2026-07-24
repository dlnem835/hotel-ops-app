import { NextResponse } from "next/server";
import {
  createShippingRequest,
  listShippingRequestsForItem,
  listShippingTimelineForRequest,
} from "@/app/lib/lost-found-shipping/shipping-requests";
import {
  deriveShippingCurrentStep,
  deriveShippingUiBadge,
} from "@/app/lib/lost-found-shipping/status";
import { shippingTimelineLabel } from "@/app/lib/lost-found-shipping/timeline";
import {
  resolveTenantRequest,
  tenantErrorResponse,
} from "@/app/lib/tenant/server/resolve-tenant-request";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(request: Request, context: RouteContext) {
  try {
    const { supabase, organizationId, propertyId } = await resolveTenantRequest(
      request
    );
    const { id } = await context.params;
    const lostItemId = Number(id);
    if (!Number.isFinite(lostItemId)) {
      return NextResponse.json({ error: "Invalid item id" }, { status: 400 });
    }

    const scope = { organizationId, propertyId };
    const requests = await listShippingRequestsForItem(
      supabase,
      scope,
      lostItemId
    );

    const withTimeline = await Promise.all(
      requests.map(async (row) => {
        const timeline = await listShippingTimelineForRequest(
          supabase,
          scope,
          row.id
        );
        const statusInput = {
          paymentStatus: row.paymentStatus,
          fulfillmentStatus: row.fulfillmentStatus,
          shipmentStatus: row.shipmentStatus,
          tokenExpiresAt: row.tokenExpiresAt,
          cancelledAt: row.cancelledAt,
          selectedCarrier: row.selectedCarrier,
          selectedService: row.selectedService,
          providerRateId: row.providerRateId,
        };
        return {
          ...row,
          badge: deriveShippingUiBadge(statusInput),
          currentStep: deriveShippingCurrentStep(statusInput),
          timeline: timeline.map((entry) => ({
            ...entry,
            label: shippingTimelineLabel(entry.eventType),
            notes:
              typeof entry.eventData.notes === "string"
                ? entry.eventData.notes
                : null,
          })),
        };
      })
    );

    return NextResponse.json({ requests: withTimeline });
  } catch (error: unknown) {
    return tenantErrorResponse(error);
  }
}

export async function POST(request: Request, context: RouteContext) {
  try {
    const { supabase, user, organizationId, propertyId } =
      await resolveTenantRequest(request);
    const { id } = await context.params;
    const lostItemId = Number(id);
    if (!Number.isFinite(lostItemId)) {
      return NextResponse.json({ error: "Invalid item id" }, { status: 400 });
    }

    const body = (await request.json()) as Record<string, unknown>;
    const result = await createShippingRequest(
      supabase,
      { organizationId, propertyId },
      {
        lostItemId,
        guestName: String(body.guestName ?? body.guest_name ?? ""),
        guestEmail: String(body.guestEmail ?? body.guest_email ?? ""),
        guestPhone: String(body.guestPhone ?? body.guest_phone ?? ""),
        itemDescriptionPublic: String(
          body.itemDescriptionPublic ?? body.item_description_public ?? ""
        ),
        internalNotes: String(body.internalNotes ?? body.internal_notes ?? ""),
        packagePreset: String(body.packagePreset ?? body.package_preset ?? "small_box"),
        weightOz: Number(body.weightOz ?? body.weight_oz),
        lengthIn: Number(body.lengthIn ?? body.length_in),
        widthIn: Number(body.widthIn ?? body.width_in),
        heightIn: Number(body.heightIn ?? body.height_in),
        createdBy: user.id,
      }
    );

    return NextResponse.json({
      request: {
        ...result.request,
        badge: deriveShippingUiBadge({
          paymentStatus: result.request.paymentStatus,
          fulfillmentStatus: result.request.fulfillmentStatus,
          shipmentStatus: result.request.shipmentStatus,
          tokenExpiresAt: result.request.tokenExpiresAt,
          cancelledAt: result.request.cancelledAt,
        }),
      },
      // Phase 3 emails the guest; until then staff copies this link.
      guestUrl: result.guestUrl,
    });
  } catch (error: unknown) {
    return tenantErrorResponse(error);
  }
}
