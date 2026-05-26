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
<div style="background:#f4f1ed;padding:24px;font-family:Arial,sans-serif;color:#111;">
  <div style="max-width:520px;margin:0 auto;background:#ffffff;border-radius:10px;overflow:hidden;border:1px solid #ddd;">
    
    <!-- Header -->
    <div style="background:#080808;text-align:center;padding:22px;border-bottom:4px solid #C8A96A;">
      <div style="color:#fff;font-size:34px;font-weight:bold;letter-spacing:2px;">ONE</div>
      <div style="color:#C8A96A;font-size:13px;letter-spacing:6px;">— EYRIE —</div>
    </div>

    <!-- Body -->
    <div style="padding:28px;">
      <h2 style="text-align:center;margin:0 0 22px;font-size:24px;">
        Your Lost Item Shipping Label
      </h2>

      <p>Hello,</p>

      <p style="line-height:1.5;">
        We've located your item. Please create a prepaid shipping label using UPS or FedEx below.
      </p>

      <!-- Buttons -->
      <div style="margin:18px 0;">
        <a href="https://www.ups.com/ship/guided/origin"
          style="display:inline-block;padding:10px 16px;background:#0070f3;color:white;border-radius:6px;text-decoration:none;margin-right:8px;">
          UPS
        </a>

        <a href="https://www.fedex.com/en-us/shipping.html"
          style="display:inline-block;padding:10px 16px;background:#ff6600;color:white;border-radius:6px;text-decoration:none;">
          FedEx
        </a>
      </div>

      <!-- Upload -->
      <div style="text-align:center;margin:24px 0;">
        <a href="${link}"
          style="background:#C8A96A;color:#111;text-decoration:none;padding:14px 26px;border-radius:6px;font-weight:bold;display:inline-block;">
          Upload Shipping Label
        </a>
      </div>

      <p style="font-size:13px;color:#666;text-align:center;">
        This link will expire in 7 days.
      </p>

      <hr style="border:none;border-top:1px solid #ddd;margin:24px 0;" />

      <!-- Address -->
      <p>
        <strong>Shipping From:</strong><br/>
        SpringHill Suites Tampa Suncoast Parkway<br/>
        16615 Crosspointe Run<br/>
        Land O Lakes, FL 34638<br/>
        Phone: 813-536-1900
      </p>

      <p style="margin-top:20px;">
        Thank you,<br/>
        <strong>Front Desk Team</strong>
      </p>
    </div>
  </div>
</div>
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
