import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { resolveAuthEmailConfig, resolveAppUrl } from "@/app/lib/email/auth-email-config";
import { sendBrandedEmailViaResend } from "@/app/lib/email/send-branded-email";
import { escapeHtml } from "@/app/lib/email/escape-html";
import {
  ONE_EYRIE_EMAIL as C,
  renderEmailDetailCard,
  renderEmailParagraph,
} from "@/app/lib/email/one-eyrie-email-shell";
import { renderTransactionalEmailHtml } from "@/app/lib/email/transactional-layout";
import { displayCarrierServiceLabel } from "@/app/lib/lost-found-shipping/carrier-display";
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
  const carrierLabel = displayCarrierServiceLabel(input.carrier, "");
  const serviceLabel = displayCarrierServiceLabel(input.service, "");
  const carrierServiceLine =
    carrierLabel && serviceLabel
      ? `Carrier: ${escapeHtml(carrierLabel)} · ${escapeHtml(serviceLabel)}`
      : carrierLabel
        ? `Carrier: ${escapeHtml(carrierLabel)}`
        : "";

  const heading = hasTracking
    ? "Payment confirmed — your item is on the way"
    : "Payment confirmed";
  const bodyHtml = `
    ${renderEmailParagraph(greeting, 12)}
    ${renderEmailParagraph(
      `We received your payment${amountLabel ? ` of <strong style="color:${C.primary};">${escapeHtml(amountLabel)}</strong>` : ""} for return shipping of <strong style="color:${C.primary};">${escapeHtml(input.itemName)}</strong> from <strong style="color:${C.primary};">${escapeHtml(input.propertyName)}</strong>.`,
      16
    )}
    ${
      hasTracking
        ? renderEmailDetailCard(
            "Tracking",
            `<span style="color:${C.primary};">${escapeHtml(String(input.trackingNumber))}</span>${
              carrierServiceLine
                ? `<div style="margin-top:8px;font-size:14px;font-weight:600;color:${C.secondary};">${carrierServiceLine}</div>`
                : ""
            }`
          )
        : renderEmailParagraph(
            "Payment received — preparing shipping label. Use your secure link anytime to check status and tracking.",
            22
          )
    }
  `;

  const trackingLink = String(input.guestTrackingUrl || "").trim();
  const html = renderTransactionalEmailHtml({
    kind: "guest-shipping",
    headerSubtitle: "LOST & FOUND",
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
    supportMessage: `Questions? Contact the front desk at ${escapeHtml(input.propertyName)}.`,
    showSupportEmail: false,
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
    ${renderEmailParagraph(
      `Stripe payment succeeded for <strong style="color:${C.primary};">${escapeHtml(input.itemName)}</strong> at <strong style="color:${C.primary};">${escapeHtml(input.propertyName)}</strong>, but Shippo label creation failed.`,
      16
    )}
    ${
      amountLabel
        ? renderEmailDetailCard(
            "Amount",
            `<span style="color:${C.primary};">${escapeHtml(amountLabel)}</span>`
          )
        : ""
    }
    ${renderEmailDetailCard(
      "Guest",
      `<span style="color:${C.primary};">${escapeHtml(input.guestEmail || "n/a")}</span>`
    )}
    ${renderEmailDetailCard(
      "Provider Error",
      `<span style="color:${C.primary};font-weight:600;">${escapeHtml(input.errorMessage.slice(0, 500))}</span>`
    )}
    ${renderEmailParagraph(
      `Open Lost &amp; Found and use <strong style="color:${C.primary};">Retry Label Creation</strong>. Do not charge the guest again.`,
      22
    )}
  `;
  const html = renderTransactionalEmailHtml({
    kind: "guest-shipping",
    headerSubtitle: "LOST & FOUND",
    heading: "Payment received — label creation failed",
    preheader: subject,
    bodyHtml,
    cta: { label: "Open Lost & Found", url: staffUrl },
    supportMessage:
      "One Eyrie will not re-charge the guest. Retry label purchase from the shipping summary.",
    referenceHtml: `<span style="color:${C.muted};">Ref: shipping request #${input.shippingRequestId} · lost item #${input.lostItemId}</span>`,
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
  const carrierLabel = displayCarrierServiceLabel(input.carrier, "");
  const serviceLabel = displayCarrierServiceLabel(input.service, "");
  const carrierServiceValue =
    carrierLabel && serviceLabel
      ? `${carrierLabel} · ${serviceLabel}`
      : carrierLabel || serviceLabel || "";

  const bodyHtml = `
    ${renderEmailParagraph(
      "A return shipping label is ready to print for the item below.",
      18
    )}
    ${renderEmailDetailCard(
      "Item",
      `<span style="color:${C.primary};">${escapeHtml(input.itemName)}</span>`
    )}
    ${renderEmailDetailCard(
      "Property",
      `<span style="color:${C.primary};">${escapeHtml(input.propertyName)}</span>`
    )}
    ${
      input.trackingNumber
        ? renderEmailDetailCard(
            "Tracking Number",
            `<span style="color:${C.primary};">${escapeHtml(String(input.trackingNumber))}</span>`
          )
        : ""
    }
    ${
      carrierServiceValue
        ? renderEmailDetailCard(
            "Carrier / Service",
            `<span style="color:${C.primary};">${escapeHtml(carrierServiceValue)}</span>`
          )
        : ""
    }
    ${renderEmailParagraph(
      labelUrl
        ? "Use the button below to open the secure printable label PDF, or open Lost &amp; Found and choose <strong style=\"color:" +
          C.primary +
          ';">Print Label</strong>.'
        : "Open Lost &amp; Found and use <strong style=\"color:" +
          C.primary +
          ';">Print Label</strong>.',
      22
    )}
  `;

  const belowCtaHtml = labelUrl
    ? `<span style="font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:1.55;color:${C.secondary};">This printable label link expires in 7 days.</span>`
    : undefined;

  const html = renderTransactionalEmailHtml({
    kind: "guest-shipping",
    headerSubtitle: "LOST & FOUND",
    heading: "Shipping Label Ready",
    preheader: subject,
    bodyHtml,
    cta: labelUrl
      ? { label: "Open Printable Label", url: labelUrl }
      : { label: "Open Lost & Found", url: staffUrl },
    belowCtaHtml,
    supportMessage:
      "This label is for hotel staff only. Do not forward the PDF to the guest.",
    referenceHtml: `<span style="color:${C.muted};">Ref: shipping request #${input.shippingRequestId} · lost item #${input.lostItemId}</span>`,
  });
  const text = [
    "Shipping Label Ready",
    "",
    `Item: ${input.itemName}`,
    `Property: ${input.propertyName}`,
    input.trackingNumber ? `Tracking: ${input.trackingNumber}` : null,
    carrierServiceValue ? `Carrier / Service: ${carrierServiceValue}` : null,
    "",
    labelUrl || staffUrl,
    labelUrl ? "This printable label link expires in 7 days." : null,
    "",
    "This label is for hotel staff only. Do not forward the PDF to the guest.",
    `Ref: shipping request #${input.shippingRequestId} · lost item #${input.lostItemId}`,
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
