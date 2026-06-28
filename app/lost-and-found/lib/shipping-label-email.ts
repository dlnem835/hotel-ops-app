import { HotelProperty } from "@/app/settings/lib/hotel-property-types";

const UPS_LABEL_URL = "https://www.ups.com/ship/guided/origin";
const FEDEX_LABEL_URL = "https://www.fedex.com/en-us/shipping.html";

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function formatMultilineHtml(value: string): string {
  return escapeHtml(value).replace(/\n/g, "<br/>");
}

function buildShipFromBlock(property: HotelProperty): string {
  const { hotelName, address, phoneNumber } = property;
  const hasAddressInfo = Boolean(hotelName.trim() || address.trim());

  const nameLine = hotelName.trim()
    ? `<div style="color:#ffffff;font-weight:700;margin-top:8px;">${escapeHtml(hotelName.trim())}</div>`
    : "";

  const addressLine = address.trim()
    ? `<div style="margin-top:8px;line-height:1.6;">${formatMultilineHtml(address.trim())}</div>`
    : hasAddressInfo
      ? ""
      : `<div style="margin-top:8px;color:#8F8F8F;line-height:1.6;">Please contact the front desk for the hotel return address.</div>`;

  const phoneLine = phoneNumber.trim()
    ? `<div style="margin-top:8px;">Phone: ${escapeHtml(phoneNumber.trim())}</div>`
    : "";

  return `
      <div style="background:#1A1A1D;border:1px solid #2E2E2E;border-radius:14px;padding:18px;margin:24px 0;">
        <p style="margin:0;color:#C8A96A;font-weight:800;font-size:13px;letter-spacing:0.4px;text-transform:uppercase;">Ship From</p>
        ${nameLine}
        ${addressLine}
        ${phoneLine}
      </div>`;
}

type ShippingLabelEmailParams = {
  itemName: string;
  uploadLink: string;
  property: HotelProperty;
};

export function buildShippingLabelEmailHtml({
  itemName,
  uploadLink,
  property,
}: ShippingLabelEmailParams): string {
  const safeItemName = escapeHtml(itemName.trim() || "Your item");
  const safeUploadLink = escapeHtml(uploadLink);

  return `
<div style="background:#0B0B0D;padding:28px;font-family:Arial,sans-serif;color:#F5F1E8;">
  <div style="max-width:560px;margin:0 auto;background:#121214;border-radius:18px;overflow:hidden;border:1px solid #2A2A2A;box-shadow:0 18px 45px rgba(0,0,0,0.35);">
    <div style="background:#080808;text-align:center;padding:28px 22px;border-bottom:3px solid #C8A96A;">
      <div style="color:#ffffff;font-size:34px;font-weight:800;letter-spacing:3px;">ONE</div>
      <div style="color:#C8A96A;font-size:13px;letter-spacing:7px;margin-top:4px;">— EYRIE —</div>
      <div style="color:#B8B8B8;font-size:13px;margin-top:12px;">Lost &amp; Found Shipping Request</div>
    </div>

    <div style="padding:30px;">
      <h2 style="text-align:center;margin:0 0 18px;font-size:24px;color:#ffffff;">
        We&rsquo;ve Located Your Item
      </h2>

      <p style="line-height:1.6;color:#D8D8D8;margin-bottom:18px;">
        Hello,
      </p>

      <p style="line-height:1.6;color:#D8D8D8;margin-bottom:0;">
        Our Front Desk team has located your lost item. To have it returned, please create a prepaid shipping label using the hotel return address below.
      </p>

      ${buildShipFromBlock(property)}

      <div style="background:#1A1A1D;border:1px solid #2E2E2E;border-radius:14px;padding:18px;margin:0 0 24px;">
        <p style="margin:0 0 8px;color:#C8A96A;font-weight:800;font-size:13px;letter-spacing:0.4px;text-transform:uppercase;">Item</p>
        <p style="margin:0;color:#ffffff;font-weight:700;line-height:1.5;">${safeItemName}</p>
      </div>

      <div style="background:#0F0F11;border:1px solid #2E2E2E;border-radius:14px;padding:18px;margin:0 0 24px;">
        <p style="margin:0 0 12px;color:#ffffff;font-weight:700;">Instructions</p>
        <ol style="margin:0;padding-left:20px;color:#D8D8D8;line-height:1.7;">
          <li>Click UPS or FedEx below.</li>
          <li>Use the hotel address above as the Ship From / Return Address.</li>
          <li>Create and pay for the shipping label.</li>
          <li>Upload the PDF label using the upload link below.</li>
        </ol>
      </div>

      <div style="background:#1A1A1D;border:1px solid #2E2E2E;border-radius:14px;padding:18px;margin:0 0 24px;">
        <a href="${UPS_LABEL_URL}"
          style="display:block;text-align:center;padding:14px 18px;background:#C8A96A;color:#111111;border-radius:10px;text-decoration:none;font-weight:800;margin-bottom:10px;">
          Create UPS Label
        </a>

        <a href="${FEDEX_LABEL_URL}"
          style="display:block;text-align:center;padding:13px 18px;background:#242428;color:#ffffff;border:1px solid #3A3A3A;border-radius:10px;text-decoration:none;font-weight:700;margin-bottom:10px;">
          Create FedEx Label
        </a>

        <a href="${safeUploadLink}"
          style="display:block;text-align:center;padding:15px 18px;background:#C8A96A;color:#111111;border-radius:10px;text-decoration:none;font-weight:800;">
          Upload Shipping Label
        </a>

        <p style="font-size:12px;color:#8F8F8F;margin-top:14px;margin-bottom:0;text-align:center;">
          This secure upload link expires in 7 days.
        </p>
      </div>

      <p style="margin-top:24px;color:#D8D8D8;line-height:1.6;margin-bottom:0;">
        Thank you,<br/>
        <strong style="color:#ffffff;">Front Desk Team</strong>
      </p>
    </div>
  </div>
</div>`;
}
