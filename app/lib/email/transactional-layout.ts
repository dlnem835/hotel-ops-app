import { escapeHtml } from "@/app/lib/email/escape-html";
import {
  EMAIL_SUPPORT_ADDRESS,
  EMAIL_THEME as T,
  getEmailLogoUrl,
  getEmailSiteOrigin,
} from "@/app/lib/email/brand";
import type { TransactionalEmailLayoutInput } from "@/app/lib/email/types";

/**
 * Traditional fixed-width One Eyrie transactional email.
 *
 * Uses a 600px table + bgcolor/inline styles only. No media queries, no
 * color-scheme meta, no class-based background CSS — Gmail Mobile scales a
 * standard 600px email more reliably than fluid/responsive shells.
 */

function renderHeader(): string {
  const logoUrl = escapeHtml(getEmailLogoUrl());
  const siteOrigin = escapeHtml(getEmailSiteOrigin());

  return `
    <tr>
      <td align="center" bgcolor="${T.charcoal}" style="padding:28px 32px 22px;background-color:${T.charcoal};border-bottom:3px solid ${T.gold};">
        <a href="${siteOrigin}" style="text-decoration:none;">
          <img src="${logoUrl}" width="120" height="auto" alt="One Eyrie" style="display:block;margin:0 auto;border:0;outline:none;text-decoration:none;width:120px;height:auto;" />
        </a>
      </td>
    </tr>`;
}

function renderCta(label: string, url: string): string {
  const safeLabel = escapeHtml(label);
  const safeUrl = escapeHtml(url);

  return `
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" style="margin:8px auto 0;">
      <tr>
        <td align="center" bgcolor="${T.gold}" style="background-color:${T.gold};border-radius:8px;">
          <a href="${safeUrl}" target="_blank" style="display:inline-block;padding:14px 28px;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;font-size:16px;font-weight:700;letter-spacing:0.04em;line-height:1.2;color:${T.buttonText};text-decoration:none;background-color:${T.gold};border-radius:8px;">
            ${safeLabel}
          </a>
        </td>
      </tr>
    </table>`;
}

function renderSupportBlock(message: string): string {
  const support = escapeHtml(EMAIL_SUPPORT_ADDRESS);

  return `
    <tr>
      <td bgcolor="${T.card}" style="padding:0 32px 24px;background-color:${T.card};">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" bgcolor="${T.card}" style="background-color:${T.card};">
          <tr>
            <td bgcolor="${T.card}" style="border-top:1px solid ${T.divider};padding-top:20px;background-color:${T.card};">
              <p style="margin:0 0 8px;font-family:Arial,Helvetica,sans-serif;font-size:13px;font-weight:800;letter-spacing:0.06em;text-transform:uppercase;color:${T.gold};">
                Need Help?
              </p>
              <p style="margin:0 0 12px;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.65;color:${T.textMuted};">
                ${escapeHtml(message)}
              </p>
              <p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:14px;font-weight:700;">
                <a href="mailto:${support}" style="color:${T.goldLight};text-decoration:none;">${support}</a>
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
      <td align="center" bgcolor="${T.card}" style="padding:8px 32px 28px;background-color:${T.card};">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" bgcolor="${T.card}" style="background-color:${T.card};">
          <tr>
            <td align="center" bgcolor="${T.card}" style="border-top:1px solid ${T.divider};padding-top:18px;background-color:${T.card};">
              <p style="margin:0 0 4px;font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:1.5;color:${T.textSubtle};">
                &copy; ${currentYear} One Eyrie
              </p>
              <p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:1.5;color:${T.textSubtle};">
                Hotel Operations Platform
              </p>
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
    ? `<div style="display:none;max-height:0;overflow:hidden;mso-hide:all;font-size:1px;line-height:1px;color:${T.black};opacity:0;">${escapeHtml(input.preheader)}</div>`
    : "";

  const ctaHtml = input.cta ? renderCta(input.cta.label, input.cta.url) : "";
  const belowCta = input.belowCtaHtml
    ? `<div style="margin-top:16px;">${input.belowCtaHtml}</div>`
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
<body bgcolor="${T.black}" style="margin:0;padding:0;width:100%;background-color:${T.black};">
  ${preheader}
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" bgcolor="${T.black}" style="width:100%;background-color:${T.black};">
    <tr>
      <td align="center" bgcolor="${T.black}" style="padding:24px 0;background-color:${T.black};">
        <!--[if mso]>
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600" bgcolor="${T.card}"><tr><td>
        <![endif]-->
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600" bgcolor="${T.card}" style="width:600px;max-width:600px;background-color:${T.card};border:1px solid ${T.gold};">
          ${renderHeader()}
          <tr>
            <td bgcolor="${T.card}" style="padding:28px 32px 12px;background-color:${T.card};">
              <h1 style="margin:0 0 18px;font-family:Arial,Helvetica,sans-serif;font-size:24px;line-height:1.3;font-weight:800;color:${T.text};text-align:center;">
                ${escapeHtml(input.heading)}
              </h1>
              <div style="font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.65;color:${T.textMuted};">
                ${input.bodyHtml}
              </div>
              ${
                ctaHtml || belowCta
                  ? `<div style="margin:24px 0 8px;text-align:center;">${ctaHtml}${belowCta}</div>`
                  : ""
              }
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
