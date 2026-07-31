import { escapeHtml } from "@/app/lib/email/escape-html";
import {
  EMAIL_SUPPORT_ADDRESS,
  EMAIL_THEME as T,
  getEmailLogoUrl,
  getEmailSiteOrigin,
} from "@/app/lib/email/brand";
import type { TransactionalEmailLayoutInput } from "@/app/lib/email/types";

/**
 * Conservative One Eyrie transactional email shell.
 *
 * Root cause of Gmail mobile white gaps / shrink:
 * - Fixed width="600" + width:600px forced Gmail to scale the whole message
 *   and often letterbox with a white canvas.
 * - Content lived in <div> wrappers with text color but NO background, so when
 *   Gmail discarded inherited card backgrounds those sections painted white
 *   (white text on white when inversion also ran).
 *
 * Fix: full-width #111111 outer tables; fluid inner (width=100%, max-width:600px);
 * tables only (no content divs); every cell has bgcolor + background-color +
 * explicit text colors. No color-scheme, media queries, or class-based paint.
 */

const BLACK = "#111111";
const CARD = T.card; // #211F1B — dark surface, never white
const PANEL = T.charcoal;
const TEXT = T.text;
const MUTED = T.textMuted;
const SUBTLE = T.textSubtle;
const GOLD = T.gold;
const GOLD_LIGHT = T.goldLight;
const BUTTON_TEXT = T.buttonText;
const BORDER = T.border;
const DIVIDER = T.divider;

const WRAP =
  "word-break:break-word;overflow-wrap:anywhere;word-wrap:break-word;";

function bg(color: string): string {
  return `background-color:${color};`;
}

