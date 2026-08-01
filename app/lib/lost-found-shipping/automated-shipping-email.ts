import "server-only";

import { escapeHtml } from "@/app/lib/email/escape-html";
import {
  GUEST_SHIPPING_EMAIL_COLORS as K,
  paint,
  renderGuestShippingRequestEmailHtml,
} from "@/app/lib/lost-found-shipping/guest-shipping-request-email-layout";
import {
  AUTOMATED_SHIPPING_EMAIL_CTA,
  AUTOMATED_SHIPPING_EMAIL_HEADING,
} from "@/app/lib/lost-found-shipping/email-copy";

export type AutomatedShippingEmailInput = {
  guestName?: string | null;
  itemName: string;
  propertyName: string;
  propertyPhone?: string | null;
  /** Kept for internal ops callers; not rendered in guest email content. */
  propertyReturnEmail?: string | null;
  propertyAddressLine?: string | null;
  guestShippingUrl: string;
  expiresAt?: string | null;
};

export type AutomatedShippingEmailContent = {
  subject: string;
  html: string;
  text: string;
};

function greeting(guestName?: string | null): { html: string; text: string } {
  const name = guestName?.trim();
  if (name) {
    return {
      html: `Hello ${escapeHtml(name)},`,
      text: `Hello ${name},`,
    };
  }
  return { html: "Hello,", text: "Hello," };
}

function formatExpiry(expiresAt?: string | null): string | null {
  if (!expiresAt) return null;
  const date = new Date(expiresAt);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatMultilineHtml(value: string): string {
  return escapeHtml(value).replace(/\n/g, "<br/>");
}

function cardLabel(text: string): string {
  return `<tr ${paint(K.card)}><td ${paint(K.card, `padding:0 0 10px;font-family:Arial,Helvetica,sans-serif;font-size:11px;font-weight:800;letter-spacing:0.2em;text-transform:uppercase;color:${K.gold};`)}><span style="color:${K.gold};">${escapeHtml(text)}</span></td></tr>`;
}

function buildHotelCard(
  propertyName: string,
  phone: string,
  address: string
): string {
  const hasAddressInfo = Boolean(propertyName || address);

  const nameRow = propertyName
    ? `<tr ${paint(K.card)}><td ${paint(K.card, `padding:0 0 8px;font-family:Arial,Helvetica,sans-serif;font-size:15px;font-weight:700;color:${K.primary};`)}><span style="color:${K.primary};">${escapeHtml(propertyName)}</span></td></tr>`
    : "";

  const addressRow = address
    ? `<tr ${paint(K.card)}><td ${paint(K.card, `padding:0 0 6px;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.55;color:${K.secondary};`)}><span style="color:${K.secondary};">${formatMultilineHtml(address)}</span></td></tr>`
    : hasAddressInfo
      ? ""
      : `<tr ${paint(K.card)}><td ${paint(K.card, `padding:0 0 6px;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.55;color:${K.secondary};`)}><span style="color:${K.secondary};">Please contact the front desk for hotel details.</span></td></tr>`;

  const phoneRow = phone
    ? `<tr ${paint(K.card)}><td ${paint(K.card, `padding:0;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.55;color:${K.secondary};`)}><span style="color:${K.secondary};">${escapeHtml(phone)}</span></td></tr>`
    : "";

  return `
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" ${paint(K.card, `width:100%;border:1px solid ${K.border};border-radius:12px;margin:0 0 14px;`)}>
      <tr ${paint(K.card)}>
        <td ${paint(K.card, "padding:16px;")}>
          <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" ${paint(K.card, "width:100%;")}>
            ${cardLabel("Hotel")}
            ${nameRow}
            ${addressRow}
            ${phoneRow}
          </table>
        </td>
      </tr>
    </table>`;
}

/**
 * Guest email for automated Shippo/Stripe shipping.
 * Minimal light template; single CTA to guest shipping URL.
 */
export function buildAutomatedShippingEmail(
  input: AutomatedShippingEmailInput
): AutomatedShippingEmailContent {
  const propertyName = input.propertyName.trim() || "the hotel";
  const itemName = input.itemName.trim() || "your item";
  const hello = greeting(input.guestName);
  const expiryLabel = formatExpiry(input.expiresAt);
  const phone = input.propertyPhone?.trim() || "";
  const address = input.propertyAddressLine?.trim() || "";

  const subject = `${propertyName} found your item — arrange return shipping`;

  const bodyHtml = `
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" ${paint(K.white, "width:100%;")}>
      <tr ${paint(K.white)}>
        <td ${paint(K.white, `padding:0 0 12px;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.6;color:${K.secondary};`)}>
          <span style="color:${K.secondary};">${hello.html}</span>
        </td>
      </tr>
      <tr ${paint(K.white)}>
        <td ${paint(K.white, `padding:0 0 22px;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.6;color:${K.secondary};`)}>
          <span style="color:${K.secondary};">
            Good news — <strong style="color:${K.primary};font-weight:700;">${escapeHtml(propertyName)}</strong>
            has located <strong style="color:${K.primary};font-weight:700;">${escapeHtml(itemName)}</strong>
            and can ship it back to you.
          </span>
        </td>
      </tr>
    </table>

    ${buildHotelCard(propertyName, phone, address)}

    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" ${paint(K.card, `width:100%;border:1px solid ${K.border};border-radius:12px;margin:0 0 22px;`)}>
      <tr ${paint(K.card)}>
        <td ${paint(K.card, "padding:16px;")}>
          <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" ${paint(K.card, "width:100%;")}>
            ${cardLabel("Item")}
            <tr ${paint(K.card)}>
              <td ${paint(K.card, `font-family:Arial,Helvetica,sans-serif;font-size:15px;font-weight:700;line-height:1.5;color:${K.primary};`)}>
                <span style="color:${K.primary};">${escapeHtml(itemName)}</span>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  `;

  const belowCtaHtml = expiryLabel
    ? `<span style="font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:1.55;color:${K.secondary};">This link remains available until ${escapeHtml(expiryLabel)}.</span>`
    : undefined;

  const html = renderGuestShippingRequestEmailHtml({
    heading: AUTOMATED_SHIPPING_EMAIL_HEADING,
    preheader: `${propertyName} can ship ${itemName} back to you.`,
    bodyHtml,
    cta: {
      label: AUTOMATED_SHIPPING_EMAIL_CTA,
      url: input.guestShippingUrl,
    },
    belowCtaHtml,
    supportBlurb: phone
      ? `Questions? Contact ${escapeHtml(propertyName)} at ${escapeHtml(phone)}.`
      : `Questions? Contact the front desk at ${escapeHtml(propertyName)}.`,
  });

  const textLines = [
    hello.text,
    "",
    `Good news — ${propertyName} has located ${itemName} and can ship it back to you.`,
    "",
    "Use this secure link to confirm your address, choose a shipping option, and pay for return shipping:",
    input.guestShippingUrl,
    "",
    `Hotel: ${propertyName}`,
    phone ? `Phone: ${phone}` : null,
    address ? `Address: ${address}` : null,
    expiryLabel ? `Link available until: ${expiryLabel}` : null,
    "",
    "One Eyrie — Hotel Operations Platform",
  ].filter((line): line is string => line != null);

  return {
    subject,
    html,
    text: textLines.join("\n"),
  };
}
