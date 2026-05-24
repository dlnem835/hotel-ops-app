import { Resend } from "resend";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(req: Request) {
  try {
    const { email, link, itemId } = await req.json();

    console.log("EMAIL:", email);
    console.log("ITEM ID:", itemId);

    const result = await resend.emails.send({
      from: "Front Desk One Eyrie <support@oneeyrie.com>",
      to: email,
      subject: "Shipping Label Request",
      html: `
        <h2>Shipping Label Request</h2>

        <p>Hello,</p>

        <p>We've located your item.</p>

        <p>Please create a prepaid shipping label using UPS or FedEx below:</p>

        <p>
          <a href="https://www.ups.com/ship/guided/origin"
            style="display:inline-block;padding:12px 18px;background:#0070f3;color:white;border-radius:6px;text-decoration:none;margin-right:10px;">
            Create UPS Label
          </a>

          <a href="https://www.fedex.com/en-us/shipping.html"
            style="display:inline-block;padding:12px 18px;background:#ff6600;color:white;border-radius:6px;text-decoration:none;">
            Create FedEx Label
          </a>
        </p>

        <p>Once completed, upload your label here:</p>

        <p>
          <a href="${link}"
            style="display:inline-block;padding:14px 20px;background:black;color:white;border-radius:6px;text-decoration:none;">
            Upload Shipping Label
          </a>
        </p>

        <hr />

        <p>
          <strong>Ship To Address:</strong><br/>
          SpringHill Suites Tampa Suncoast Parkway<br/>
          16615 Crosspointe Run<br/>
          Land O Lakes, FL 34638<br/>
          Phone: 813-536-1900
        </p>

        <p>Thank you,<br/>Front Desk Team</p>
      `,
    });

    if (result.error) {
      return Response.json({ success: false, error: result.error });
    }

    // ✅ THIS IS YOUR TIMESTAMP + STATUS UPDATE
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
