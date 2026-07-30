import { escapeHtml } from "@/app/lib/email/escape-html";
import {
  EMAIL_SUPPORT_ADDRESS,
  EMAIL_THEME as T,
  getEmailLogoUrl,
  getEmailSiteOrigin,
} from "@/app/lib/email/brand";
import type { TransactionalEmailLayoutInput } from "@/app/lib/email/types";

/**
 * Gmail mobile (esp. dark theme) often ignores or inverts plain background-color.
 * Pair bgcolor + background-color + identical linear-gradient so the dark shell
 * survives mobile Gmail without changing desktop appearance.
 */
function gmailSafeBg(color: string): string {
  return `background-color:${color};background-image:linear-gradient(${color},${color});`;
}

function renderHeader(): string {
  const logoUrl = escapeHtml(getEmailLogoUrl());
  const siteOrigin = escapeHtml(getEmailSiteOrigin());

  return `
    <tr>
      <td
        align="center"
        bgcolor="${T.charcoal}"
        style="padding:36px 32px 28px;${gmailSafeBg(T.charcoal)}border-bottom:3px solid ${T.gold};"
      >
        <a href="${siteOrigin}" style="text-decoration:none;color:${T.gold};">
          <img
            src="${logoUrl}"
            width="120"
            alt="One Eyrie"
            style="display:block;margin:0 auto;border:0;outline:none;text-decoration:none;max-width:120px;height:auto;"
          />
        </a>
      </td>
    </tr>`;
}

function renderCta(label: string, url: string): string {
  const safeLabel = escapeHtml(label);
  const safeUrl = escapeHtml(url);

  return `
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" width="100%" bgcolor="${T.card}" style="margin:8px auto 0;${gmailSafeBg(T.card)}">
      <tr>
        <td
          align="center"
          bgcolor="${T.card}"
          style="padding:0;${gmailSafeBg(T.card)}"
        >
          <table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" bgcolor="${T.gold}" style="${gmailSafeBg(T.gold)}border-radius:999px;">
            <tr>
              <td
                align="center"
                bgcolor="${T.gold}"
                style="border-radius:999px;${gmailSafeBg(T.gold)}"
              >
                <a
                  href="${safeUrl}"
                  target="_blank"
                  style="display:inline-block;padding:14px 32px;font-family:Arial,Helvetica,sans-serif;font-size:15px;font-weight:800;line-height:1.2;color:${T.buttonText} !important;text-decoration:none;border-radius:999px;${gmailSafeBg(T.gold)}"
                >
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
    <tr>
      <td
        bgcolor="${T.card}"
        style="padding:0 32px 28px;${gmailSafeBg(T.card)}"
      >
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" bgcolor="${T.card}" style="${gmailSafeBg(T.card)}">
          <tr>
            <td
              bgcolor="${T.card}"
              style="border-top:1px solid ${T.divider};padding-top:24px;${gmailSafeBg(T.card)}"
            >
              <p style="margin:0 0 8px;font-family:Arial,Helvetica,sans-serif;font-size:13px;font-weight:800;letter-spacing:0.06em;text-transform:uppercase;color:${T.gold} !important;${gmailSafeBg(T.card)}">
                Need Help?
              </p>
              <p style="margin:0 0 12px;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.65;color:${T.textMuted} !important;${gmailSafeBg(T.card)}">
                ${escapeHtml(message)}
              </p>
              <p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:14px;font-weight:700;color:${T.goldLight} !important;${gmailSafeBg(T.card)}">
                <a href="mailto:${support}" style="color:${T.goldLight} !important;text-decoration:none;${gmailSafeBg(T.card)}">${support}</a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>`;
}

function renderFooter(currentYear: number): string {
  return `
    <tr>
      <td
        align="center"
        bgcolor="${T.card}"
        style="padding:8px 32px 36px;${gmailSafeBg(T.card)}"
      >
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" bgcolor="${T.card}" style="${gmailSafeBg(T.card)}">
          <tr>
            <td
              align="center"
              bgcolor="${T.card}"
              style="border-top:1px solid ${T.divider};padding-top:22px;${gmailSafeBg(T.card)}"
            >
              <p style="margin:0 0 4px;font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:1.5;color:${T.textSubtle} !important;${gmailSafeBg(T.card)}">
                &copy; ${currentYear} One Eyrie
              </p>
              <p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:1.5;color:${T.textSubtle} !important;${gmailSafeBg(T.card)}">
                Hotel Operations Platform
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>`;
}

/**
 * Shared One Eyrie transactional email shell.
 * Dark charcoal card, gold accents — desktop appearance preserved.
 * Mobile Gmail: explicit bgcolor + linear-gradient backgrounds + inline text colors
 * so light text never sits on a forced white section.
 */
