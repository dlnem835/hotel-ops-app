import { escapeHtml } from "@/app/lib/email/escape-html";
import {
  EMAIL_SUPPORT_ADDRESS,
  EMAIL_THEME as T,
  getEmailLogoUrl,
  getEmailSiteOrigin,
} from "@/app/lib/email/brand";
import type { TransactionalEmailLayoutInput } from "@/app/lib/email/types";

/**
 * Gmail strips `!important` from *inline* styles and can drop the whole
 * background-color declaration. Use bgcolor + plain inline color + tiled PNG.
 */
function surfaceAttrs(
  color: string,
  imageUrl: string
): { bgcolor: string; background: string; style: string } {
  return {
    bgcolor: color,
    background: imageUrl,
    style: `background-color:${color};background-image:url('${imageUrl}');background-repeat:repeat;`,
  };
}

function emailBgUrls() {
  const origin = getEmailSiteOrigin();
  return {
    black: `${origin}/email/oe-bg-black.png`,
    card: `${origin}/email/oe-bg-card.png`,
    panel: `${origin}/email/oe-bg-panel.png`,
  };
}

function renderHeader(bg: ReturnType<typeof emailBgUrls>): string {
  const logoUrl = escapeHtml(getEmailLogoUrl());
  const siteOrigin = escapeHtml(getEmailSiteOrigin());
  const panel = surfaceAttrs(T.charcoal, bg.panel);

  return `
    <tr>
      <td
        align="center"
        bgcolor="${panel.bgcolor}"
        background="${panel.background}"
        class="oe-header"
        style="padding:20px 24px 16px;${panel.style}border-bottom:2px solid ${T.gold};"
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

function renderCta(label: string, url: string, bg: ReturnType<typeof emailBgUrls>): string {
  const safeLabel = escapeHtml(label);
  const safeUrl = escapeHtml(url);
  const card = surfaceAttrs(T.card, bg.card);
  const buttonFont =
    "font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;font-size:16px;font-weight:700;letter-spacing:0.04em;";

  return `
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" bgcolor="${card.bgcolor}" background="${card.background}" style="margin:4px auto 0;${card.style}">
      <tr>
        <td align="center" bgcolor="${T.gold}" class="oe-cta" style="border-radius:8px;background-color:${T.gold};">
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
            style="display:inline-block;min-height:50px;line-height:50px;padding:0 28px;${buttonFont}color:${T.buttonText};text-decoration:none;border-radius:8px;background-color:${T.gold};"
          >
            ${safeLabel}
          </a>
          <!--<![endif]-->
        </td>
      </tr>
    </table>`;
}

function renderSupportBlock(
  message: string,
  bg: ReturnType<typeof emailBgUrls>
): string {
  const support = escapeHtml(EMAIL_SUPPORT_ADDRESS);
  const card = surfaceAttrs(T.card, bg.card);
  const panel = surfaceAttrs(T.charcoal, bg.panel);

  return `
    <tr>
      <td bgcolor="${card.bgcolor}" background="${card.background}" class="oe-pad oe-card" style="padding:8px 24px 16px;${card.style}">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" bgcolor="${panel.bgcolor}" background="${panel.background}" class="oe-inset" style="width:100%;${panel.style}border:1px solid ${T.border};border-radius:12px;">
          <tr>
            <td bgcolor="${panel.bgcolor}" background="${panel.background}" class="oe-inset" style="padding:14px;${panel.style}">
              <p class="oe-label" style="margin:0 0 6px;font-family:Arial,Helvetica,sans-serif;font-size:12px;font-weight:800;letter-spacing:0.06em;text-transform:uppercase;color:${T.gold};">
                Need Help?
              </p>
              <p class="oe-text" style="margin:0 0 8px;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.55;color:${T.textMuted};">
                ${escapeHtml(message)}
              </p>
              <p class="oe-link" style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:14px;font-weight:700;color:${T.goldLight};">
                <a href="mailto:${support}" style="color:${T.goldLight};text-decoration:none;">${support}</a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>`;
}

function renderFooter(
  currentYear: number,
  bg: ReturnType<typeof emailBgUrls>
): string {
  const card = surfaceAttrs(T.card, bg.card);

  return `
    <tr>
      <td align="center" bgcolor="${card.bgcolor}" background="${card.background}" class="oe-pad oe-card" style="padding:0 24px 24px;${card.style}">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" bgcolor="${card.bgcolor}" background="${card.background}" style="${card.style}">
          <tr>
            <td align="center" bgcolor="${card.bgcolor}" background="${card.background}" style="border-top:1px solid ${T.divider};padding-top:16px;${card.style}">
              <p class="oe-subtle" style="margin:0 0 2px;font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:1.45;color:${T.textSubtle};">
                &copy; ${currentYear} One Eyrie
              </p>
              <p class="oe-subtle" style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:1.45;color:${T.textSubtle};">
                Hotel Operations Platform
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>`;
}

/**
 * One Eyrie dark transactional email.
 * Gmail-mobile safe: no inline !important; bgcolor + tiled PNG backgrounds.
 */
export function renderTransactionalEmailHtml(
  input: TransactionalEmailLayoutInput
): string {
  const year = input.currentYear ?? new Date().getUTCFullYear();
  const showSupport = input.showSupport !== false;
  const supportMessage =
    input.supportMessage?.trim() ||
    "If you have questions about your account or One Eyrie, our team is happy to help.";
  const bg = emailBgUrls();
  const black = surfaceAttrs(T.black, bg.black);
  const card = surfaceAttrs(T.card, bg.card);

  const preheader = input.preheader
    ? `<div style="display:none;max-height:0;overflow:hidden;mso-hide:all;font-size:1px;line-height:1px;color:${T.black};opacity:0;">
        ${escapeHtml(input.preheader)}
      </div>`
    : "";

  const ctaHtml = input.cta
    ? renderCta(input.cta.label, input.cta.url, bg)
    : "";
  const belowCta = input.belowCtaHtml
    ? `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" bgcolor="${card.bgcolor}" background="${card.background}" style="margin-top:12px;${card.style}"><tr><td bgcolor="${card.bgcolor}" background="${card.background}" class="oe-text" style="${card.style}color:${T.textMuted};">${input.belowCtaHtml}</td></tr></table>`
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
    }
    .oe-root, .oe-shell {
      background-color: ${T.black} !important;
    }
    .oe-card, .oe-card td, .oe-pad, .oe-body-copy, .oe-body-copy td {
      background-color: ${T.card} !important;
    }
    .oe-header, .oe-header td, .oe-inset, .oe-inset td {
      background-color: ${T.charcoal} !important;
    }
    .oe-heading { color: ${T.text} !important; }
    .oe-text, .oe-text p, .oe-body-copy, .oe-body-copy p, .oe-body-copy td {
      color: ${T.textMuted} !important;
    }
    .oe-body-copy strong, .oe-text strong { color: ${T.text} !important; }
    .oe-label { color: ${T.gold} !important; }
    .oe-link, .oe-link a { color: ${T.goldLight} !important; }
    .oe-subtle { color: ${T.textSubtle} !important; }
    .oe-cta, .oe-cta a {
      background-color: ${T.gold} !important;
      color: ${T.buttonText} !important;
    }
    [data-ogsc] .oe-root,
    [data-ogsc] .oe-shell,
    [data-ogsb] .oe-root,
    [data-ogsb] .oe-shell {
      background-color: ${T.black} !important;
    }
    [data-ogsc] .oe-card,
    [data-ogsc] .oe-card td,
    [data-ogsc] .oe-body-copy,
    [data-ogsb] .oe-card,
    [data-ogsb] .oe-card td,
    [data-ogsb] .oe-body-copy {
      background-color: ${T.card} !important;
    }
    [data-ogsc] .oe-heading,
    [data-ogsb] .oe-heading { color: ${T.text} !important; }
    [data-ogsc] .oe-text,
    [data-ogsc] .oe-body-copy,
    [data-ogsb] .oe-text,
    [data-ogsb] .oe-body-copy { color: ${T.textMuted} !important; }
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
  bgcolor="${black.bgcolor}"
  background="${black.background}"
  style="margin:0;padding:0;width:100%;${black.style}"
