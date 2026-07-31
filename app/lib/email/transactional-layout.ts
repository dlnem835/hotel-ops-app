import { escapeHtml } from "@/app/lib/email/escape-html";
import {
  EMAIL_SUPPORT_ADDRESS,
  EMAIL_THEME as T,
  getEmailLogoUrl,
  getEmailSiteOrigin,
} from "@/app/lib/email/brand";
import type { TransactionalEmailLayoutInput } from "@/app/lib/email/types";

/**
 * Gmail Mobile white bands (Outlook OK) came from nested row structure:
 * separate <tr>/<td> for heading, instructions, and expiry were left as
 * implicit white containers when Gmail stripped/overrode cell CSS.
 *
 * Structure fix (not another CSS tweak):
 * - One master outer table (#111111)
 * - One inner content table (#1a1a1a) with explicit <tbody>
 * - Every table/tbody/tr/td: bgcolor + style="background:;background-color:;"
 * - Heading / body / CTA are direct rows of the inner table (no nested shell)
 * - No reliance on inheritance
 */

const BLACK = "#111111";
/** Seamless content surface (Gmail + Outlook + Apple Mail). */
const SURFACE = "#1a1a1a";
const TEXT = T.text;
const MUTED = T.textMuted;
const SUBTLE = T.textSubtle;
const GOLD = T.gold;
const GOLD_LIGHT = T.goldLight;
const BUTTON_TEXT = T.buttonText;
const DIVIDER = T.divider;

const WRAP =
  "word-break:break-word;overflow-wrap:anywhere;word-wrap:break-word;";

/** bgcolor + dual inline background — required for Gmail Mobile. */
function paint(color: string, extraStyle = ""): string {
  return `bgcolor="${color}" style="background:${color};background-color:${color};${extraStyle}"`;
}

function renderHeaderRow(): string {
  const logoUrl = escapeHtml(getEmailLogoUrl());
  const siteOrigin = escapeHtml(getEmailSiteOrigin());

  return `
    <tr ${paint(SURFACE)}>
      <td align="center" ${paint(SURFACE, `padding:24px 20px 18px;border-bottom:3px solid ${GOLD};`)}>
        <a href="${siteOrigin}" style="text-decoration:none;color:${GOLD};background:${SURFACE};background-color:${SURFACE};">
          <img
            src="${logoUrl}"
            width="120"
            alt="One Eyrie"
            style="display:block;margin:0 auto;border:0;outline:none;text-decoration:none;max-width:100%;width:120px;height:auto;"
          />
        </a>
      </td>
    </tr>`;
}

function renderHeadingRow(heading: string): string {
  return `
    <tr ${paint(SURFACE)}>
      <td align="center" ${paint(
        SURFACE,
        `padding:24px 20px 12px;font-family:Arial,Helvetica,sans-serif;font-size:22px;line-height:1.3;font-weight:800;color:${TEXT};text-align:center;${WRAP}`
      )}>
        ${escapeHtml(heading)}
      </td>
    </tr>`;
}

function renderBodyRow(bodyHtml: string): string {
  return `
    <tr ${paint(SURFACE)}>
      <td ${paint(
        SURFACE,
        `padding:0 20px 8px;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.65;color:${MUTED};${WRAP}`
      )}>
        ${bodyHtml}
      </td>
    </tr>`;
}

function renderCtaRow(label: string, url: string, belowCtaHtml?: string): string {
  const safeLabel = escapeHtml(label);
  const safeUrl = escapeHtml(url);
  const below = belowCtaHtml
    ? `
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" ${paint(SURFACE, "width:100%;margin-top:12px;")}>
        <tbody ${paint(SURFACE)}>
          <tr ${paint(SURFACE)}>
            <td ${paint(
              SURFACE,
              `font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.6;color:${MUTED};${WRAP}`
            )}>
              ${belowCtaHtml}
            </td>
          </tr>
        </tbody>
      </table>`
    : "";

  return `
    <tr ${paint(SURFACE)}>
      <td align="center" ${paint(SURFACE, "padding:16px 20px 8px;")}>
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" ${paint(GOLD)}>
          <tbody ${paint(GOLD)}>
            <tr ${paint(GOLD)}>
              <td align="center" ${paint(GOLD, "padding:14px 24px;")}>
                <a href="${safeUrl}" target="_blank" style="font-family:Arial,Helvetica,sans-serif;font-size:16px;font-weight:700;letter-spacing:0.04em;line-height:1.25;color:${BUTTON_TEXT};text-decoration:none;background:${GOLD};background-color:${GOLD};${WRAP}">
                  ${safeLabel}
                </a>
              </td>
            </tr>
          </tbody>
        </table>
        ${below}
      </td>
    </tr>`;
}