export function renderTransactionalEmailHtml(
  input: TransactionalEmailLayoutInput
): string {
  const year = input.currentYear ?? new Date().getUTCFullYear();
  const showSupport = input.showSupport !== false;
  const supportMessage =
    input.supportMessage?.trim() ||
    "If you have questions about your account or One Eyrie, our team is happy to help.";
  const preheader = input.preheader
    ? `<div style="display:none;max-height:0;overflow:hidden;mso-hide:all;font-size:1px;line-height:1px;color:${T.black};opacity:0;">
        ${escapeHtml(input.preheader)}
      </div>`
    : "";

  const ctaHtml = input.cta ? renderCta(input.cta.label, input.cta.url) : "";
  const belowCta = input.belowCtaHtml
    ? `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" bgcolor="${T.card}" style="margin-top:20px;${gmailSafeBg(T.card)}"><tr><td bgcolor="${T.card}" style="${gmailSafeBg(T.card)}color:${T.textMuted};">${input.belowCtaHtml}</td></tr></table>`
    : "";

  return `<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta name="color-scheme" content="dark" />
  <meta name="supported-color-schemes" content="dark" />
  <title>${escapeHtml(input.heading)}</title>
  <style type="text/css">
    :root { color-scheme: dark; supported-color-schemes: dark; }
    body, table, td, a, p, h1, h2, h3 { -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
    table, td { mso-table-lspace: 0pt; mso-table-rspace: 0pt; border-collapse: collapse !important; }
    img { -ms-interpolation-mode: bicubic; border: 0; height: auto; line-height: 100%; outline: none; text-decoration: none; }
    body {
      margin: 0 !important;
      padding: 0 !important;
      width: 100% !important;
      background-color: ${T.black} !important;
      background-image: linear-gradient(${T.black}, ${T.black}) !important;
    }
    /* Reinforce dark shell for clients that partially invert (Gmail mobile). */
    .oe-email-outer,
    .oe-email-outer td {
      background-color: ${T.black} !important;
      background-image: linear-gradient(${T.black}, ${T.black}) !important;
    }
    .oe-email-card,
    .oe-email-card td {
      background-color: ${T.card} !important;
      background-image: linear-gradient(${T.card}, ${T.card}) !important;
    }
    .oe-email-header td {
      background-color: ${T.charcoal} !important;
      background-image: linear-gradient(${T.charcoal}, ${T.charcoal}) !important;
    }
    .oe-email-heading { color: ${T.text} !important; }
    .oe-email-body-copy,
    .oe-email-body-copy p,
    .oe-email-body-copy td { color: ${T.textMuted} !important; }
    .oe-email-body-copy strong { color: ${T.text} !important; }
    /* Mobile: spacing only — same colors as desktop (no transparent wrappers). */
    @media only screen and (max-width: 620px) {
      .oe-email-pad { padding-left: 16px !important; padding-right: 16px !important; }
      .oe-email-shell-pad { padding: 16px 10px !important; }
      .oe-email-heading { font-size: 22px !important; line-height: 1.3 !important; color: ${T.text} !important; }
      .oe-email-outer,
      .oe-email-outer td {
        background-color: ${T.black} !important;
        background-image: linear-gradient(${T.black}, ${T.black}) !important;
      }
      .oe-email-card,
      .oe-email-card td {
        background-color: ${T.card} !important;
        background-image: linear-gradient(${T.card}, ${T.card}) !important;
      }
    }
  </style>
  <!--[if mso]>
  <style type="text/css">
    body, table, td { font-family: Arial, Helvetica, sans-serif !important; }
  </style>
  <![endif]-->
</head>
<body
  class="oe-email-body"
  bgcolor="${T.black}"
  style="margin:0;padding:0;width:100%;${gmailSafeBg(T.black)}"
>
  ${preheader}
  <table
    role="presentation"
    class="oe-email-outer"
    cellpadding="0"
    cellspacing="0"
    border="0"
    width="100%"
    bgcolor="${T.black}"
    style="width:100%;${gmailSafeBg(T.black)}"
  >
    <tr>
      <td
        align="center"
        bgcolor="${T.black}"
        class="oe-email-shell-pad"
        style="padding:28px 16px;${gmailSafeBg(T.black)}"
      >
        <!--[if mso]>
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="560" bgcolor="${T.card}"><tr><td bgcolor="${T.card}">
        <![endif]-->
        <table
          role="presentation"
          class="oe-email-card"
          cellpadding="0"
          cellspacing="0"
          border="0"
          width="100%"
          bgcolor="${T.card}"
          style="max-width:560px;width:100%;${gmailSafeBg(T.card)}border:1px solid ${T.gold};border-radius:18px;"
        >
          <tbody class="oe-email-header">
            ${renderHeader()}
          </tbody>
          <tr>
            <td
              bgcolor="${T.card}"
              class="oe-email-pad"
              style="padding:36px 32px 8px;${gmailSafeBg(T.card)}"
            >
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" bgcolor="${T.card}" style="${gmailSafeBg(T.card)}">
                <tr>
                  <td
                    align="center"
                    bgcolor="${T.card}"
                    style="padding:0 0 22px;${gmailSafeBg(T.card)}"
                  >
                    <h1
                      class="oe-email-heading"
                      style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:26px;line-height:1.25;font-weight:800;color:${T.text} !important;text-align:center;${gmailSafeBg(T.card)}"
                    >
                      ${escapeHtml(input.heading)}
                    </h1>
                  </td>
                </tr>
                <tr>
                  <td
                    bgcolor="${T.card}"
                    class="oe-email-body-copy"
                    style="font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.7;color:${T.textMuted} !important;${gmailSafeBg(T.card)}"
                  >
                    ${input.bodyHtml}
                  </td>
                </tr>
                ${
                  ctaHtml || belowCta
                    ? `<tr><td bgcolor="${T.card}" align="center" style="padding:28px 0 8px;${gmailSafeBg(T.card)}">${ctaHtml}${belowCta}</td></tr>`
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
