import { escapeHtml } from "@/app/lib/email/escape-html";
import {
  EMAIL_SUPPORT_ADDRESS,
  EMAIL_THEME as T,
  getEmailLogoUrl,
  getEmailSiteOrigin,
} from "@/app/lib/email/brand";
import type { TransactionalEmailLayoutInput } from "@/app/lib/email/types";

/**
 * Email-safe solid background. Same colors on every client —
 * no separate mobile palette or layout fork.
 */
function solidBg(color: string): string {
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
        class="oe-email-header-pad"
        style="padding:20px 24px 16px;${solidBg(T.charcoal)}border-bottom:2px solid ${T.gold};"
      >
        <a href="${siteOrigin}" style="text-decoration:none;color:${T.gold};">
          <img
            src="${logoUrl}"
            width="96"
            alt="One Eyrie"
            style="display:block;margin:0 auto;border:0;outline:none;text-decoration:none;max-width:96px;height:auto;"
          />
        </a>
      </td>
    </tr>`;
}

/** Bulletproof CTA ~48–52px tall — same on desktop and mobile. */
function renderCta(label: string, url: string): string {
  const safeLabel = escapeHtml(label);
  const safeUrl = escapeHtml(url);

  return `
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" style="margin:4px auto 0;">
      <tr>
        <td align="center" bgcolor="${T.gold}" style="border-radius:8px;${solidBg(T.gold)}">
          <!--[if mso]>
          <v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" href="${safeUrl}" style="height:50px;v-text-anchor:middle;width:280px;" arcsize="10%" stroke="f" fillcolor="${T.gold}">
            <w:anchorlock/>
            <center style="color:${T.buttonText};font-family:Arial,Helvetica,sans-serif;font-size:15px;font-weight:bold;">
              ${safeLabel}
            </center>
          </v:roundrect>
          <![endif]-->
          <!--[if !mso]><!-->
          <a
            href="${safeUrl}"
            target="_blank"
            style="display:inline-block;min-height:50px;line-height:50px;padding:0 28px;font-family:Arial,Helvetica,sans-serif;font-size:15px;font-weight:800;color:${T.buttonText} !important;text-decoration:none;border-radius:8px;${solidBg(T.gold)}"
          >
            ${safeLabel}
          </a>
          <!--<![endif]-->
        </td>
      </tr>
    </table>`;
}

function renderSupportBlock(message: string): string {
  const support = escapeHtml(EMAIL_SUPPORT_ADDRESS);

  return `
    <tr>
      <td bgcolor="${T.card}" class="oe-email-pad" style="padding:0 24px 20px;${solidBg(T.card)}">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="${solidBg(T.card)}">
          <tr>
            <td style="border-top:1px solid ${T.divider};padding-top:16px;${solidBg(T.card)}">
              <p style="margin:0 0 6px;font-family:Arial,Helvetica,sans-serif;font-size:12px;font-weight:800;letter-spacing:0.06em;text-transform:uppercase;color:${T.gold} !important;">
                Need Help?
              </p>
              <p style="margin:0 0 8px;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.55;color:${T.textMuted} !important;">
                ${escapeHtml(message)}
              </p>
              <p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:14px;font-weight:700;color:${T.goldLight} !important;">
                <a href="mailto:${support}" style="color:${T.goldLight} !important;text-decoration:none;">${support}</a>
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
      <td align="center" bgcolor="${T.card}" class="oe-email-pad" style="padding:0 24px 24px;${solidBg(T.card)}">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="${solidBg(T.card)}">
          <tr>
            <td align="center" style="border-top:1px solid ${T.divider};padding-top:16px;${solidBg(T.card)}">
              <p style="margin:0 0 2px;font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:1.45;color:${T.textSubtle} !important;">
                &copy; ${currentYear} One Eyrie
              </p>
              <p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:1.45;color:${T.textSubtle} !important;">
                Hotel Operations Platform
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>`;
}

/**
 * Single responsive transactional email for all devices.
 * Dark charcoal card, gold accents — identical colors on desktop and mobile.
 * Clients scale naturally; only horizontal padding tightens on small screens.
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
    ? `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin-top:12px;${solidBg(T.card)}"><tr><td style="${solidBg(T.card)}color:${T.textMuted} !important;">${input.belowCtaHtml}</td></tr></table>`
    : "";

  return `<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta name="color-scheme" content="dark" />
  <meta name="supported-color-schemes" content="dark" />
  <title>${escapeHtml(input.heading)}</title>
  <!--[if mso]>
  <noscript>
    <xml>
      <o:OfficeDocumentSettings>
        <o:PixelsPerInch>96</o:PixelsPerInch>
      </o:OfficeDocumentSettings>
    </xml>
  </noscript>
  <![endif]-->
  <style type="text/css">
    body, table, td, a, p, h1 { -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
    table, td { mso-table-lspace: 0pt; mso-table-rspace: 0pt; border-collapse: collapse !important; }
    img { -ms-interpolation-mode: bicubic; border: 0; height: auto; line-height: 100%; outline: none; text-decoration: none; }
    body {
      margin: 0 !important;
      padding: 0 !important;
      width: 100% !important;
      background-color: ${T.black} !important;
    }
    /* Spacing only — same colors and typography as desktop. */
    @media only screen and (max-width: 620px) {
      .oe-email-shell { padding: 16px 12px !important; }
      .oe-email-pad { padding-left: 16px !important; padding-right: 16px !important; }
      .oe-email-header-pad { padding-left: 16px !important; padding-right: 16px !important; }
    }
  </style>
  <!--[if mso]>
  <style type="text/css">
    body, table, td { font-family: Arial, Helvetica, sans-serif !important; }
  </style>
  <![endif]-->
</head>
<body bgcolor="${T.black}" style="margin:0;padding:0;width:100%;${solidBg(T.black)}">
  ${preheader}
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" bgcolor="${T.black}" style="width:100%;${solidBg(T.black)}">
    <tr>
      <td align="center" bgcolor="${T.black}" class="oe-email-shell" style="padding:24px 16px;${solidBg(T.black)}">
        <!--[if mso]>
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600" bgcolor="${T.card}"><tr><td bgcolor="${T.card}">
        <![endif]-->
        <table
          role="presentation"
          cellpadding="0"
          cellspacing="0"
          border="0"
          width="100%"
          bgcolor="${T.card}"
          style="max-width:600px;width:100%;${solidBg(T.card)}border:1px solid ${T.gold};border-radius:14px;"
        >
          ${renderHeader()}
          <tr>
            <td bgcolor="${T.card}" class="oe-email-pad" style="padding:24px 24px 8px;${solidBg(T.card)}">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="${solidBg(T.card)}">
                <tr>
                  <td align="center" style="padding:0 0 16px;${solidBg(T.card)}">
                    <h1 style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:22px;line-height:1.3;font-weight:800;color:${T.text} !important;text-align:center;">
                      ${escapeHtml(input.heading)}
                    </h1>
                  </td>
                </tr>
                <tr>
                  <td style="font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.6;color:${T.textMuted} !important;${solidBg(T.card)}">
                    ${input.bodyHtml}
                  </td>
                </tr>
                ${
                  ctaHtml || belowCta
                    ? `<tr><td align="center" style="padding:20px 0 4px;${solidBg(T.card)}">${ctaHtml}${belowCta}</td></tr>`
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