function renderSupportRow(message: string): string {
  const support = escapeHtml(EMAIL_SUPPORT_ADDRESS);

  return `
    <tr ${paint(SURFACE)}>
      <td ${paint(SURFACE, "padding:16px 20px 8px;")}>
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" ${paint(SURFACE, "width:100%;")}>
          <tbody ${paint(SURFACE)}>
            <tr ${paint(SURFACE)}>
              <td ${paint(SURFACE, `border-top:1px solid ${DIVIDER};padding-top:18px;`)}>
                <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" ${paint(SURFACE, "width:100%;")}>
                  <tbody ${paint(SURFACE)}>
                    <tr ${paint(SURFACE)}>
                      <td ${paint(
                        SURFACE,
                        `padding:0 0 8px;font-family:Arial,Helvetica,sans-serif;font-size:13px;font-weight:800;letter-spacing:0.06em;text-transform:uppercase;color:${GOLD};${WRAP}`
                      )}>
                        Need Help?
                      </td>
                    </tr>
                    <tr ${paint(SURFACE)}>
                      <td ${paint(
                        SURFACE,
                        `padding:0 0 10px;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.6;color:${MUTED};${WRAP}`
                      )}>
                        ${escapeHtml(message)}
                      </td>
                    </tr>
                    <tr ${paint(SURFACE)}>
                      <td ${paint(
                        SURFACE,
                        `padding:0;font-family:Arial,Helvetica,sans-serif;font-size:14px;font-weight:700;color:${GOLD_LIGHT};${WRAP}`
                      )}>
                        <a href="mailto:${support}" style="color:${GOLD_LIGHT};text-decoration:none;background:${SURFACE};background-color:${SURFACE};">${support}</a>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </td>
            </tr>
          </tbody>
        </table>
      </td>
    </tr>`;
}

function renderFooterRow(currentYear: number): string {
  return `
    <tr ${paint(SURFACE)}>
      <td align="center" ${paint(SURFACE, "padding:8px 20px 24px;")}>
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" ${paint(SURFACE, "width:100%;")}>
          <tbody ${paint(SURFACE)}>
            <tr ${paint(SURFACE)}>
              <td align="center" ${paint(SURFACE, `border-top:1px solid ${DIVIDER};padding-top:16px;`)}>
                <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" ${paint(SURFACE, "width:100%;")}>
                  <tbody ${paint(SURFACE)}>
                    <tr ${paint(SURFACE)}>
                      <td align="center" ${paint(
                        SURFACE,
                        `padding:0 0 2px;font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:1.5;color:${SUBTLE};${WRAP}`
                      )}>
                        &copy; ${currentYear} One Eyrie
                      </td>
                    </tr>
                    <tr ${paint(SURFACE)}>
                      <td align="center" ${paint(
                        SURFACE,
                        `padding:0;font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:1.5;color:${SUBTLE};${WRAP}`
                      )}>
                        Hotel Operations Platform
                      </td>
                    </tr>
                  </tbody>
                </table>
              </td>
            </tr>
          </tbody>
        </table>
      </td>
    </tr>`;
}

export function renderTransactionalEmailHtml(
  input: TransactionalEmailLayoutInput
): string {
  const year = input.currentYear ?? new Date().getUTCFullYear();
  const showSupport = input.showSupport !== false;
  const supportMessage =
    input.supportMessage?.trim() ||
    "If you have questions about your account or One Eyrie, our team is happy to help.";
  const preheader = input.preheader
    ? `<div style="display:none;max-height:0;overflow:hidden;mso-hide:all;font-size:1px;line-height:1px;color:${BLACK};background:${BLACK};background-color:${BLACK};opacity:0;">${escapeHtml(input.preheader)}</div>`
    : "";

  const ctaRow = input.cta
    ? renderCtaRow(input.cta.label, input.cta.url, input.belowCtaHtml)
    : input.belowCtaHtml
      ? `
    <tr ${paint(SURFACE)}>
      <td ${paint(SURFACE, "padding:12px 20px;")}>
        ${input.belowCtaHtml}
      </td>
    </tr>`
      : "";

  return `<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(input.heading)}</title>
  <!--[if mso]>
  <style type="text/css">
    body, table, td { font-family: Arial, Helvetica, sans-serif !important; }
  </style>
  <![endif]-->
</head>
<body ${paint(BLACK, "margin:0;padding:0;width:100%;")}>
  ${preheader}
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" ${paint(BLACK, "width:100%;")}>
    <tbody ${paint(BLACK)}>
      <tr ${paint(BLACK)}>
        <td align="center" ${paint(BLACK, "padding:16px 12px;")}>
          <!--[if mso]>
          <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600" bgcolor="${SURFACE}"><tr bgcolor="${SURFACE}" style="background:${SURFACE};background-color:${SURFACE};"><td bgcolor="${SURFACE}" style="background:${SURFACE};background-color:${SURFACE};">
          <![endif]-->
          <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" ${paint(SURFACE, `width:100%;max-width:600px;border:1px solid ${GOLD};`)}>
            <tbody ${paint(SURFACE)}>
              ${renderHeaderRow()}
              ${renderHeadingRow(input.heading)}
              ${renderBodyRow(input.bodyHtml)}
              ${ctaRow}
              ${showSupport ? renderSupportRow(supportMessage) : ""}
              ${renderFooterRow(year)}
            </tbody>
          </table>
          <!--[if mso]>
          </td></tr></table>
          <![endif]-->
        </td>
      </tr>
    </tbody>
  </table>
</body>
</html>`;
}

export const TRANSACTIONAL_EMAIL_SURFACE = {
  black: BLACK,
  surface: SURFACE,
  text: TEXT,
  muted: MUTED,
} as const;
