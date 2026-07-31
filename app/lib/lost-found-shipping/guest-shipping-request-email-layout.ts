/**
 * Guest shipping-request email shell ONLY.
 *
 * Visual restore from commit 598bc6c (Jul 30 afternoon dark guest shipping
 * restore — first 7/30 email layout). Isolated from
 * `app/lib/email/transactional-layout.ts` so invitation, password-reset,
 * and fulfillment emails stay on the current shared shell.
 */
import { escapeHtml } from "@/app/lib/email/escape-html";
import {
  EMAIL_SUPPORT_ADDRESS,
  EMAIL_THEME as T,
  getEmailLogoUrl,
  getEmailSiteOrigin,
} from "@/app/lib/email/brand";

export type GuestShippingRequestEmailLayoutInput = {
  heading: string;
  preheader?: string;
  bodyHtml: string;
  cta: { label: string; url: string };
  belowCtaHtml?: string;
  showSupport?: boolean;
  supportMessage?: string;
  currentYear?: number;
};

function renderHeader(): string {
  const logoUrl = escapeHtml(getEmailLogoUrl());
  const siteOrigin = escapeHtml(getEmailSiteOrigin());

  return `
    <tr>
      <td
        align="center"
        bgcolor="${T.charcoal}"
        style="padding:36px 32px 28px;background-color:${T.charcoal};border-bottom:3px solid ${T.gold};"
      >
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
        <td
          align="center"
          bgcolor="${T.gold}"
          style="border-radius:999px;background-color:${T.gold};"
        >
          <a
            href="${safeUrl}"
            target="_blank"
            style="display:inline-block;padding:14px 32px;font-family:Arial,Helvetica,sans-serif;font-size:15px;font-weight:800;line-height:1.2;color:${T.buttonText};text-decoration:none;border-radius:999px;background-color:${T.gold};"
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
      <td
        bgcolor="${T.card}"
        style="padding:0 32px 28px;background-color:${T.card};"
      >
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" bgcolor="${T.card}" style="background-color:${T.card};">
          <tr>
            <td
              bgcolor="${T.card}"
              style="border-top:1px solid ${T.divider};padding-top:24px;background-color:${T.card};"
            >
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
      <td
        align="center"
        bgcolor="${T.card}"
        style="padding:8px 32px 36px;background-color:${T.card};"
      >
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" bgcolor="${T.card}" style="background-color:${T.card};">
          <tr>
            <td
              align="center"
              bgcolor="${T.card}"
              style="border-top:1px solid ${T.divider};padding-top:22px;background-color:${T.card};"
            >
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

/**
 * Dark charcoal card, gold accents, logo header — same shell as 598bc6c.
 */
export function renderGuestShippingRequestEmailHtml(
  input: GuestShippingRequestEmailLayoutInput
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

  const ctaHtml = renderCta(input.cta.label, input.cta.url);
  const belowCta = input.belowCtaHtml
    ? `<div style="margin-top:20px;">${input.belowCtaHtml}</div>`
    : "";

  return `<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta name="color-scheme" content="dark light" />
  <meta name="supported-color-schemes" content="dark light" />
  <title>${escapeHtml(input.heading)}</title>
  <style type="text/css">
    :root { color-scheme: dark light; supported-color-schemes: dark light; }
    body, table, td, a { -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
    table, td { mso-table-lspace: 0pt; mso-table-rspace: 0pt; border-collapse: collapse; }
    img { -ms-interpolation-mode: bicubic; border: 0; height: auto; line-height: 100%; outline: none; text-decoration: none; }
    body {
      margin: 0 !important;
      padding: 0 !important;
      width: 100% !important;
      background-color: ${T.black} !important;
    }
    .oe-email-outer { background-color: ${T.black} !important; }
    .oe-email-card { background-color: ${T.card} !important; }
    @media only screen and (max-width: 620px) {
      .oe-email-pad { padding-left: 16px !important; padding-right: 16px !important; }
      .oe-email-shell-pad { padding: 16px 10px !important; }
      .oe-email-heading { font-size: 22px !important; line-height: 1.3 !important; }
    }
  </style>
  <!--[if mso]>
  <style type="text/css">
    body, table, td { font-family: Arial, Helvetica, sans-serif !important; }
  </style>
  <![endif]-->
</head>
<body
  bgcolor="${T.black}"
  style="margin:0;padding:0;width:100%;background-color:${T.black};"
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
    style="width:100%;background-color:${T.black};"
  >
    <tr>
      <td
        align="center"
        bgcolor="${T.black}"
        class="oe-email-shell-pad"
        style="padding:28px 16px;background-color:${T.black};"
      >
        <table
          role="presentation"
          class="oe-email-card"
          cellpadding="0"
          cellspacing="0"
          border="0"
          width="100%"
          bgcolor="${T.card}"
          style="max-width:560px;width:100%;background-color:${T.card};border:1px solid ${T.gold};border-radius:18px;"
        >
          ${renderHeader()}
          <tr>
            <td
              bgcolor="${T.card}"
              class="oe-email-pad"
              style="padding:36px 32px 8px;background-color:${T.card};"
            >
              <h1
                class="oe-email-heading"
                style="margin:0 0 22px;font-family:Arial,Helvetica,sans-serif;font-size:26px;line-height:1.25;font-weight:800;color:${T.text};text-align:center;"
              >
                ${escapeHtml(input.heading)}
              </h1>
              <div style="font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.7;color:${T.textMuted};">
                ${input.bodyHtml}
              </div>
              <div style="margin:28px 0 8px;text-align:center;">${ctaHtml}${belowCta}</div>
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
