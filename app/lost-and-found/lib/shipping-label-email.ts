import { HotelProperty } from "@/app/settings/lib/hotel-property-types";
import { ONE_EYRIE } from "@/app/lib/oneEyrieColors";

const UPS_LABEL_URL = "https://www.ups.com/ship/guided/origin";
const FEDEX_LABEL_URL = "https://www.fedex.com/en-us/shipping.html";
const USPS_LABEL_URL = "https://cnsb.usps.com/";

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
    ? `<div style="color:${ONE_EYRIE.text};font-weight:700;margin-top:8px;">${escapeHtml(hotelName.trim())}</div>`
    : "";

  const addressLine = address.trim()
    ? `<div style="margin-top:8px;line-height:1.6;color:${ONE_EYRIE.textMuted};">${formatMultilineHtml(address.trim())}</div>`
    : hasAddressInfo
      ? ""
      : `<div style="margin-top:8px;color:${ONE_EYRIE.textSubtle};line-height:1.6;">Please contact the front desk for the hotel return address.</div>`;

  const phoneLine = phoneNumber.trim()
    ? `<div style="margin-top:8px;color:${ONE_EYRIE.textMuted};">Phone: ${escapeHtml(phoneNumber.trim())}</div>`
    : "";

  return `
      <div style="background:${ONE_EYRIE.row};border:1px solid ${ONE_EYRIE.border};border-radius:14px;padding:18px;margin:24px 0;">
        <p style="margin:0;color:${ONE_EYRIE.gold};font-weight:800;font-size:12px;letter-spacing:0.28em;text-transform:uppercase;">Ship From</p>
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
<div style="background:${ONE_EYRIE.black};padding:28px;font-family:Arial,sans-serif;color:${ONE_EYRIE.text};">
  <div style="max-width:560px;margin:0 auto;background:${ONE_EYRIE.surface};border-radius:18px;overflow:hidden;border:1px solid ${ONE_EYRIE.gold};box-shadow:0 20px 50px rgba(0,0,0,0.45);">
    <div style="background:${ONE_EYRIE.surfacePanel};text-align:center;padding:28px 22px 24px;border-bottom:3px solid ${ONE_EYRIE.gold};">
      <div style="font-size:13px;font-weight:700;letter-spacing:0.28em;line-height:1.25;text-transform:uppercase;">
        <div style="color:${ONE_EYRIE.text};">ONE</div>
        <div style="color:${ONE_EYRIE.gold};margin-top:2px;">EYRIE</div>
      </div>
      <div style="color:${ONE_EYRIE.textSubtle};font-size:12px;margin-top:14px;letter-spacing:0.08em;text-transform:uppercase;">Lost &amp; Found Shipping Request</div>
    </div>

    <div style="padding:30px 28px;">
      <h2 style="text-align:center;margin:0 0 18px;font-size:24px;color:${ONE_EYRIE.text};font-weight:800;">
        Your Lost Item Has Been Found
      </h2>

      <p style="line-height:1.6;color:${ONE_EYRIE.textMuted};margin-bottom:18px;">
        Hello,
      </p>

      <p style="line-height:1.6;color:${ONE_EYRIE.textMuted};margin-bottom:0;">
        Our Front Desk team has located your lost item. To have it returned, please create a prepaid shipping label using the hotel return address below.
      </p>

      ${buildShipFromBlock(property)}

      <div style="background:${ONE_EYRIE.row};border:1px solid ${ONE_EYRIE.border};border-radius:14px;padding:18px;margin:0 0 24px;">
        <p style="margin:0 0 8px;color:${ONE_EYRIE.gold};font-weight:800;font-size:12px;letter-spacing:0.28em;text-transform:uppercase;">Item</p>
        <p style="margin:0;color:${ONE_EYRIE.text};font-weight:700;line-height:1.5;">${safeItemName}</p>
      </div>

      <div style="background:${ONE_EYRIE.surfaceInset};border:1px solid ${ONE_EYRIE.borderDivider};border-radius:14px;padding:18px;margin:0 0 24px;">
        <p style="margin:0 0 12px;color:${ONE_EYRIE.text};font-weight:700;">Instructions</p>
        <ol style="margin:0;padding-left:20px;color:${ONE_EYRIE.textMuted};line-height:1.7;">
          <li>Click UPS, FedEx, or USPS below.</li>
          <li>Use the hotel address above as the Ship From / Return Address.</li>
          <li>Create and pay for the shipping label.</li>
          <li>Upload the PDF label using the upload link below.</li>
        </ol>
      </div>

      <div style="background:${ONE_EYRIE.row};border:1px solid ${ONE_EYRIE.border};border-radius:14px;padding:18px;margin:0 0 24px;">
        <a href="${UPS_LABEL_URL}"
          style="display:block;text-align:center;padding:14px 18px;background:#644117;color:#ffffff;border-radius:12px;text-decoration:none;font-weight:800;margin-bottom:10px;">
          Create UPS Label
        </a>

        <a href="${FEDEX_LABEL_URL}"
          style="display:block;text-align:center;padding:14px 18px;background:#FF6600;color:#ffffff;border-radius:12px;text-decoration:none;font-weight:800;margin-bottom:10px;">
          Create FedEx Label
        </a>

        <a href="${USPS_LABEL_URL}"
          style="display:block;text-align:center;padding:14px 18px;background:#004B87;color:#ffffff;border-radius:12px;text-decoration:none;font-weight:800;margin-bottom:10px;">
          Create USPS Label
        </a>

        <a href="${safeUploadLink}"
          style="display:block;text-align:center;padding:15px 18px;background:${ONE_EYRIE.gold};color:${ONE_EYRIE.black};border-radius:12px;text-decoration:none;font-weight:800;box-shadow:0 10px 24px rgba(200,169,106,0.22);">
          Upload Shipping Label
        </a>

        <p style="font-size:12px;color:${ONE_EYRIE.textSubtle};margin-top:14px;margin-bottom:0;text-align:center;">
          This secure upload link expires in 7 days.
        </p>
      </div>

      <p style="margin-top:24px;color:${ONE_EYRIE.textMuted};line-height:1.6;margin-bottom:0;">
        Thank you,<br/>
        <strong style="color:${ONE_EYRIE.text};">Front Desk Team</strong>
      </p>
    </div>
  </div>
</div>`;
}
