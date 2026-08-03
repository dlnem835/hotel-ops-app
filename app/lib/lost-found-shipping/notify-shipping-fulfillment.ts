import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { resolveAuthEmailConfig, resolveAppUrl } from "@/app/lib/email/auth-email-config";
import { sendBrandedEmailViaResend } from "@/app/lib/email/send-branded-email";
import { escapeHtml } from "@/app/lib/email/escape-html";
import { EMAIL_THEME as T } from "@/app/lib/email/brand";
import { renderTransactionalEmailHtml } from "@/app/lib/email/transactional-layout";
import { fetchPropertyShippingSettings } from "@/app/lib/lost-found-shipping/property-shipping-settings";
import { appendShippingEvent } from "@/app/lib/lost-found-shipping/shipping-requests";
import { SHIPPING_TIMELINE_EVENTS } from "@/app/lib/lost-found-shipping/timeline";

function money(amount: number | null | undefined, currency = "usd"): string {
  if (amount == null || !Number.isFinite(Number(amount))) return "";
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: (currency || "usd").toUpperCase(),
    }).format(Number(amount));
  } catch {
    return `$${Number(amount).toFixed(2)}`;
  }
}

/**
 * Guest payment confirmation (and optional tracking). Tenant-agnostic.
 * Never attaches the hotel label PDF — labels stay in One Eyrie for staff.
 */
export async function sendGuestPaymentConfirmationEmail(input: {
  guestEmail: string;
  guestName?: string | null;
  propertyName: string;
  itemName: string;
  amount: number | null;
  currency?: string;
  guestTrackingUrl?: string | null;
  trackingNumber?: string | null;
  carrier?: string | null;
  service?: string | null;
}): Promise<{ ok: boolean; message?: string }> {
  const email = String(input.guestEmail || "").trim().toLowerCase();
  if (!email || !email.includes("@")) {
    return { ok: false, message: "Missing guest email" };
  }

  const configResult = resolveAuthEmailConfig();
  if (!configResult.ok) {
    return {
      ok: false,
      message: `Email not configured: ${configResult.missing.join(", ")}`,
    };
  }

  const hasTracking = Boolean(input.trackingNumber);
  const amountLabel = money(input.amount, input.currency);
  const greeting = input.guestName?.trim()
    ? `Hello ${escapeHtml(input.guestName.trim())},`
    : "Hello,";

  const heading = hasTracking
    ? "Payment confirmed — your item is on the way"
    : "Payment confirmed";
  const bodyHtml = `
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" bgcolor="${T.card}" style="width:100%;background-color:${T.card};">
      <tr><td bgcolor="${T.card}" style="padding:0 0 16px;background-color:${T.card};color:${T.textMuted} !important;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.7;">${greeting}</td></tr>
      <tr><td bgcolor="${T.card}" style="padding:0 0 16px;background-color:${T.card};color:${T.textMuted} !important;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.7;">
        We received your payment${amountLabel ? ` of <strong style="color:${T.text} !important;">${escapeHtml(amountLabel)}</strong>` : ""} for return shipping of <strong style="color:${T.text} !important;">${escapeHtml(input.itemName)}</strong> from <strong style="color:${T.text} !important;">${escapeHtml(input.propertyName)}</strong>.
      </td></tr>
      ${
        hasTracking
          ? `<tr><td bgcolor="${T.card}" style="padding:0 0 16px;background-color:${T.card};color:${T.textMuted} !important;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.7;">
              Tracking number: <strong style="color:${T.text} !important;">${escapeHtml(String(input.trackingNumber))}</strong>
              ${input.carrier ? `<br/>Carrier: ${escapeHtml(String(input.carrier))}${input.service ? ` · ${escapeHtml(String(input.service))}` : ""}` : ""}
            </td></tr>`
          : `<tr><td bgcolor="${T.card}" style="padding:0 0 16px;background-color:${T.card};color:${T.textMuted} !important;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.6;">
              Payment received — preparing shipping label. Use your secure link anytime to check status and tracking.
            </td></tr>`
      }
    </table>
  `;

  const trackingLink = String(input.guestTrackingUrl || "").trim();
  const html = renderTransactionalEmailHtml({
    kind: "guest-shipping",
    headerVariant: "text",
    heading,
    preheader: hasTracking
      ? `Tracking ${input.trackingNumber}`
      : "Your return shipping payment was received.",
    bodyHtml,
    cta: trackingLink
      ? {
          label: hasTracking ? "View Shipment Tracking" : "View shipping status",
          url: trackingLink,
        }
      : undefined,
    supportMessage: `Questions? Contact the front desk at ${input.propertyName}.`,
  });

  const text = [
    input.guestName?.trim() ? `Hello ${input.guestName.trim()},` : "Hello,",
    "",
    `We received your payment${amountLabel ? ` of ${amountLabel}` : ""} for return shipping of ${input.itemName} from ${input.propertyName}.`,
    hasTracking
      ? `Tracking number: ${input.trackingNumber}`
      : "Payment received — preparing shipping label. Check status with the secure link from your original shipping email.",
    trackingLink ? `\n${trackingLink}` : "",
    "",
    "One Eyrie — Hotel Operations Platform",
  ].join("\n");

  const sent = await sendBrandedEmailViaResend({
    to: email,
    subject: hasTracking
      ? `${input.propertyName}: payment confirmed — tracking available`
      : `${input.propertyName}: payment confirmed for return shipping`,
    html,
    text,
    config: configResult.config,
  });

  return sent.ok
    ? { ok: true }
    : { ok: false, message: sent.errorMessage };
}

