import { escapeHtml } from "@/app/lib/email/escape-html";
import {
  EMAIL_SUPPORT_ADDRESS,
  EMAIL_THEME as T,
  getEmailLogoUrl,
  getEmailSiteOrigin,
} from "@/app/lib/email/brand";
import type { TransactionalEmailLayoutInput } from "@/app/lib/email/types";

/**
 * Bulletproof dark fill for Gmail / Apple Mail / Outlook.
 * bgcolor + background-color + identical linear-gradient resists white inversion.
 */
function darkFill(color: string): string {
  return `background-color:${color} !important;background-image:linear-gradient(${color},${color}) !important;`;
}

function renderHeader(): string {
  const logoUrl = escapeHtml(getEmailLogoUrl());
  const siteOrigin = escapeHtml(getEmailSiteOrigin());

  return `
    <tr>
      <td
        align="center"
        bgcolor="${T.charcoal}"
        class="oe-header"
        style="padding:20px 24px 16px;${darkFill(T.charcoal)}border-bottom:2px solid ${T.gold};"
      >
        <a href="${siteOrigin}" style="text-decoration:none;color:${T.gold} !important;">
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

/** CTA ~50px — gold on dark, same on every client. */
function renderCta(label: string, url: string): string {
  const safeLabel = escapeHtml(label);
  const safeUrl = escapeHtml(url);
  const buttonFont =
    "font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;font-size:16px;font-weight:700;letter-spacing:0.04em;";

  return `
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" bgcolor="${T.card}" style="margin:4px auto 0;${darkFill(T.card)}">
      <tr>
        <td align="center" bgcolor="${T.gold}" class="oe-cta" style="border-radius:8px;${darkFill(T.gold)}">
          <!--[if mso]>
          <v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" href="${safeUrl}" style="height:50px;v-text-anchor:middle;width:280px;" arcsize="10%" stroke="f" fillcolor="${T.gold}">
            <w:anchorlock/>
            <center style="color:${T.buttonText};font-family:Arial,Helvetica,sans-serif;font-size:16px;font-weight:bold;letter-spacing:0.5px;">
              ${safeLabel}
            </center>
          </v:roundrect>
          <![endif]-->
          <!--[if !mso]><!-->
          <a
            href="${safeUrl}"
            target="_blank"
            style="display:inline-block;min-height:50px;line-height:50px;padding:0 28px;${buttonFont}color:${T.buttonText} !important;text-decoration:none;border-radius:8px;${darkFill(T.gold)}"
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
      <td bgcolor="${T.card}" class="oe-pad oe-card" style="padding:8px 24px 16px;${darkFill(T.card)}">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" bgcolor="${T.charcoal}" class="oe-inset" style="width:100%;${darkFill(T.charcoal)}border:1px solid ${T.border};border-radius:12px;">
          <tr>
            <td bgcolor="${T.charcoal}" class="oe-inset" style="padding:14px;${darkFill(T.charcoal)}">
              <p class="oe-label" style="margin:0 0 6px;font-family:Arial,Helvetica,sans-serif;font-size:12px;font-weight:800;letter-spacing:0.06em;text-transform:uppercase;color:${T.gold} !important;${darkFill(T.charcoal)}">
                Need Help?
              </p>
              <p class="oe-text" style="margin:0 0 8px;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.55;color:${T.textMuted} !important;${darkFill(T.charcoal)}">
                ${escapeHtml(message)}
              </p>
              <p class="oe-link" style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:14px;font-weight:700;color:${T.goldLight} !important;${darkFill(T.charcoal)}">
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
      <td align="center" bgcolor="${T.card}" class="oe-pad oe-card" style="padding:0 24px 24px;${darkFill(T.card)}">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" bgcolor="${T.card}" style="${darkFill(T.card)}">
          <tr>
            <td align="center" bgcolor="${T.card}" style="border-top:1px solid ${T.divider};padding-top:16px;${darkFill(T.card)}">
              <p class="oe-subtle" style="margin:0 0 2px;font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:1.45;color:${T.textSubtle} !important;${darkFill(T.card)}">
                &copy; ${currentYear} One Eyrie
              </p>
              <p class="oe-subtle" style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:1.45;color:${T.textSubtle} !important;${darkFill(T.card)}">
                Hotel Operations Platform
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>`;
}

/**
 * One Eyrie dark transactional email — same look on desktop and mobile.
 * Built to resist Gmail mobile white-background inversion.
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
    ? `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" bgcolor="${T.card}" style="margin-top:12px;${darkFill(T.card)}"><tr><td bgcolor="${T.card}" class="oe-text" style="${darkFill(T.card)}color:${T.textMuted} !important;">${input.belowCtaHtml}</td></tr></table>`
    : "";

  return `<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta name="color-scheme" content="dark only" />
  <meta name="supported-color-schemes" content="dark only" />
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
    :root { color-scheme: dark only; supported-color-schemes: dark only; }
    body, table, td, a, p, h1, span {
      -webkit-text-size-adjust: 100%;
      -ms-text-size-adjust: 100%;
    }
    table, td {
      mso-table-lspace: 0pt;
      mso-table-rspace: 0pt;
      border-collapse: collapse !important;
    }
    img {
      -ms-interpolation-mode: bicubic;
      border: 0;
      height: auto;
      line-height: 100%;
      outline: none;
      text-decoration: none;
    }
    body {
      margin: 0 !important;
      padding: 0 !important;
      width: 100% !important;
      background-color: ${T.black} !important;
      background-image: linear-gradient(${T.black}, ${T.black}) !important;
    }
    /* Force One Eyrie dark surfaces — defeats Gmail mobile white bleach. */
    .oe-root,
    .oe-root > tbody > tr > td,
    .oe-shell {
      background-color: ${T.black} !important;
      background-image: linear-gradient(${T.black}, ${T.black}) !important;
    }
    .oe-card,
    .oe-card td,
    .oe-pad,
    .oe-body-copy,
    .oe-body-copy td {
      background-color: ${T.card} !important;
      background-image: linear-gradient(${T.card}, ${T.card}) !important;
    }
    .oe-header,
    .oe-header td,
    .oe-inset,
    .oe-inset td {
      background-color: ${T.charcoal} !important;
      background-image: linear-gradient(${T.charcoal}, ${T.charcoal}) !important;
    }
    .oe-cta,
    .oe-cta a {
      background-color: ${T.gold} !important;
      background-image: linear-gradient(${T.gold}, ${T.gold}) !important;
      color: ${T.buttonText} !important;
    }
    .oe-heading { color: ${T.text} !important; }
    .oe-text,
    .oe-text p,
    .oe-text td,
    .oe-body-copy,
    .oe-body-copy p,
    .oe-body-copy td { color: ${T.textMuted} !important; }
    .oe-body-copy strong,
    .oe-text strong { color: ${T.text} !important; }
    .oe-label { color: ${T.gold} !important; }
    .oe-link,
    .oe-link a { color: ${T.goldLight} !important; }
    .oe-subtle { color: ${T.textSubtle} !important; }
    /* Gmail dark-mode attribute variants */
    [data-ogsc] .oe-root,
    [data-ogsc] .oe-shell,
    [data-ogsb] .oe-root,
    [data-ogsb] .oe-shell {
      background-color: ${T.black} !important;
      background-image: linear-gradient(${T.black}, ${T.black}) !important;
    }
    [data-ogsc] .oe-card,
    [data-ogsc] .oe-card td,
    [data-ogsc] .oe-body-copy,
    [data-ogsc] .oe-body-copy td,
    [data-ogsb] .oe-card,
    [data-ogsb] .oe-card td,
    [data-ogsb] .oe-body-copy,
    [data-ogsb] .oe-body-copy td {
      background-color: ${T.card} !important;
      background-image: linear-gradient(${T.card}, ${T.card}) !important;
    }
    [data-ogsc] .oe-heading,
    [data-ogsb] .oe-heading { color: ${T.text} !important; }
    [data-ogsc] .oe-text,
    [data-ogsc] .oe-body-copy,
    [data-ogsb] .oe-text,
    [data-ogsb] .oe-body-copy { color: ${T.textMuted} !important; }
    /* Stop auto-detected address/phone links from turning blue */
    a[x-apple-data-detectors],
    u + #body a,
    #MessageViewBody a,
    .oe-autolink,
    .oe-autolink a {
      color: ${T.textMuted} !important;
      text-decoration: none !important;
      font-size: inherit !important;
      font-family: inherit !important;
      font-weight: inherit !important;
      line-height: inherit !important;
    }
    @media only screen and (max-width: 620px) {
      .oe-shell { padding: 16px 12px !important; }
      .oe-pad { padding-left: 16px !important; padding-right: 16px !important; }
    }
  </style>
  <!--[if mso]>
  <style type="text/css">
    body, table, td { font-family: Arial, Helvetica, sans-serif !important; }
  </style>
  <![endif]-->
</head>
<body
  id="body"
  class="oe-body"
  bgcolor="${T.black}"
  style="margin:0;padding:0;width:100%;${darkFill(T.black)}"
>
  ${preheader}
  <table
    role="presentation"
    class="oe-root"
    cellpadding="0"
    cellspacing="0"
    border="0"
    width="100%"
    bgcolor="${T.black}"
    style="width:100%;${darkFill(T.black)}"
  >
    <tr>
      <td
        align="center"
        bgcolor="${T.black}"
        class="oe-shell"
        style="padding:24px 16px;${darkFill(T.black)}"
      >
        <!--[if mso]>
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600" bgcolor="${T.card}"><tr><td bgcolor="${T.card}">
        <![endif]-->
        <table
          role="presentation"
          class="oe-card"
          cellpadding="0"
          cellspacing="0"
          border="0"
          width="100%"
          bgcolor="${T.card}"
          style="max-width:600px;width:100%;${darkFill(T.card)}border:1px solid ${T.gold};border-radius:14px;"
        >
          ${renderHeader()}
          <tr>
            <td bgcolor="${T.card}" class="oe-pad oe-card" style="padding:24px 24px 8px;${darkFill(T.card)}">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" bgcolor="${T.card}" style="${darkFill(T.card)}">
                <tr>
                  <td align="center" bgcolor="${T.card}" style="padding:0 0 16px;${darkFill(T.card)}">
                    <h1
                      class="oe-heading"
                      style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:22px;line-height:1.3;font-weight:800;color:${T.text} !important;text-align:center;${darkFill(T.card)}"
                    >
                      ${escapeHtml(input.heading)}
                    </h1>
                  </td>
                </tr>
                <tr>
                  <td
                    bgcolor="${T.card}"
                    class="oe-body-copy oe-text"
                    style="font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.6;color:${T.textMuted} !important;${darkFill(T.card)}"
                  >
                    ${input.bodyHtml}
                  </td>
                </tr>
                ${
                  ctaHtml || belowCta
                    ? `<tr><td align="center" bgcolor="${T.card}" style="padding:20px 0 4px;${darkFill(T.card)}">${ctaHtml}${belowCta}</td></tr>`
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
