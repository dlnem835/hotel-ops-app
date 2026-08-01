/**
 * Guest shipping-request email shell ONLY (Shippo/Stripe link email).
 *
 * Visual format matched to the pre-Shippo Lost & Found label email
 * (`app/lost-and-found/lib/shipping-label-email.ts`): dark One Eyrie
 * surfaces, ONE / EYRIE text header, gold border card, darkFill gradients.
 *
 * Isolated from `transactional-layout.ts` so invitation/auth stay unchanged.
 */
import { escapeHtml } from "@/app/lib/email/escape-html";
import { ONE_EYRIE as C } from "@/app/lib/oneEyrieColors";

export type GuestShippingRequestEmailLayoutInput = {
  heading: string;
  preheader?: string;
  bodyHtml: string;
  cta: { label: string; url: string };
};

export function darkFill(color: string): string {
  return `background-color:${color} !important;background-image:linear-gradient(${color},${color}) !important;`;
}

function renderCta(label: string, url: string): string {
  const safeLabel = escapeHtml(label);
  const safeUrl = escapeHtml(url);

  return `
      <p style="text-align:center;margin:20px 0 0;${darkFill(C.surface)}">
        <a href="${safeUrl}" target="_blank" style="display:inline-block;min-height:50px;line-height:50px;padding:0 28px;background:${C.gold};color:${C.black} !important;text-decoration:none;font-weight:800;border-radius:8px;">${safeLabel}</a>
      </p>`;
}

/**
 * Pre-Shippo dark card shell + single Shippo CTA (no carrier buttons).
 */
export function renderGuestShippingRequestEmailHtml(
  input: GuestShippingRequestEmailLayoutInput
): string {
  const preheader = input.preheader
    ? `<div style="display:none;max-height:0;overflow:hidden;mso-hide:all;font-size:1px;line-height:1px;color:${C.black};opacity:0;">
        ${escapeHtml(input.preheader)}
      </div>`
    : "";

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta name="color-scheme" content="dark only" />
  <meta name="supported-color-schemes" content="dark only" />
  <title>${escapeHtml(input.heading)}</title>
  <style type="text/css">
    :root { color-scheme: dark only; }
    body { margin:0 !important; padding:0 !important; background-color:${C.black} !important; }
    a[x-apple-data-detectors] { color: ${C.textMuted} !important; text-decoration: none !important; }
  </style>
</head>
<body bgcolor="${C.black}" style="margin:0;padding:0;width:100%;${darkFill(C.black)}font-family:Arial,sans-serif;color:${C.text};">
${preheader}
<div style="${darkFill(C.black)}padding:24px 16px;">
  <div style="max-width:600px;margin:0 auto;${darkFill(C.surface)}border-radius:14px;overflow:hidden;border:1px solid ${C.gold};">
    <div style="${darkFill(C.surfacePanel)}text-align:center;padding:20px 22px 16px;border-bottom:2px solid ${C.gold};">
      <div style="font-size:13px;font-weight:700;letter-spacing:0.28em;line-height:1.25;text-transform:uppercase;">
        <div style="color:${C.text} !important;">ONE</div>
        <div style="color:${C.gold} !important;margin-top:2px;">EYRIE</div>
      </div>
      <div style="color:${C.textSubtle} !important;font-size:12px;margin-top:12px;letter-spacing:0.08em;text-transform:uppercase;">Lost &amp; Found Shipping Request</div>
    </div>

    <div style="padding:24px;${darkFill(C.surface)}">
      <h2 style="text-align:center;margin:0 0 16px;font-size:22px;color:${C.text} !important;font-weight:800;${darkFill(C.surface)}">
        ${escapeHtml(input.heading)}
      </h2>

      ${input.bodyHtml}

      ${renderCta(input.cta.label, input.cta.url)}
    </div>
  </div>
</div>
</body>
</html>`;
}
