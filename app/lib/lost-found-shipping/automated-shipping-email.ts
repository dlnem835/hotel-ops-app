import "server-only";

import { escapeHtml } from "@/app/lib/email/escape-html";
import { EMAIL_THEME as T } from "@/app/lib/email/brand";
import { renderTransactionalEmailHtml } from "@/app/lib/email/transactional-layout";
import { AUTOMATED_SHIPPING_EMAIL_CTA } from "@/app/lib/lost-found-shipping/email-copy";

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

/**
 * Guest email for automated Shippo/Stripe shipping (single CTA — no carrier buttons).
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

  const contactLinesHtml = [
    phone
      ? `<div style="margin-top:6px;color:${T.textMuted};">Phone: ${escapeHtml(phone)}</div>`
      : "",
    address
      ? `<div style="margin-top:8px;line-height:1.55;color:${T.textMuted};">${escapeHtml(address)}</div>`
      : "",
  ].join("");

  const bodyHtml = `
    <p style="margin:0 0 16px;">${hello.html}</p>
    <p style="margin:0 0 16px;">
      Good news — <strong style="color:${T.text};">${escapeHtml(propertyName)}</strong>
      has located <strong style="color:${T.text};">${escapeHtml(itemName)}</strong>
      and can ship it back to you.
    </p>
    <p style="margin:0 0 16px;">
      Use the secure link below to confirm your address, choose a shipping option,
      and pay for return shipping. You&rsquo;ll pick the carrier and service on the next page.
    </p>
    <div style="background:${T.charcoal};border:1px solid ${T.border};border-radius:14px;padding:16px;margin:0 0 8px;">
      <p style="margin:0 0 6px;color:${T.gold};font-size:12px;font-weight:800;letter-spacing:0.08em;text-transform:uppercase;">
        Hotel contact
      </p>
      <div style="color:${T.text};font-weight:700;">${escapeHtml(propertyName)}</div>
      ${contactLinesHtml}
    </div>
    ${
      expiryLabel
        ? `<p style="margin:16px 0 0;font-size:13px;color:${T.textSubtle};">This link remains available until ${escapeHtml(expiryLabel)}.</p>`
        : ""
    }
  `;

  const html = renderTransactionalEmailHtml({
    kind: "guest-shipping",
    heading: "We've Located Your Item",
    preheader: `${propertyName} can ship ${itemName} back to you.`,
    bodyHtml,
    cta: {
      label: AUTOMATED_SHIPPING_EMAIL_CTA,
      url: input.guestShippingUrl,
    },
    supportMessage: phone
      ? `Questions about your item? Contact ${propertyName} at ${phone}.`
      : `Questions about your item? Contact the front desk at ${propertyName}.`,
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
