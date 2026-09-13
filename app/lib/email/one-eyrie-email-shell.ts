/**
 * Shared One Eyrie transactional email shell.
 *
 * Master visual: “Your Lost Item Has Been Found” guest shipping email —
 * black header, text ONE (white) / EYRIE (gold), uppercase subtitle,
 * thin gold divider, white body, bold black headline, gold CTA.
 *
 * Email-safe tables only. No logo image. No dark-mode CSS hacks.
 */
import { escapeHtml } from "@/app/lib/email/escape-html";
import { EMAIL_SUPPORT_ADDRESS } from "@/app/lib/email/brand";

export const ONE_EYRIE_EMAIL = {
  white: "#FFFFFF",
  card: "#F7F7F5",
  primary: "#111111",
  secondary: "#4A4A4A",
  muted: "#6B6B6B",
  border: "#E5E5E5",
  gold: "#D4AF37",
  header: "#111111",
} as const;

const C = ONE_EYRIE_EMAIL;

/** Explicit bgcolor + background-color on every painted surface. */
export function paintEmail(color: string, extraStyle = ""): string {
  return `bgcolor="${color}" style="background-color:${color};${extraStyle}"`;
}

/** @deprecated Prefer paintEmail — alias for callers migrating from guest layout. */
export const paint = paintEmail;

export type OneEyrieEmailShellInput = {
  /** Small uppercase header subtitle under the wordmark (e.g. ACCOUNT INVITATION). */
  headerSubtitle: string;
  heading: string;
  preheader?: string;
  /** Escaped/safe HTML for the main body. */
  bodyHtml: string;
  cta?: { label: string; url: string };
  /** Escaped/safe HTML under the CTA (expiry, ignore notice, etc.). */
  belowCtaHtml?: string;
  /**
   * Footer support line. Defaults to a generic help blurb + support email.
   * Pass empty string to omit the support block.
   */
  supportBlurb?: string | null;
  /**
   * When true, append the platform support mailto under the support blurb.
   * Defaults to true when using the default blurb; false when a custom blurb is set.
   */
  showSupportEmail?: boolean;
  /** Subtle reference / debug text under the footer divider (already escaped). */
  referenceHtml?: string;
  currentYear?: number;
};

