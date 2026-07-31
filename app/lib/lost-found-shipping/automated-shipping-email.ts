import "server-only";

import { escapeHtml } from "@/app/lib/email/escape-html";
import { EMAIL_THEME as T, getEmailSiteOrigin } from "@/app/lib/email/brand";
import { renderTransactionalEmailHtml } from "@/app/lib/email/transactional-layout";
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

/** No inline !important — Gmail mobile strips those background declarations. */
function surface(color: string, imageUrl: string): string {
  return `background-color:${color};background-image:url('${imageUrl}');background-repeat:repeat;`;
}

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
  const origin = getEmailSiteOrigin();
  const cardImg = `${origin}/email/oe-bg-card.png`;
  const panelImg = `${origin}/email/oe-bg-panel.png`;

  const subject = `${propertyName} found your item — arrange return shipping`;

  const para = `padding:0 0 14px;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.6;color:${T.textMuted};${surface(T.card, cardImg)}`;
  const contactLine = `padding-top:6px;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.55;color:${T.textMuted};${surface(T.charcoal, panelImg)}`;

  const contactLinesHtml = [
    phone
      ? `<tr><td bgcolor="${T.charcoal}" background="${panelImg}" class="oe-inset oe-text oe-autolink" style="${contactLine}">Phone: ${escapeHtml(phone)}</td></tr>`
      : "",
    address
      ? `<tr><td bgcolor="${T.charcoal}" background="${panelImg}" class="oe-inset oe-text oe-autolink" style="padding-top:8px;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.55;color:${T.textMuted};${surface(T.charcoal, panelImg)}"><span class="oe-autolink" style="color:${T.textMuted};text-decoration:none;">${escapeHtml(address)}</span></td></tr>`
      : "",
  ].join("");

  const bodyHtml = `
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" bgcolor="${T.card}" background="${cardImg}" class="oe-card" style="width:100%;${surface(T.card, cardImg)}">
      <tr>
        <td bgcolor="${T.card}" background="${cardImg}" class="oe-text oe-body-copy" style="${para}">
          ${hello.html}
        </td>
      </tr>
      <tr>
        <td bgcolor="${T.card}" background="${cardImg}" class="oe-text oe-body-copy" style="${para}">
          Good news — <strong style="color:${T.text};">${escapeHtml(propertyName)}</strong>
          has located <strong style="color:${T.text};">${escapeHtml(itemName)}</strong>
          and can ship it back to you.
        </td>
      </tr>
      <tr>
        <td bgcolor="${T.card}" background="${cardImg}" class="oe-text oe-body-copy" style="${para}">
          Use the secure link below to confirm your address, choose a shipping option,
          and pay for return shipping. You&rsquo;ll pick the carrier and service on the next page.
        </td>
      </tr>
      <tr>
        <td bgcolor="${T.card}" background="${cardImg}" class="oe-card" style="padding:0 0 4px;${surface(T.card, cardImg)}">
          <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" bgcolor="${T.charcoal}" background="${panelImg}" class="oe-inset" style="width:100%;${surface(T.charcoal, panelImg)}border:1px solid ${T.border};border-radius:12px;">
            <tr>
              <td bgcolor="${T.charcoal}" background="${panelImg}" class="oe-inset" style="padding:14px;${surface(T.charcoal, panelImg)}">
                <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" bgcolor="${T.charcoal}" background="${panelImg}" style="${surface(T.charcoal, panelImg)}">
                  <tr>
                    <td bgcolor="${T.charcoal}" background="${panelImg}" class="oe-label" style="${surface(T.charcoal, panelImg)}color:${T.gold};font-family:Arial,Helvetica,sans-serif;font-size:12px;font-weight:800;letter-spacing:0.08em;text-transform:uppercase;">
                      Hotel contact
                    </td>
                  </tr>
                  <tr>
                    <td bgcolor="${T.charcoal}" background="${panelImg}" class="oe-heading" style="padding-top:6px;${surface(T.charcoal, panelImg)}color:${T.text};font-family:Arial,Helvetica,sans-serif;font-size:15px;font-weight:700;">
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
          ? `<tr><td bgcolor="${T.card}" background="${cardImg}" class="oe-subtle" style="padding:14px 0 0;font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:1.5;color:${T.textSubtle};${surface(T.card, cardImg)}">This link remains available until ${escapeHtml(expiryLabel)}.</td></tr>`
          : ""
      }
    </table>
  `;

  const html = renderTransactionalEmailHtml({
    kind: "guest-shipping",
    heading: AUTOMATED_SHIPPING_EMAIL_HEADING,
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
