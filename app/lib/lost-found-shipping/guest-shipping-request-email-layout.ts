/**
 * Guest shipping-request email shell ONLY (Shippo/Stripe link email).
 *
 * Light, minimal, email-safe template for Gmail mobile dark-mode reliability.
 * Isolated from `transactional-layout.ts` — invitation/auth unchanged.
 *
 * Palette: bg #FFFFFF · cards #F7F7F5 · primary #111111 · secondary #4A4A4A
 *          borders #E5E5E5 · gold #D4AF37
 *
 * No color-scheme, prefers-color-scheme, or dark-mode patches.
 */
import { escapeHtml } from "@/app/lib/email/escape-html";

export type GuestShippingRequestEmailLayoutInput = {
  heading: string;
  preheader?: string;
  bodyHtml: string;
  cta: { label: string; url: string };
  /** Rendered under the CTA (e.g. link expiry). */
  belowCtaHtml?: string;
  supportBlurb?: string;
};

const WHITE = "#FFFFFF";
const CARD = "#F7F7F5";
const PRIMARY = "#111111";
const SECONDARY = "#4A4A4A";
const BORDER = "#E5E5E5";
const GOLD = "#D4AF37";
const HEADER = "#111111";

/** Explicit bgcolor + background-color on every painted surface. */
export function paint(color: string, extraStyle = ""): string {
  return `bgcolor="${color}" style="background-color:${color};${extraStyle}"`;
}

export const GUEST_SHIPPING_EMAIL_COLORS = {
  white: WHITE,
  card: CARD,
  primary: PRIMARY,
  secondary: SECONDARY,
  border: BORDER,
  gold: GOLD,
  header: HEADER,
} as const;

function renderCta(label: string, url: string): string {
  const safeLabel = escapeHtml(label);
  const safeUrl = escapeHtml(url);

  return `
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" ${paint(WHITE, "width:100%;")}>
      <tr ${paint(WHITE)}>
        <td align="center" ${paint(WHITE, "padding:8px 0 0;")}>
          <table role="presentation" cellpadding="0" cellspacing="0" border="0" ${paint(GOLD)}>
            <tr ${paint(GOLD)}>
              <td align="center" ${paint(GOLD, "border-radius:8px;")}>
                <a href="${safeUrl}" target="_blank" style="display:inline-block;padding:14px 28px;font-family:Arial,Helvetica,sans-serif;font-size:14px;font-weight:800;letter-spacing:0.04em;line-height:1.2;color:${PRIMARY};text-decoration:none;background-color:${GOLD};border-radius:8px;">
                  ${safeLabel}
                </a>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>`;
}

/**
 * Light table shell: small black header + white body + gold accents.
 */
export function renderGuestShippingRequestEmailHtml(
  input: GuestShippingRequestEmailLayoutInput
): string {
  const preheader = input.preheader
    ? `<div style="display:none;max-height:0;overflow:hidden;mso-hide:all;font-size:1px;line-height:1px;color:${WHITE};opacity:0;">${escapeHtml(input.preheader)}</div>`
    : "";

  const support =
    input.supportBlurb?.trim() ||
    "Questions? We&rsquo;re here to help with your return shipping.";

  const belowCta = input.belowCtaHtml?.trim()
    ? `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" ${paint(WHITE, "width:100%;")}>
        <tr ${paint(WHITE)}>
          <td align="center" ${paint(WHITE, "padding:16px 0 0;")}>
            ${input.belowCtaHtml}
          </td>
        </tr>
      </table>`
    : "";

  return `<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(input.heading)}</title>
  <!--[if mso]>
  <style type="text/css">
    body, table, td { font-family: Arial, Helvetica, sans-serif !important; }
  </style>
  <![endif]-->
</head>
<body ${paint(WHITE, "margin:0;padding:0;width:100%;font-family:Arial,Helvetica,sans-serif;color:" + PRIMARY + ";")}>
${preheader}
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" ${paint(WHITE, "width:100%;")}>
  <tr ${paint(WHITE)}>
    <td align="center" ${paint(WHITE, "padding:24px 12px;")}>
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" ${paint(WHITE, "max-width:600px;width:100%;border:1px solid " + BORDER + ";")}>
        <tr ${paint(HEADER)}>
          <td align="center" ${paint(HEADER, "padding:20px 22px 16px;border-bottom:3px solid " + GOLD + ";")}>
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" ${paint(HEADER)}>
              <tr ${paint(HEADER)}>
                <td align="center" ${paint(HEADER, "font-family:Arial,Helvetica,sans-serif;font-size:13px;font-weight:700;letter-spacing:0.28em;line-height:1.25;text-transform:uppercase;color:" + WHITE + ";")}>
                  <span style="color:${WHITE};">ONE</span>
                </td>
              </tr>
              <tr ${paint(HEADER)}>
                <td align="center" ${paint(HEADER, "padding-top:2px;font-family:Arial,Helvetica,sans-serif;font-size:13px;font-weight:700;letter-spacing:0.28em;line-height:1.25;text-transform:uppercase;color:" + GOLD + ";")}>
                  <span style="color:${GOLD};">EYRIE</span>
                </td>
              </tr>
              <tr ${paint(HEADER)}>
                <td align="center" ${paint(HEADER, "padding-top:12px;font-family:Arial,Helvetica,sans-serif;font-size:11px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:" + WHITE + ";")}>
                  <span style="color:${WHITE};">Lost &amp; Found Shipping Request</span>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <tr ${paint(WHITE)}>
          <td ${paint(WHITE, "padding:32px 28px 12px;")}>
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" ${paint(WHITE, "width:100%;")}>
              <tr ${paint(WHITE)}>
                <td align="center" ${paint(WHITE, "padding:0 0 22px;font-family:Arial,Helvetica,sans-serif;font-size:22px;line-height:1.3;font-weight:800;color:" + PRIMARY + ";")}>
                  <span style="color:${PRIMARY};">${escapeHtml(input.heading)}</span>
                </td>
              </tr>
            </table>

            ${input.bodyHtml}

            ${renderCta(input.cta.label, input.cta.url)}
            ${belowCta}
          </td>
        </tr>

        <tr ${paint(WHITE)}>
          <td ${paint(WHITE, "padding:8px 28px 28px;")}>
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" ${paint(WHITE, "width:100%;border-top:1px solid " + BORDER + ";")}>
              <tr ${paint(WHITE)}>
                <td ${paint(WHITE, "padding-top:18px;font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:1.55;color:" + SECONDARY + ";")}>
                  <span style="color:${SECONDARY};">${support}</span>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>
</body>
</html>`;
}
