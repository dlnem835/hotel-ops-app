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

function darkFill(color: string): string {
  return `background-color:${color} !important;background-image:linear-gradient(${color},${color}) !important;`;
}

function buildShipFromBlock(property: HotelProperty): string {
  const { hotelName, address, phoneNumber } = property;
  const hasAddressInfo = Boolean(hotelName.trim() || address.trim());

  const nameLine = hotelName.trim()
    ? `<div style="color:${ONE_EYRIE.text} !important;font-weight:700;margin-top:8px;${darkFill(ONE_EYRIE.surfacePanel)}">${escapeHtml(hotelName.trim())}</div>`
    : "";

  const addressLine = address.trim()
    ? `<div style="margin-top:8px;line-height:1.6;color:${ONE_EYRIE.textMuted} !important;${darkFill(ONE_EYRIE.surfacePanel)}">${formatMultilineHtml(address.trim())}</div>`
    : hasAddressInfo
      ? ""
      : `<div style="margin-top:8px;color:${ONE_EYRIE.textSubtle} !important;line-height:1.6;${darkFill(ONE_EYRIE.surfacePanel)}">Please contact the front desk for the hotel return address.</div>`;

  const phoneLine = phoneNumber.trim()
    ? `<div style="margin-top:8px;color:${ONE_EYRIE.textMuted} !important;${darkFill(ONE_EYRIE.surfacePanel)}">Phone: ${escapeHtml(phoneNumber.trim())}</div>`
    : "";

  return `
      <div style="${darkFill(ONE_EYRIE.surfacePanel)}border:1px solid ${ONE_EYRIE.border};border-radius:12px;padding:16px;margin:20px 0;">
        <p style="margin:0;color:${ONE_EYRIE.gold} !important;font-weight:800;font-size:12px;letter-spacing:0.28em;text-transform:uppercase;${darkFill(ONE_EYRIE.surfacePanel)}">Ship From</p>
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

/** Legacy manual carrier email — same dark One Eyrie surfaces as automated shipping. */
export function buildShippingLabelEmailHtml({
  itemName,
  uploadLink,
  property,
}: ShippingLabelEmailParams): string {
  const safeItemName = escapeHtml(itemName.trim() || "Your item");
  const safeUploadLink = escapeHtml(uploadLink);

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta name="color-scheme" content="dark only" />
  <meta name="supported-color-schemes" content="dark only" />
  <style type="text/css">
    :root { color-scheme: dark only; }
    body { margin:0 !important; padding:0 !important; background-color:${ONE_EYRIE.black} !important; }
    a[x-apple-data-detectors] { color: ${ONE_EYRIE.textMuted} !important; text-decoration: none !important; }
  </style>
</head>
<body bgcolor="${ONE_EYRIE.black}" style="margin:0;padding:0;width:100%;${darkFill(ONE_EYRIE.black)}font-family:Arial,sans-serif;color:${ONE_EYRIE.text};">
<div style="${darkFill(ONE_EYRIE.black)}padding:24px 16px;">
  <div style="max-width:600px;margin:0 auto;${darkFill(ONE_EYRIE.surface)}border-radius:14px;overflow:hidden;border:1px solid ${ONE_EYRIE.gold};">
    <div style="${darkFill(ONE_EYRIE.surfacePanel)}text-align:center;padding:20px 22px 16px;border-bottom:2px solid ${ONE_EYRIE.gold};">
      <div style="font-size:13px;font-weight:700;letter-spacing:0.28em;line-height:1.25;text-transform:uppercase;">
        <div style="color:${ONE_EYRIE.text} !important;">ONE</div>
        <div style="color:${ONE_EYRIE.gold} !important;margin-top:2px;">EYRIE</div>
      </div>
      <div style="color:${ONE_EYRIE.textSubtle} !important;font-size:12px;margin-top:12px;letter-spacing:0.08em;text-transform:uppercase;">Lost &amp; Found Shipping Request</div>
    </div>

    <div style="padding:24px;${darkFill(ONE_EYRIE.surface)}">
      <h2 style="text-align:center;margin:0 0 16px;font-size:22px;color:${ONE_EYRIE.text} !important;font-weight:800;${darkFill(ONE_EYRIE.surface)}">
        Your Lost Item Has Been Found
      </h2>

      <p style="line-height:1.6;color:${ONE_EYRIE.textMuted} !important;margin:0 0 14px;${darkFill(ONE_EYRIE.surface)}">
        Hello,
      </p>

      <p style="line-height:1.6;color:${ONE_EYRIE.textMuted} !important;margin:0;${darkFill(ONE_EYRIE.surface)}">
        Our Front Desk team has located your lost item. To have it returned, please create a prepaid shipping label using the hotel return address below.
      </p>

      ${buildShipFromBlock(property)}

      <div style="${darkFill(ONE_EYRIE.surfacePanel)}border:1px solid ${ONE_EYRIE.border};border-radius:12px;padding:16px;margin:0 0 20px;">
        <p style="margin:0 0 8px;color:${ONE_EYRIE.gold} !important;font-weight:800;font-size:12px;letter-spacing:0.28em;text-transform:uppercase;${darkFill(ONE_EYRIE.surfacePanel)}">Item</p>
        <p style="margin:0;color:${ONE_EYRIE.text} !important;font-weight:700;line-height:1.5;${darkFill(ONE_EYRIE.surfacePanel)}">${safeItemName}</p>
      </div>

      <div style="${darkFill(ONE_EYRIE.surfacePanel)}border:1px solid ${ONE_EYRIE.borderDivider};border-radius:12px;padding:16px;margin:0 0 20px;">
        <p style="margin:0 0 12px;color:${ONE_EYRIE.text} !important;font-weight:700;${darkFill(ONE_EYRIE.surfacePanel)}">Instructions</p>
        <ol style="margin:0;padding-left:20px;color:${ONE_EYRIE.textMuted} !important;line-height:1.7;">
          <li>Click UPS, FedEx, or USPS below.</li>
          <li>Use the hotel address above as the Ship From / Return Address.</li>
          <li>Create and pay for the shipping label.</li>
          <li>Upload the PDF label using the upload link below.</li>
        </ol>
      </div>

      <p style="text-align:center;margin:0 0 12px;">
        <a href="${UPS_LABEL_URL}" style="display:inline-block;margin:4px;padding:12px 16px;background:${ONE_EYRIE.gold};color:${ONE_EYRIE.black} !important;text-decoration:none;font-weight:800;border-radius:8px;">UPS</a>
        <a href="${FEDEX_LABEL_URL}" style="display:inline-block;margin:4px;padding:12px 16px;background:${ONE_EYRIE.gold};color:${ONE_EYRIE.black} !important;text-decoration:none;font-weight:800;border-radius:8px;">FedEx</a>
        <a href="${USPS_LABEL_URL}" style="display:inline-block;margin:4px;padding:12px 16px;background:${ONE_EYRIE.gold};color:${ONE_EYRIE.black} !important;text-decoration:none;font-weight:800;border-radius:8px;">USPS</a>
      </p>

      <p style="text-align:center;margin:20px 0 0;">
        <a href="${safeUploadLink}" style="display:inline-block;min-height:50px;line-height:50px;padding:0 28px;background:${ONE_EYRIE.gold};color:${ONE_EYRIE.black} !important;text-decoration:none;font-weight:800;border-radius:8px;">Upload Shipping Label</a>
      </p>
    </div>
  </div>
</div>
</body>
</html>`;
}
