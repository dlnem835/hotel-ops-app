import "server-only";

import { escapeHtml } from "@/app/lib/email/escape-html";
import { ONE_EYRIE as C } from "@/app/lib/oneEyrieColors";
import {
  darkFill,
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

function buildShipFromBlock(
  propertyName: string,
  phone: string,
  address: string
): string {
  const hasAddressInfo = Boolean(propertyName || address);

  const nameLine = propertyName
    ? `<div style="color:${C.text} !important;font-weight:700;margin-top:8px;${darkFill(C.surfacePanel)}">${escapeHtml(propertyName)}</div>`
    : "";

  const addressLine = address
    ? `<div style="margin-top:8px;line-height:1.6;color:${C.textMuted} !important;${darkFill(C.surfacePanel)}">${formatMultilineHtml(address)}</div>`
    : hasAddressInfo
      ? ""
      : `<div style="margin-top:8px;color:${C.textSubtle} !important;line-height:1.6;${darkFill(C.surfacePanel)}">Please contact the front desk for the hotel return address.</div>`;

  const phoneLine = phone
    ? `<div style="margin-top:8px;color:${C.textMuted} !important;${darkFill(C.surfacePanel)}">Phone: ${escapeHtml(phone)}</div>`
    : "";

  return `
      <div style="${darkFill(C.surfacePanel)}border:1px solid ${C.border};border-radius:12px;padding:16px;margin:20px 0;">
        <p style="margin:0;color:${C.gold} !important;font-weight:800;font-size:12px;letter-spacing:0.28em;text-transform:uppercase;${darkFill(C.surfacePanel)}">Ship From</p>
        ${nameLine}
        ${addressLine}
        ${phoneLine}
      </div>`;
}

/**
 * Guest email for automated Shippo/Stripe shipping.
 * Pre-Shippo dark visual format; single CTA to guest shipping URL (no carrier buttons).
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
      <p style="line-height:1.6;color:${C.textMuted} !important;margin:0 0 14px;${darkFill(C.surface)}">
        ${hello.html}
      </p>

      <p style="line-height:1.6;color:${C.textMuted} !important;margin:0;${darkFill(C.surface)}">
        Good news — <strong style="color:${C.text} !important;">${escapeHtml(propertyName)}</strong>
        has located <strong style="color:${C.text} !important;">${escapeHtml(itemName)}</strong>
        and can ship it back to you.
      </p>

      ${buildShipFromBlock(propertyName, phone, address)}

      <div style="${darkFill(C.surfacePanel)}border:1px solid ${C.border};border-radius:12px;padding:16px;margin:0 0 20px;">
        <p style="margin:0 0 8px;color:${C.gold} !important;font-weight:800;font-size:12px;letter-spacing:0.28em;text-transform:uppercase;${darkFill(C.surfacePanel)}">Item</p>
        <p style="margin:0;color:${C.text} !important;font-weight:700;line-height:1.5;${darkFill(C.surfacePanel)}">${escapeHtml(itemName)}</p>
      </div>

      <div style="${darkFill(C.surfacePanel)}border:1px solid ${C.borderDivider};border-radius:12px;padding:16px;margin:0 0 20px;">
        <p style="margin:0 0 12px;color:${C.text} !important;font-weight:700;${darkFill(C.surfacePanel)}">Instructions</p>
        <ol style="margin:0;padding-left:20px;color:${C.textMuted} !important;line-height:1.7;">
          <li>Click <strong style="color:${C.text} !important;">${escapeHtml(AUTOMATED_SHIPPING_EMAIL_CTA)}</strong> below.</li>
          <li>Confirm your address and choose a shipping option.</li>
          <li>Pay for return shipping securely on the next page.</li>
          <li>You&rsquo;ll pick the carrier and service there.</li>
        </ol>
      </div>

      ${
        expiryLabel
          ? `<p style="margin:0 0 4px;font-size:13px;line-height:1.6;color:${C.textSubtle} !important;${darkFill(C.surface)}">This link remains available until ${escapeHtml(expiryLabel)}.</p>`
          : ""
      }
  `;

  const html = renderGuestShippingRequestEmailHtml({
    heading: AUTOMATED_SHIPPING_EMAIL_HEADING,
    preheader: `${propertyName} can ship ${itemName} back to you.`,
    bodyHtml,
    cta: {
      label: AUTOMATED_SHIPPING_EMAIL_CTA,
      url: input.guestShippingUrl,
    },
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