/**
 * Alert property return email + platform support when payment succeeded but label failed.
 */
export async function alertLabelCreationFailed(input: {
  supabase: SupabaseClient;
  organizationId: number;
  propertyId: number;
  lostItemId: number;
  shippingRequestId: number;
  propertyName: string;
  itemName: string;
  guestEmail?: string | null;
  errorMessage: string;
  amount?: number | null;
}): Promise<void> {
  const configResult = resolveAuthEmailConfig();
  if (!configResult.ok) {
    console.error("[shipping-alert] email config missing", configResult.missing);
    return;
  }

  let propertyEmail = "";
  try {
    const settings = await fetchPropertyShippingSettings(input.supabase, {
      organizationId: input.organizationId,
      propertyId: input.propertyId,
    });
    propertyEmail = String(settings.propertyEmail || "").trim();
  } catch {
    propertyEmail = "";
  }

  const recipients = Array.from(
    new Set(
      [propertyEmail, configResult.config.supportEmail]
        .map((value) => value.trim().toLowerCase())
        .filter((value) => value.includes("@"))
    )
  );

  if (recipients.length === 0) return;

  const amountLabel = money(input.amount);
  const staffUrl = `${resolveAppUrl()}/lost-and-found`;
  const subject = `Payment received — label creation failed (${input.propertyName})`;
  const bodyHtml = `
    <p style="margin:0 0 16px;color:${T.textMuted};">
      Stripe payment succeeded for <strong style="color:${T.text};">${escapeHtml(input.itemName)}</strong>
      at <strong style="color:${T.text};">${escapeHtml(input.propertyName)}</strong>,
      but Shippo label creation failed.
    </p>
    <p style="margin:0 0 16px;color:${T.textMuted};">
      ${amountLabel ? `Amount: <strong style="color:${T.text};">${escapeHtml(amountLabel)}</strong><br/>` : ""}
      Shipping request #${input.shippingRequestId}<br/>
      Lost item #${input.lostItemId}<br/>
      Guest: ${escapeHtml(input.guestEmail || "n/a")}
    </p>
    <p style="margin:0 0 16px;color:${T.textMuted};">
      Provider error:<br/>
      <strong style="color:${T.text};">${escapeHtml(input.errorMessage.slice(0, 500))}</strong>
    </p>
    <p style="margin:0;color:${T.textMuted};">
      Open Lost &amp; Found and use <strong style="color:${T.text};">Retry Label Creation</strong>.
      Do not charge the guest again.
    </p>
  `;
  const html = renderTransactionalEmailHtml({
    kind: "guest-shipping",
    heading: "Payment received — label creation failed",
    preheader: subject,
    bodyHtml,
    cta: { label: "Open Lost & Found", url: staffUrl },
    supportMessage:
      "One Eyrie will not re-charge the guest. Retry label purchase from the shipping summary.",
  });
  const text = [
    subject,
    "",
    `Property: ${input.propertyName}`,
    `Item: ${input.itemName}`,
    `Shipping request: #${input.shippingRequestId}`,
    `Lost item: #${input.lostItemId}`,
    `Guest: ${input.guestEmail || "n/a"}`,
    amountLabel ? `Amount: ${amountLabel}` : null,
    "",
    `Error: ${input.errorMessage}`,
    "",
    "Use Retry Label Creation in Lost & Found. Do not charge the guest again.",
    staffUrl,
  ]
    .filter(Boolean)
    .join("\n");

  for (const to of recipients) {
    const sent = await sendBrandedEmailViaResend({
      to,
      subject,
      html,
      text,
      config: configResult.config,
    });
    if (!sent.ok) {
      console.error("[shipping-alert] failed", {
        toDomain: to.split("@")[1] || null,
        message: sent.errorMessage,
      });
    }
  }

  await appendShippingEvent(input.supabase, {
    organizationId: input.organizationId,
    propertyId: input.propertyId,
    lostItemId: input.lostItemId,
    shippingRequestId: input.shippingRequestId,
    eventType: SHIPPING_TIMELINE_EVENTS.manualReview,
    eventSource: "system",
    eventData: {
      notes: `Staff/support alerted: payment received — label creation failed. ${input.errorMessage.slice(0, 240)}`,
      alerted: recipients.map((to) => to.split("@")[1] || "unknown"),
    },
  }).catch(() => undefined);
}