>
  ${preheader}
  <table
    role="presentation"
    class="oe-root"
    cellpadding="0"
    cellspacing="0"
    border="0"
    width="100%"
    bgcolor="${black.bgcolor}"
    background="${black.background}"
    style="width:100%;${black.style}"
  >
    <tr>
      <td
        align="center"
        bgcolor="${black.bgcolor}"
        background="${black.background}"
        class="oe-shell"
        style="padding:24px 16px;${black.style}"
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
          bgcolor="${card.bgcolor}"
          background="${card.background}"
          style="max-width:600px;width:100%;${card.style}border:1px solid ${T.gold};border-radius:14px;"
        >
          ${renderHeader(bg)}
          <tr>
            <td bgcolor="${card.bgcolor}" background="${card.background}" class="oe-pad oe-card" style="padding:24px 24px 8px;${card.style}">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" bgcolor="${card.bgcolor}" background="${card.background}" style="${card.style}">
                <tr>
                  <td align="center" bgcolor="${card.bgcolor}" background="${card.background}" style="padding:0 0 16px;${card.style}">
                    <h1
                      class="oe-heading"
                      style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:22px;line-height:1.3;font-weight:800;color:${T.text};text-align:center;"
                    >
                      ${escapeHtml(input.heading)}
                    </h1>
                  </td>
                </tr>
                <tr>
                  <td
                    bgcolor="${card.bgcolor}"
                    background="${card.background}"
                    class="oe-body-copy oe-text"
                    style="font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.6;color:${T.textMuted};${card.style}"
                  >
                    ${input.bodyHtml}
                  </td>
                </tr>
                ${
                  ctaHtml || belowCta
                    ? `<tr><td align="center" bgcolor="${card.bgcolor}" background="${card.background}" style="padding:20px 0 4px;${card.style}">${ctaHtml}${belowCta}</td></tr>`
                    : ""
                }
              </table>
            </td>
          </tr>
          ${showSupport ? renderSupportBlock(supportMessage, bg) : ""}
          ${renderFooter(year, bg)}
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
