import { escapeHtml } from "@/app/lib/email/escape-html";
import {
  EMAIL_SUPPORT_ADDRESS,
  EMAIL_THEME as T,
  getEmailLogoUrl,
  getEmailSiteOrigin,
} from "@/app/lib/email/brand";
import type { TransactionalEmailLayoutInput } from "@/app/lib/email/types";

function renderHeader(): string {
  const logoUrl = escapeHtml(getEmailLogoUrl());
  const siteOrigin = escapeHtml(getEmailSiteOrigin());

  return `
    <tr>
      <td align="center" style="padding:36px 32px 28px;background:${T.charcoal};border-bottom:3px solid ${T.gold};">
        <a href="${siteOrigin}" style="text-decoration:none;">
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
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" style="margin:8px auto 0;">
      <tr>
        <td align="center" bgcolor="${T.gold}" style="border-radius:999px;background:${T.gold};">
          <a
            href="${safeUrl}"
            target="_blank"
            style="display:inline-block;padding:14px 32px;font-family:Arial,Helvetica,sans-serif;font-size:15px;font-weight:800;line-height:1.2;color:${T.buttonText};text-decoration:none;border-radius:999px;background:${T.gold};box-shadow:0 10px 24px rgba(200,169,106,0.28);"
          >
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
      <td style="padding:0 32px 28px;">
        <div style="border-top:1px solid ${T.divider};padding-top:24px;">
          <p style="margin:0 0 8px;font-family:Arial,Helvetica,sans-serif;font-size:13px;font-weight:800;letter-spacing:0.06em;text-transform:uppercase;color:${T.gold};">
            Need Help?
          </p>
          <p style="margin:0 0 12px;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.65;color:${T.textMuted};">
            ${escapeHtml(message)}
          </p>
          <p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:14px;font-weight:700;">
            <a href="mailto:${support}" style="color:${T.goldLight};text-decoration:none;">${support}</a>
          </p>
        </div>
      </td>
    </tr>`;
}

function renderFooter(currentYear: number): string {
  return `
    <tr>
      <td align="center" style="padding:8px 32px 36px;">
        <div style="border-top:1px solid ${T.divider};padding-top:22px;">
          <p style="margin:0 0 4px;font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:1.5;color:${T.textSubtle};">
            &copy; ${currentYear} One Eyrie
          </p>
          <p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:1.5;color:${T.textSubtle};">
            Hotel Operations Platform
          </p>
        </div>
      </td>
    </tr>`;
}

/**
 * Shared One Eyrie transactional email shell.
 * Dark charcoal card, gold accents, logo header, optional CTA, support + footer.
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
    ? `<div style="margin-top:20px;">${input.belowCtaHtml}</div>`
    : "";

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta name="color-scheme" content="dark" />
  <meta name="supported-color-schemes" content="dark" />
  <title>${escapeHtml(input.heading)}</title>
</head>
<body style="margin:0;padding:0;background:${T.black};">
  ${preheader}
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:${T.black};">
    <tr>
      <td align="center" style="padding:28px 16px;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="max-width:560px;background:${T.card};border:1px solid ${T.gold};border-radius:18px;overflow:hidden;box-shadow:0 20px 50px rgba(0,0,0,0.45);">
          ${renderHeader()}
          <tr>
            <td style="padding:36px 32px 8px;">
              <h1 style="margin:0 0 22px;font-family:Arial,Helvetica,sans-serif;font-size:26px;line-height:1.25;font-weight:800;color:${T.text};text-align:center;">
                ${escapeHtml(input.heading)}
              </h1>
              <div style="font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.7;color:${T.textMuted};">
                ${input.bodyHtml}
              </div>
              ${
                ctaHtml || belowCta
                  ? `<div style="margin:28px 0 8px;text-align:center;">${ctaHtml}${belowCta}</div>`
                  : ""
              }
            </td>
          </tr>
          ${showSupport ? renderSupportBlock(supportMessage) : ""}
          ${renderFooter(year)}
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}
