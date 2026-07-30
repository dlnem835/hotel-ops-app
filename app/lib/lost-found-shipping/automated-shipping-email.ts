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
      ? `<tr><td bgcolor="${T.charcoal}" style="padding-top:6px;background-color:${T.charcoal};background-image:linear-gradient(${T.charcoal},${T.charcoal});color:${T.textMuted} !important;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.55;">Phone: ${escapeHtml(phone)}</td></tr>`
      : "",
    address
      ? `<tr><td bgcolor="${T.charcoal}" style="padding-top:8px;background-color:${T.charcoal};background-image:linear-gradient(${T.charcoal},${T.charcoal});color:${T.textMuted} !important;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.55;">${escapeHtml(address)}</td></tr>`
      : "",
  ].join("");

  const bodyHtml = `
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" bgcolor="${T.card}" style="width:100%;background-color:${T.card};background-image:linear-gradient(${T.card},${T.card});">
      <tr>
        <td bgcolor="${T.card}" style="padding:0 0 16px;background-color:${T.card};background-image:linear-gradient(${T.card},${T.card});font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.7;color:${T.textMuted} !important;">
          ${hello.html}
        </td>
      </tr>
      <tr>
        <td bgcolor="${T.card}" style="padding:0 0 16px;background-color:${T.card};background-image:linear-gradient(${T.card},${T.card});font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.7;color:${T.textMuted} !important;">
          Good news — <strong style="color:${T.text} !important;">${escapeHtml(propertyName)}</strong>
          has located <strong style="color:${T.text} !important;">${escapeHtml(itemName)}</strong>
          and can ship it back to you.
        </td>
      </tr>
      <tr>
        <td bgcolor="${T.card}" style="padding:0 0 16px;background-color:${T.card};background-image:linear-gradient(${T.card},${T.card});font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.7;color:${T.textMuted} !important;">
          Use the secure link below to confirm your address, choose a shipping option,
          and pay for return shipping. You&rsquo;ll pick the carrier and service on the next page.
        </td>
      </tr>
      <tr>
        <td bgcolor="${T.card}" style="padding:0 0 8px;background-color:${T.card};background-image:linear-gradient(${T.card},${T.card});">
          <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" bgcolor="${T.charcoal}" style="width:100%;background-color:${T.charcoal};background-image:linear-gradient(${T.charcoal},${T.charcoal});border:1px solid ${T.border};border-radius:14px;">
            <tr>
              <td bgcolor="${T.charcoal}" style="padding:16px;background-color:${T.charcoal};background-image:linear-gradient(${T.charcoal},${T.charcoal});">
                <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" bgcolor="${T.charcoal}" style="background-color:${T.charcoal};background-image:linear-gradient(${T.charcoal},${T.charcoal});">
                  <tr>
                    <td bgcolor="${T.charcoal}" style="background-color:${T.charcoal};background-image:linear-gradient(${T.charcoal},${T.charcoal});color:${T.gold} !important;font-family:Arial,Helvetica,sans-serif;font-size:12px;font-weight:800;letter-spacing:0.08em;text-transform:uppercase;">
                      Hotel contact
                    </td>
                  </tr>
                  <tr>
                    <td bgcolor="${T.charcoal}" style="padding-top:6px;background-color:${T.charcoal};background-image:linear-gradient(${T.charcoal},${T.charcoal});color:${T.text} !important;font-family:Arial,Helvetica,sans-serif;font-size:15px;font-weight:700;">
                      ${escapeHtml(propertyName)}
                    </td>
                  </tr>
                  ${contactLinesHtml}
                </table>
              </td>
            </tr>
          </table>
        </td>
      </tr>
      ${
        expiryLabel
          ? `<tr><td bgcolor="${T.card}" style="padding:16px 0 0;background-color:${T.card};background-image:linear-gradient(${T.card},${T.card});font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:1.5;color:${T.textSubtle} !important;">This link remains available until ${escapeHtml(expiryLabel)}.</td></tr>`
          : ""
      }
    </table>
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
