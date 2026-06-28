import { Resend } from "resend";
import { createClient } from "@supabase/supabase-js";
import { buildShippingLabelEmailHtml } from "@/app/lost-and-found/lib/shipping-label-email";
import {
  fetchHotelProperty,
  getSupabaseAdmin,
} from "@/app/settings/lib/hotel-property-db";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const resendApiKey = process.env.RESEND_API_KEY;

if (!supabaseUrl || !supabaseAnonKey || !resendApiKey) {
  throw new Error("Missing environment variables");
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);
const resend = new Resend(resendApiKey);

export async function POST(req: Request) {
  try {
    const { email, link, itemId } = await req.json();

    const [property, itemResult] = await Promise.all([
      fetchHotelProperty(getSupabaseAdmin()),
      supabase
        .from("lost_items")
        .select("item_name")
        .eq("id", itemId)
        .maybeSingle(),
    ]);

    const itemName = itemResult.data?.item_name
      ? String(itemResult.data.item_name)
      : "Your item";

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

    await supabase
      .from("lost_items")
      .update({
        label_requested_at: new Date().toISOString(),
        status: "Label sent",
      })
      .eq("id", itemId);

    return Response.json({ success: true, result });
  } catch (error) {
    return Response.json({ success: false, error }, { status: 500 });
  }
}