function renderCta(label: string, url: string): string {
  const safeLabel = escapeHtml(label);
  const safeUrl = escapeHtml(url);

  return `
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" ${paintEmail(C.white, "width:100%;")}>
      <tr ${paintEmail(C.white)}>
        <td align="center" ${paintEmail(C.white, "padding:8px 0 0;")}>
          <table role="presentation" cellpadding="0" cellspacing="0" border="0" ${paintEmail(C.gold)}>
            <tr ${paintEmail(C.gold)}>
              <td align="center" ${paintEmail(C.gold, "border-radius:8px;")}>
                <a href="${safeUrl}" target="_blank" style="display:inline-block;padding:14px 28px;font-family:Arial,Helvetica,sans-serif;font-size:14px;font-weight:800;letter-spacing:0.04em;line-height:1.2;color:${C.primary};text-decoration:none;background-color:${C.gold};border-radius:8px;">
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
 * Gold uppercase label + body content in a light card — shared section pattern.
 */
export function renderEmailDetailCard(label: string, bodyHtml: string): string {
  return `
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" ${paintEmail(C.card, `width:100%;border:1px solid ${C.border};border-radius:12px;margin:0 0 14px;`)}>
      <tr ${paintEmail(C.card)}>
        <td ${paintEmail(C.card, "padding:16px;")}>
          <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" ${paintEmail(C.card, "width:100%;")}>
            <tr ${paintEmail(C.card)}>
              <td ${paintEmail(C.card, `padding:0 0 10px;font-family:Arial,Helvetica,sans-serif;font-size:11px;font-weight:800;letter-spacing:0.2em;text-transform:uppercase;color:${C.gold};`)}>
                <span style="color:${C.gold};">${escapeHtml(label)}</span>
              </td>
            </tr>
            <tr ${paintEmail(C.card)}>
              <td ${paintEmail(C.card, `font-family:Arial,Helvetica,sans-serif;font-size:15px;font-weight:700;line-height:1.5;color:${C.primary};`)}>
                ${bodyHtml}
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>`;
}

export function renderEmailParagraph(html: string, bottomPad = 16): string {
  return `
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" ${paintEmail(C.white, "width:100%;")}>
      <tr ${paintEmail(C.white)}>
        <td ${paintEmail(C.white, `padding:0 0 ${bottomPad}px;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.6;color:${C.secondary};`)}>
          <span style="color:${C.secondary};">${html}</span>
        </td>
      </tr>
    </table>`;
}

/**
 * Canonical One Eyrie transactional HTML document.
 */
export function renderOneEyrieEmailHtml(input: OneEyrieEmailShellInput): string {
  const year = input.currentYear ?? new Date().getUTCFullYear();
  const supportAddress = escapeHtml(EMAIL_SUPPORT_ADDRESS);

  const preheader = input.preheader
    ? `<div style="display:none;max-height:0;overflow:hidden;mso-hide:all;font-size:1px;line-height:1px;color:${C.white};opacity:0;">${escapeHtml(input.preheader)}</div>`
    : "";

  const belowCta = input.belowCtaHtml?.trim()
    ? `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" ${paintEmail(C.white, "width:100%;")}>
        <tr ${paintEmail(C.white)}>
          <td align="center" ${paintEmail(C.white, "padding:16px 0 0;")}>
            ${input.belowCtaHtml}
          </td>
        </tr>
      </table>`
    : "";

  const ctaBlock = input.cta ? renderCta(input.cta.label, input.cta.url) : "";

  const supportRaw = input.supportBlurb;
  const showSupport = supportRaw !== "";
  const supportText =
    supportRaw == null
      ? "If you have questions about One Eyrie, our team is happy to help."
      : supportRaw.trim();
  const showSupportEmail =
    input.showSupportEmail ?? supportRaw == null;

  const supportBlock = showSupport
    ? `<tr ${paintEmail(C.white)}>
          <td ${paintEmail(C.white, "padding:8px 28px 12px;")}>
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" ${paintEmail(C.white, `width:100%;border-top:1px solid ${C.border};`)}>
              <tr ${paintEmail(C.white)}>
                <td ${paintEmail(C.white, `padding-top:18px;font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:1.55;color:${C.secondary};`)}>
                  <span style="color:${C.secondary};">${supportText}</span>
                  ${
                    showSupportEmail
                      ? `<br/><a href="mailto:${supportAddress}" style="color:${C.gold};text-decoration:none;font-weight:700;">${supportAddress}</a>`
                      : ""
                  }
                </td>
              </tr>
            </table>
          </td>
        </tr>`
    : "";

  const referenceBlock = input.referenceHtml?.trim()
    ? `<tr ${paintEmail(C.white)}>
          <td align="center" ${paintEmail(C.white, `padding:0 28px 8px;font-family:Arial,Helvetica,sans-serif;font-size:11px;line-height:1.5;color:${C.muted};`)}>
            ${input.referenceHtml}
          </td>
        </tr>`
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
<body ${paintEmail(C.white, `margin:0;padding:0;width:100%;font-family:Arial,Helvetica,sans-serif;color:${C.primary};`)}>
${preheader}
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" ${paintEmail(C.white, "width:100%;")}>
  <tr ${paintEmail(C.white)}>
    <td align="center" ${paintEmail(C.white, "padding:24px 12px;")}>
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" ${paintEmail(C.white, `max-width:600px;width:100%;border:1px solid ${C.border};`)}>
        <tr ${paintEmail(C.header)}>
          <td align="center" ${paintEmail(C.header, `padding:20px 22px 16px;border-bottom:3px solid ${C.gold};`)}>
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" ${paintEmail(C.header)}>
              <tr ${paintEmail(C.header)}>
                <td align="center" ${paintEmail(C.header, `font-family:Arial,Helvetica,sans-serif;font-size:13px;font-weight:700;letter-spacing:0.28em;line-height:1.25;text-transform:uppercase;color:${C.white};`)}>
                  <span style="color:${C.white};">ONE</span>
                </td>
              </tr>
              <tr ${paintEmail(C.header)}>
                <td align="center" ${paintEmail(C.header, `padding-top:2px;font-family:Arial,Helvetica,sans-serif;font-size:13px;font-weight:700;letter-spacing:0.28em;line-height:1.25;text-transform:uppercase;color:${C.gold};`)}>
                  <span style="color:${C.gold};">EYRIE</span>
                </td>
              </tr>
              <tr ${paintEmail(C.header)}>
                <td align="center" ${paintEmail(C.header, `padding-top:12px;font-family:Arial,Helvetica,sans-serif;font-size:11px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:${C.white};`)}>
                  <span style="color:${C.white};">${escapeHtml(input.headerSubtitle)}</span>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <tr ${paintEmail(C.white)}>
          <td ${paintEmail(C.white, "padding:32px 28px 12px;")}>
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" ${paintEmail(C.white, "width:100%;")}>
              <tr ${paintEmail(C.white)}>
                <td align="center" ${paintEmail(C.white, `padding:0 0 22px;font-family:Arial,Helvetica,sans-serif;font-size:22px;line-height:1.3;font-weight:800;color:${C.primary};`)}>
                  <span style="color:${C.primary};">${escapeHtml(input.heading)}</span>
                </td>
              </tr>
            </table>

            ${input.bodyHtml}

            ${ctaBlock}
            ${belowCta}
          </td>
        </tr>

        ${supportBlock}
        ${referenceBlock}

        <tr ${paintEmail(C.white)}>
          <td align="center" ${paintEmail(C.white, `padding:4px 28px 24px;font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:1.5;color:${C.muted};`)}>
            <span style="color:${C.muted};">&copy; ${year} One Eyrie<br/>Hotel Operations Platform</span>
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>
</body>
</html>`;
}