/**
 * Notify the hotel return email that a printable label is ready in One Eyrie.
 * Includes a time-limited signed PDF URL when storage upload succeeded.
 */
export async function sendHotelLabelReadyEmail(input: {
  supabase: SupabaseClient;
  organizationId: number;
  propertyId: number;
  lostItemId: number;
  shippingRequestId: number;
  propertyName: string;
  itemName: string;
  trackingNumber?: string | null;
  carrier?: string | null;
  service?: string | null;
  labelStoragePath: string;
}): Promise<{ ok: boolean; message?: string }> {
  const configResult = resolveAuthEmailConfig();
  if (!configResult.ok) {
    return {
      ok: false,
      message: `Email not configured: ${configResult.missing.join(", ")}`,
    };
  }

  let propertyEmail = "";
  try {
    const settings = await fetchPropertyShippingSettings(input.supabase, {
      organizationId: input.organizationId,
      propertyId: input.propertyId,
    });
    propertyEmail = String(settings.propertyEmail || "").trim();
  } catch {
    propertyEmail = "";
  }

  const recipients = Array.from(
    new Set(
      [propertyEmail, configResult.config.supportEmail]
        .map((value) => value.trim().toLowerCase())
        .filter((value) => value.includes("@"))
    )
  );
  if (recipients.length === 0) {
    return { ok: false, message: "No hotel/support email recipients" };
  }

  let labelUrl: string | null = null;
  try {
    const { data: signed, error: signError } = await input.supabase.storage
      .from("lost-found-shipping-labels")
      .createSignedUrl(input.labelStoragePath, 60 * 60 * 24 * 7);
    if (!signError && signed?.signedUrl) {
      labelUrl = String(signed.signedUrl);
    }
  } catch {
    labelUrl = null;
  }

  const staffUrl = `${resolveAppUrl()}/lost-and-found`;
  const subject = `Shipping label ready to print (${input.propertyName})`;
  const bodyHtml = `
    <p style="margin:0 0 16px;color:${T.textMuted};">
      A return shipping label is ready for <strong style="color:${T.text};">${escapeHtml(input.itemName)}</strong>
      at <strong style="color:${T.text};">${escapeHtml(input.propertyName)}</strong>.
    </p>
    <p style="margin:0 0 16px;color:${T.textMuted};">
      ${input.trackingNumber ? `Tracking: <strong style="color:${T.text};">${escapeHtml(String(input.trackingNumber))}</strong><br/>` : ""}
      ${input.carrier ? `Carrier: ${escapeHtml(String(input.carrier))}${input.service ? ` · ${escapeHtml(String(input.service))}` : ""}<br/>` : ""}
      Shipping request #${input.shippingRequestId} · Lost item #${input.lostItemId}
    </p>
    <p style="margin:0;color:${T.textMuted};">
      Open Lost &amp; Found and use <strong style="color:${T.text};">Print Label</strong>,
      or open the secure PDF link below (expires in 7 days).
    </p>
  `;
  const html = renderTransactionalEmailHtml({
    kind: "guest-shipping",
    heading: "Printable shipping label ready",
    preheader: subject,
    bodyHtml,
    cta: labelUrl
      ? { label: "Open printable label PDF", url: labelUrl }
      : { label: "Open Lost & Found", url: staffUrl },
    supportMessage:
      "This label is for hotel staff only. Do not forward the PDF to the guest.",
  });
  const text = [
    subject,
    "",
    `Item: ${input.itemName}`,
    `Property: ${input.propertyName}`,
    input.trackingNumber ? `Tracking: ${input.trackingNumber}` : null,
    input.carrier
      ? `Carrier: ${input.carrier}${input.service ? ` · ${input.service}` : ""}`
      : null,
    `Shipping request #${input.shippingRequestId}`,
    `Lost item #${input.lostItemId}`,
    "",
    labelUrl || staffUrl,
    "",
    "Use Print Label in One Eyrie Lost & Found. Do not send the PDF to the guest.",
  ]
    .filter(Boolean)
    .join("\n");

  let anyOk = false;
  let lastError: string | undefined;
  for (const to of recipients) {
    const sent = await sendBrandedEmailViaResend({
      to,
      subject,
      html,
      text,
      config: configResult.config,
    });
    if (sent.ok) anyOk = true;
    else lastError = sent.errorMessage;
  }

  if (anyOk) {
    return { ok: true };
  }

  return { ok: false, message: lastError || "Failed to send hotel label email" };
}
