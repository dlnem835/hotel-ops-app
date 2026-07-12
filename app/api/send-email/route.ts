import { Resend } from "resend";
import { buildShippingLabelEmailHtml } from "@/app/lost-and-found/lib/shipping-label-email";
import { fetchHotelProperty } from "@/app/settings/lib/hotel-property-db";
import {
  resolveTenantRequest,
  tenantErrorResponse,
} from "@/app/lib/tenant/server/resolve-tenant-request";

const resendApiKey = process.env.RESEND_API_KEY;

if (!resendApiKey) {
  throw new Error("Missing environment variables");
}

const resend = new Resend(resendApiKey);

export async function POST(req: Request) {
  try {
    const { supabase, organizationId, propertyId } = await resolveTenantRequest(req);
    const { email, link, itemId } = await req.json();

    // Verify the item belongs to the caller's active tenant before doing anything.
    const { data: item, error: itemError } = await supabase
      .from("lost_items")
      .select("item_name")
      .eq("id", itemId)
      .eq("organization_id", organizationId)
      .eq("property_id", propertyId)
      .maybeSingle();

    if (itemError) {
      return Response.json({ success: false, error: itemError.message }, { status: 500 });
    }
    if (!item) {
      return Response.json({ success: false, error: "Lost item not found" }, { status: 404 });
    }

    // NOTE (Checkpoint 7): hotel property config is not yet property-scoped; it
    // returns the single pilot property record. Scope this once Settings is migrated.
    const property = await fetchHotelProperty(supabase);

    const itemName = item.item_name ? String(item.item_name) : "Your item";

    const html = buildShippingLabelEmailHtml({
      itemName,
      uploadLink: link,
      property,
    });

    const result = await resend.emails.send({
      from: "Front Desk One Eyrie <support@oneeyrie.com>",
      to: email,
      subject: "Shipping Label Request",
      html,
    });

    if (result.error) {
      return Response.json({ success: false, error: result.error });
    }

    const now = new Date().toISOString();
    await supabase
      .from("lost_items")
      .update({
        label_requested_at: now,
        label_sent_at: now,
        status: "Label sent",
      })
      .eq("id", itemId)
      .eq("organization_id", organizationId)
      .eq("property_id", propertyId);

    return Response.json({ success: true, result });
  } catch (error) {
    return tenantErrorResponse(error);
  }
}
