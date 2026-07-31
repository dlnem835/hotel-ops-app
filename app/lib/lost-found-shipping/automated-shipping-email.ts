import "server-only";

import { escapeHtml } from "@/app/lib/email/escape-html";
import { EMAIL_THEME as T } from "@/app/lib/email/brand";
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

/** Same seamless surface as the transactional shell. */
const SURFACE = "#1a1a1a";

const WRAP =
  "word-break:break-word;overflow-wrap:anywhere;word-wrap:break-word;";

function paint(color: string, extraStyle = ""): string {
  return `bgcolor="${color}" style="background:${color};background-color:${color};${extraStyle}"`;
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
 * Guest shipping body as ONE continuous painted block.
 * No separate <tr> per paragraph — those rows were the white bands in Gmail Mobile.
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
  const strong = `color:${T.text};background:${SURFACE};background-color:${SURFACE};`;

  const contactInner = [
    `<tr ${paint(SURFACE)}><td ${paint(SURFACE, `font-family:Arial,Helvetica,sans-serif;font-size:12px;font-weight:800;letter-spacing:0.08em;text-transform:uppercase;color:${T.gold};${WRAP}`)}>Hotel contact</td></tr>`,
    `<tr ${paint(SURFACE)}><td ${paint(SURFACE, `padding-top:6px;font-family:Arial,Helvetica,sans-serif;font-size:15px;font-weight:700;color:${T.text};${WRAP}`)}>${escapeHtml(propertyName)}</td></tr>`,
    phone
      ? `<tr ${paint(SURFACE)}><td ${paint(SURFACE, `padding-top:6px;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.55;color:${T.textMuted};${WRAP}`)}>Phone: ${escapeHtml(phone)}</td></tr>`
      : "",
    address
      ? `<tr ${paint(SURFACE)}><td ${paint(SURFACE, `padding-top:8px;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.55;color:${T.textMuted};${WRAP}`)}>${escapeHtml(address)}</td></tr>`
      : "",
  ].join("");

  // Single painted container — greeting + instructions + hotel + expiry.
  // Gmail Mobile was inserting white between sibling <tr> paragraph rows.
  const bodyHtml = `
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" ${paint(SURFACE, "width:100%;")}>
      <tbody ${paint(SURFACE)}>
        <tr ${paint(SURFACE)}>
          <td ${paint(
            SURFACE,
            `font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.65;color:${T.textMuted};${WRAP}`
          )}>
            ${hello.html}<br /><br />
            Good news — <strong style="${strong}">${escapeHtml(propertyName)}</strong>
            has located <strong style="${strong}">${escapeHtml(itemName)}</strong>
            and can ship it back to you.<br /><br />
            Use the secure link below to confirm your address, choose a shipping option,
            and pay for return shipping. You&rsquo;ll pick the carrier and service on the next page.<br /><br />
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" ${paint(SURFACE, `width:100%;border:1px solid ${T.border};`)}>
              <tbody ${paint(SURFACE)}>
                <tr ${paint(SURFACE)}>
                  <td ${paint(SURFACE, "padding:14px;")}>
                    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" ${paint(SURFACE, "width:100%;")}>
                      <tbody ${paint(SURFACE)}>
                        ${contactInner}
                      </tbody>
                    </table>
                  </td>
                </tr>
              </tbody>
            </table>
            ${
              expiryLabel
                ? `<br />This link remains available until ${escapeHtml(expiryLabel)}.`
                : ""
            }
          </td>
        </tr>
      </tbody>
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
