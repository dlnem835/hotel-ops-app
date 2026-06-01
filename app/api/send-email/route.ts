import { Resend } from "resend";
import { createClient } from "@supabase/supabase-js";


const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const resendApiKey = process.env.RESEND_API_KEY;

if (!supabaseUrl || !supabaseAnonKey || !resendApiKey) {
  throw new Error("Missing environment variables");
}

const supabase = createClient(
  supabaseUrl,
  supabaseAnonKey
);

const resend = new Resend(resendApiKey);


export async function POST(req: Request) {
  try {
    const { email, link, itemId } = await req.json();


    const result = await resend.emails.send({
      from: "Front Desk One Eyrie <support@oneeyrie.com>",
      to: email,
      subject: "Shipping Label Request",
     html: `
<div style="background:#0B0B0D;padding:28px;font-family:Arial,sans-serif;color:#F5F1E8;">
  <div style="max-width:560px;margin:0 auto;background:#121214;border-radius:18px;overflow:hidden;border:1px solid #2A2A2A;box-shadow:0 18px 45px rgba(0,0,0,0.35);">
    
    <div style="background:#080808;text-align:center;padding:28px 22px;border-bottom:3px solid #C8A96A;">
      <div style="color:#ffffff;font-size:34px;font-weight:800;letter-spacing:3px;">ONE</div>
      <div style="color:#C8A96A;font-size:13px;letter-spacing:7px;margin-top:4px;">— EYRIE —</div>
      <div style="color:#B8B8B8;font-size:13px;margin-top:12px;">Lost & Found Shipping Request</div>
    </div>

    <div style="padding:30px;">
      <h2 style="text-align:center;margin:0 0 18px;font-size:24px;color:#ffffff;">
        We’ve Located Your Item
      </h2>

      <p style="line-height:1.6;color:#D8D8D8;margin-bottom:18px;">
        Hello,
      </p>

      <p style="line-height:1.6;color:#D8D8D8;">
        Our Front Desk team has located your lost item. To have it returned, please create a prepaid shipping label using one of the carrier options below.
      </p>

      <div style="background:#1A1A1D;border:1px solid #2E2E2E;border-radius:14px;padding:18px;margin:24px 0;">
        <p style="margin:0 0 12px;color:#ffffff;font-weight:bold;">Create your prepaid label:</p>

        <a href="https://www.ups.com/ship/guided/origin"
          style="display:block;text-align:center;padding:14px 18px;background:#C8A96A;color:#111111;border-radius:10px;text-decoration:none;font-weight:800;margin-bottom:10px;">
          UPS (Recommended)
        </a>

        <a href="https://www.fedex.com/en-us/shipping.html"
          style="display:block;text-align:center;padding:13px 18px;background:#242428;color:#ffffff;border:1px solid #3A3A3A;border-radius:10px;text-decoration:none;font-weight:700;">
          FedEx
        </a>
      </div>

      <div style="background:#0F0F11;border:1px solid #C8A96A;border-radius:14px;padding:20px;text-align:center;margin:26px 0;">
        <p style="margin:0 0 14px;color:#D8D8D8;line-height:1.5;">
          After creating your label, upload the PDF below so our team can prepare your item for shipping.
        </p>

        <a href="${link}"
          style="background:#C8A96A;color:#111111;text-decoration:none;padding:15px 28px;border-radius:12px;font-weight:800;display:inline-block;">
          Upload Shipping Label
        </a>

        <p style="font-size:12px;color:#8F8F8F;margin-top:14px;margin-bottom:0;">
          This secure upload link expires in 7 days.
        </p>
      </div>

      <div style="border-top:1px solid #2E2E2E;margin:26px 0 20px;"></div>

      <p style="line-height:1.6;color:#D8D8D8;margin-bottom:0;">
        <strong style="color:#ffffff;">Shipping From:</strong><br/>
        SpringHill Suites Tampa Suncoast Parkway<br/>
        16615 Crosspointe Run<br/>
        Land O Lakes, FL 34638<br/>
        Phone: 813-536-1900
      </p>

      <p style="margin-top:24px;color:#D8D8D8;line-height:1.6;">
        Thank you,<br/>
        <strong style="color:#ffffff;">Front Desk Team</strong>
      </p>
    </div>
  </div>
</div>
`,
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