function renderHeader(): string {
  const logoUrl = escapeHtml(getEmailLogoUrl());
  const siteOrigin = escapeHtml(getEmailSiteOrigin());

  return `
    <tr bgcolor="${PANEL}" style="${bg(PANEL)}">
      <td align="center" bgcolor="${PANEL}" style="padding:24px 20px 18px;${bg(PANEL)}border-bottom:3px solid ${GOLD};">
        <a href="${siteOrigin}" style="text-decoration:none;color:${GOLD};">
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

function renderCta(label: string, url: string): string {
  const safeLabel = escapeHtml(label);
  const safeUrl = escapeHtml(url);

  return `
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" bgcolor="${CARD}" style="width:100%;${bg(CARD)}">
      <tr bgcolor="${CARD}" style="${bg(CARD)}">
        <td align="center" bgcolor="${CARD}" style="padding:8px 0;${bg(CARD)}">
          <table role="presentation" cellpadding="0" cellspacing="0" border="0" bgcolor="${GOLD}" style="${bg(GOLD)}">
            <tr bgcolor="${GOLD}" style="${bg(GOLD)}">
              <td align="center" bgcolor="${GOLD}" style="padding:14px 24px;${bg(GOLD)}">
                <a href="${safeUrl}" target="_blank" style="font-family:Arial,Helvetica,sans-serif;font-size:16px;font-weight:700;letter-spacing:0.04em;line-height:1.25;color:${BUTTON_TEXT};text-decoration:none;${bg(GOLD)}${WRAP}">
                  ${safeLabel}
                </a>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>`;
}

function renderSupportBlock(message: string): string {
  const support = escapeHtml(EMAIL_SUPPORT_ADDRESS);

  return `
    <tr bgcolor="${CARD}" style="${bg(CARD)}">
      <td bgcolor="${CARD}" style="padding:0 20px 20px;${bg(CARD)}">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" bgcolor="${CARD}" style="width:100%;${bg(CARD)}">
          <tr bgcolor="${CARD}" style="${bg(CARD)}">
            <td bgcolor="${CARD}" style="border-top:1px solid ${DIVIDER};padding-top:18px;${bg(CARD)}">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" bgcolor="${CARD}" style="width:100%;${bg(CARD)}">
                <tr bgcolor="${CARD}" style="${bg(CARD)}">
                  <td bgcolor="${CARD}" style="padding:0 0 8px;font-family:Arial,Helvetica,sans-serif;font-size:13px;font-weight:800;letter-spacing:0.06em;text-transform:uppercase;color:${GOLD};${bg(CARD)}${WRAP}">
                    Need Help?
                  </td>
                </tr>
                <tr bgcolor="${CARD}" style="${bg(CARD)}">
                  <td bgcolor="${CARD}" style="padding:0 0 10px;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.6;color:${MUTED};${bg(CARD)}${WRAP}">
                    ${escapeHtml(message)}
                  </td>
                </tr>
                <tr bgcolor="${CARD}" style="${bg(CARD)}">
                  <td bgcolor="${CARD}" style="padding:0;font-family:Arial,Helvetica,sans-serif;font-size:14px;font-weight:700;color:${GOLD_LIGHT};${bg(CARD)}${WRAP}">
                    <a href="mailto:${support}" style="color:${GOLD_LIGHT};text-decoration:none;">${support}</a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </td>
    </tr>`;
}

function renderFooter(currentYear: number): string {
  return `
    <tr bgcolor="${CARD}" style="${bg(CARD)}">
      <td align="center" bgcolor="${CARD}" style="padding:0 20px 24px;${bg(CARD)}">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" bgcolor="${CARD}" style="width:100%;${bg(CARD)}">
          <tr bgcolor="${CARD}" style="${bg(CARD)}">
            <td align="center" bgcolor="${CARD}" style="border-top:1px solid ${DIVIDER};padding-top:16px;${bg(CARD)}">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" bgcolor="${CARD}" style="width:100%;${bg(CARD)}">
                <tr bgcolor="${CARD}" style="${bg(CARD)}">
                  <td align="center" bgcolor="${CARD}" style="padding:0 0 2px;font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:1.5;color:${SUBTLE};${bg(CARD)}${WRAP}">
                    &copy; ${currentYear} One Eyrie
                  </td>
                </tr>
                <tr bgcolor="${CARD}" style="${bg(CARD)}">
                  <td align="center" bgcolor="${CARD}" style="padding:0;font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:1.5;color:${SUBTLE};${bg(CARD)}${WRAP}">
                    Hotel Operations Platform
                  </td>
                </tr>
              </table>
            </td>
          </tr>
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
    ? `<div style="display:none;max-height:0;overflow:hidden;mso-hide:all;font-size:1px;line-height:1px;color:${BLACK};${bg(BLACK)}opacity:0;">${escapeHtml(input.preheader)}</div>`
    : "";

  const ctaHtml = input.cta ? renderCta(input.cta.label, input.cta.url) : "";
  const belowCta = input.belowCtaHtml
    ? `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" bgcolor="${CARD}" style="width:100%;margin-top:12px;${bg(CARD)}"><tr bgcolor="${CARD}" style="${bg(CARD)}"><td bgcolor="${CARD}" style="font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.6;color:${MUTED};${bg(CARD)}${WRAP}">${input.belowCtaHtml}</td></tr></table>`
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
<body bgcolor="${BLACK}" style="margin:0;padding:0;width:100%;${bg(BLACK)}">
  ${preheader}
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" bgcolor="${BLACK}" style="width:100%;${bg(BLACK)}">
    <tr bgcolor="${BLACK}" style="${bg(BLACK)}">
      <td align="center" bgcolor="${BLACK}" style="padding:16px 12px;${bg(BLACK)}">
        <!--[if mso]>
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600" bgcolor="${CARD}"><tr bgcolor="${CARD}" style="background-color:${CARD};"><td bgcolor="${CARD}" style="background-color:${CARD};">
        <![endif]-->
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" bgcolor="${CARD}" style="width:100%;max-width:600px;${bg(CARD)}border:1px solid ${GOLD};">
          ${renderHeader()}
          <tr bgcolor="${CARD}" style="${bg(CARD)}">
            <td bgcolor="${CARD}" style="padding:24px 20px 12px;${bg(CARD)}">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" bgcolor="${CARD}" style="width:100%;${bg(CARD)}">
                <tr bgcolor="${CARD}" style="${bg(CARD)}">
                  <td align="center" bgcolor="${CARD}" style="padding:0 0 16px;font-family:Arial,Helvetica,sans-serif;font-size:22px;line-height:1.3;font-weight:800;color:${TEXT};text-align:center;${bg(CARD)}${WRAP}">
                    ${escapeHtml(input.heading)}
                  </td>
                </tr>
                <tr bgcolor="${CARD}" style="${bg(CARD)}">
                  <td bgcolor="${CARD}" style="font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.65;color:${MUTED};${bg(CARD)}${WRAP}">
                    ${input.bodyHtml}
                  </td>
                </tr>
                ${
                  ctaHtml || belowCta
                    ? `<tr bgcolor="${CARD}" style="${bg(CARD)}"><td bgcolor="${CARD}" style="padding:20px 0 4px;${bg(CARD)}">${ctaHtml}${belowCta}</td></tr>`
                    : ""
                }
              </table>
            </td>
          </tr>
          ${showSupport ? renderSupportBlock(supportMessage) : ""}
          ${renderFooter(year)}
        </table>
        <!--[if mso]>
        </td></tr></table>
        <![endif]-->
      </td>
    </tr>
  </table>
</body>
</html>`;
}

/** Exported for diagnostics / tests — One Eyrie dark tokens used by the shell. */
export const TRANSACTIONAL_EMAIL_SURFACE = {
  black: BLACK,
  card: CARD,
  panel: PANEL,
  text: TEXT,
  muted: MUTED,
} as const;
