import { NextResponse } from "next/server";
import {
  GuestShippingEmailConfigError,
  GuestShippingEmailSendError,
} from "@/app/lib/lost-found-shipping/dispatch-guest-shipping-email";
import { sendGuestShippingRequest } from "@/app/lib/lost-found-shipping/send-guest-shipping-request";
import {
  resolveTenantRequest,
  tenantErrorResponse,
} from "@/app/lib/tenant/server/resolve-tenant-request";

type RouteContext = { params: Promise<{ id: string }> };

/**
 * Staff: create/reuse automated shipping request and email the guest via Resend.
 * Used by the Lost & Found table "Send Request" action and modal resend.
 */
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
    const result = await sendGuestShippingRequest(
      supabase,
      { organizationId, propertyId },
      {
        lostItemId,
        guestEmail: String(body.guestEmail ?? body.guest_email ?? ""),
        guestName: String(body.guestName ?? body.guest_name ?? ""),
        guestPhone: String(body.guestPhone ?? body.guest_phone ?? ""),
        itemDescriptionPublic: String(
          body.itemDescriptionPublic ?? body.item_description_public ?? ""
        ),
        internalNotes: String(body.internalNotes ?? body.internal_notes ?? ""),
        packagePreset: body.packagePreset
          ? String(body.packagePreset)
          : body.package_preset
            ? String(body.package_preset)
            : undefined,
        weightOz:
          body.weightOz != null || body.weight_oz != null
            ? Number(body.weightOz ?? body.weight_oz)
            : undefined,
        lengthIn:
          body.lengthIn != null || body.length_in != null
            ? Number(body.lengthIn ?? body.length_in)
            : undefined,
        widthIn:
          body.widthIn != null || body.width_in != null
            ? Number(body.widthIn ?? body.width_in)
            : undefined,
        heightIn:
          body.heightIn != null || body.height_in != null
            ? Number(body.heightIn ?? body.height_in)
            : undefined,
        createdBy: user.id,
      }
    );

    return NextResponse.json({
      ok: true,
      requestId: result.requestId,
      guestUrl: result.guestUrl,
      created: result.created,
      resent: result.resent,
      emailMessageId: result.emailMessageId,
      emailFrom: result.emailFrom,
      guestEmail: result.guestEmail,
      message: result.resent
        ? "Guest shipping email resent successfully."
        : "Guest shipping request created and email sent successfully.",
    });
  } catch (error: unknown) {
    if (error instanceof GuestShippingEmailConfigError) {
      return NextResponse.json(
        {
          error: error.message,
          missing: error.missing,
          code: "email_config",
        },
        { status: 503 }
      );
    }
    if (error instanceof GuestShippingEmailSendError) {
      return NextResponse.json(
        {
          error: `Email was not sent: ${error.message}`,
          code: "email_send_failed",
        },
        { status: 502 }
      );
    }
    return tenantErrorResponse(error);
  }
}
