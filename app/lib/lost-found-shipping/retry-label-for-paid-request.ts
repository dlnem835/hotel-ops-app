import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { getShippingProvider } from "@/app/lib/shipping/get-shipping-provider";
import { getShippingProviderMode } from "@/app/lib/shipping/env";
import type { ShippingAddress, ShippingPackage, ShippingRate } from "@/app/lib/shipping/types";
import {
  appendShippingEvent,
  parseShipFromJson,
  type ShippingRequestRow,
} from "@/app/lib/lost-found-shipping/shipping-requests";
import { purchaseLabelForPaidShippingRequest } from "@/app/lib/lost-found-shipping/purchase-label-for-request";
import { displayCarrierServiceLabel } from "@/app/lib/lost-found-shipping/carrier-display";
import { SHIPPING_TIMELINE_EVENTS } from "@/app/lib/lost-found-shipping/timeline";
import { assertShippingProviderEnvReady } from "@/app/lib/shipping/env";

function asPackage(row: ShippingRequestRow): ShippingPackage | null {
  const lengthIn = Number(row.length_in);
  const widthIn = Number(row.width_in);
  const heightIn = Number(row.height_in);
  const weightOz = Number(row.weight_oz);
  if (
    ![lengthIn, widthIn, heightIn, weightOz].every(
      (n) => Number.isFinite(n) && n > 0
    )
  ) {
    return null;
  }
  return { lengthIn, widthIn, heightIn, weightOz };
}

function normalize(value: string | null | undefined): string {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ");
}

function pickMatchingRate(
  rates: ShippingRate[],
  row: ShippingRequestRow
): ShippingRate | null {
  if (rates.length === 0) return null;
  const carrier = normalize(
    row.selected_carrier != null ? String(row.selected_carrier) : null
  );
  const service = normalize(
    row.selected_service != null ? String(row.selected_service) : null
  );
  const targetAmount = Number(row.total_amount ?? row.quoted_shipping_amount);

  const byCarrierService = rates.find(
    (rate) =>
      normalize(rate.carrier) === carrier &&
      (normalize(rate.service) === service ||
        normalize(rate.service).includes(service) ||
        service.includes(normalize(rate.service)))
  );
  if (byCarrierService) return byCarrierService;

  if (Number.isFinite(targetAmount) && targetAmount > 0) {
    const sorted = [...rates].sort(
      (a, b) =>
        Math.abs(a.amount - targetAmount) - Math.abs(b.amount - targetAmount)
    );
    return sorted[0] || null;
  }

  return rates[0] || null;
}

/**
 * Staff/system retry after payment succeeded but label purchase failed.
 * Never charges the guest again. Re-quotes when the stored rate is mock/stale,
 * then purchases exactly once via the existing idempotent purchase helper.
 * Tenant-scoped by organization_id + property_id on the request row.
 */
export async function retryLabelForPaidShippingRequest(
  supabase: SupabaseClient,
  shippingRequestId: number,
  options?: { actor?: "staff" | "system" }
): Promise<{
  ok: boolean;
  skipped: boolean;
  message: string;
  trackingNumber: string | null;
  providerRateId: string | null;
}> {
  const { data, error } = await supabase
    .from("lost_found_shipping_requests")
    .select("*")
    .eq("id", shippingRequestId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) {
    return {
      ok: false,
      skipped: true,
      message: "Shipping request not found",
      trackingNumber: null,
      providerRateId: null,
    };
  }

  const row = data as ShippingRequestRow;
  const organizationId = Number(row.organization_id);
  const propertyId = Number(row.property_id);
  const lostItemId = Number(row.lost_item_id);

  if (String(row.payment_status) !== "paid") {
    return {
      ok: false,
      skipped: true,
      message: "Payment is not paid — cannot purchase a label",
      trackingNumber: null,
      providerRateId: row.provider_rate_id
        ? String(row.provider_rate_id)
        : null,
    };
  }

  if (
    String(row.fulfillment_status) === "label_ready" &&
    row.tracking_number
  ) {
    return {
      ok: true,
      skipped: true,
      message: "Label already purchased",
      trackingNumber: String(row.tracking_number),
      providerRateId: row.provider_rate_id
        ? String(row.provider_rate_id)
        : null,
    };
  }

  if (getShippingProviderMode() !== "shippo") {
    return {
      ok: false,
      skipped: false,
      message:
        "SHIPPING_PROVIDER must be shippo to purchase a real shipping label.",
      trackingNumber: null,
      providerRateId: row.provider_rate_id
        ? String(row.provider_rate_id)
        : null,
    };
  }

  assertShippingProviderEnvReady("shippo");

  let providerRateId = String(row.provider_rate_id || "").trim();
  const needsRequote =
    !providerRateId ||
    providerRateId.startsWith("mock_") ||
    String(row.fulfillment_status) === "needs_manual_review";

  if (needsRequote) {
    const shipFrom = parseShipFromJson(row.ship_from_address_json);
    const shipTo = parseShipFromJson(row.recipient_address_json);
    const parcel = asPackage(row);
    if (!shipFrom?.line1 || !shipTo?.line1 || !parcel) {
      return {
        ok: false,
        skipped: false,
        message: "Incomplete ship-from, destination, or package for re-quote",
        trackingNumber: null,
        providerRateId: providerRateId || null,
      };
    }

    const provider = getShippingProvider();
    const rates = await provider.getRates({
      shipFrom: shipFrom as ShippingAddress,
      shipTo: shipTo as ShippingAddress,
      parcel,
    });
    const selected = pickMatchingRate(rates, row);
    if (!selected) {
      return {
        ok: false,
        skipped: false,
        message: "No Shippo rates available for retry",
        trackingNumber: null,
        providerRateId: providerRateId || null,
      };
    }

    providerRateId = selected.providerRateId;
    const rateExpiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString();

    await supabase
      .from("lost_found_shipping_requests")
      .update({
        provider_rate_id: selected.providerRateId,
        selected_carrier: selected.carrier,
        selected_service: selected.service,
        quoted_shipping_amount: selected.amount,
        total_amount: selected.amount,
        currency: selected.currency || "usd",
        rate_snapshot_json: rates,
        rate_expires_at: rateExpiresAt,
        // Keep payment state; clear prior label failure so purchase can proceed.
        fulfillment_status: "pending",
        error_message: null,
        label_purchase_lock_at: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", shippingRequestId)
      .eq("organization_id", organizationId)
      .eq("property_id", propertyId)
      .eq("payment_status", "paid");

    await appendShippingEvent(supabase, {
      organizationId,
      propertyId,
      lostItemId,
      shippingRequestId,
      eventType: SHIPPING_TIMELINE_EVENTS.ratesRetrieved,
      eventSource: options?.actor === "staff" ? "staff" : "system",
      eventData: {
        notes: `Label retry re-quoted ${rates.length} Shippo rate(s); selected ${selected.carrier} ${selected.service}`,
        providerRateId: selected.providerRateId,
        amount: selected.amount,
      },
    });
  }

  const purchased = await purchaseLabelForPaidShippingRequest(
    supabase,
    shippingRequestId
  );

  if (purchased.ok && !purchased.skipped && purchased.trackingNumber) {
    try {
      const {
        sendGuestPaymentConfirmationEmail,
        sendHotelLabelReadyEmail,
      } = await import("@/app/lib/lost-found-shipping/notify-shipping-fulfillment");
      const { data: fresh } = await supabase
        .from("lost_found_shipping_requests")
        .select(
          "guest_email,guest_name,item_description_public,tracking_number,tracking_url,selected_carrier,selected_service,total_amount,currency,label_storage_path"
        )
        .eq("id", shippingRequestId)
        .eq("organization_id", organizationId)
        .eq("property_id", propertyId)
        .maybeSingle();
      const { data: property } = await supabase
        .from("properties")
        .select("name")
        .eq("id", propertyId)
        .eq("organization_id", organizationId)
        .maybeSingle();
      const propertyName = property?.name
        ? String(property.name)
        : "the hotel";
      const itemName =
        String(fresh?.item_description_public || "").trim() || "your item";
      if (fresh?.guest_email) {
        const { getStoredGuestShippingUrl } = await import(
          "@/app/lib/lost-found-shipping/shipping-requests"
        );
        const guestTrackingUrl = await getStoredGuestShippingUrl(
          supabase,
          shippingRequestId
        );
        await sendGuestPaymentConfirmationEmail({
          guestEmail: String(fresh.guest_email),
          guestName: fresh.guest_name ? String(fresh.guest_name) : null,
          propertyName,
          itemName,
          amount: Number(fresh.total_amount),
          currency: String(fresh.currency || "usd"),
          guestTrackingUrl,
          trackingNumber: fresh.tracking_number
            ? String(fresh.tracking_number)
            : purchased.trackingNumber,
          carrier: displayCarrierServiceLabel(
            fresh.selected_carrier != null
              ? String(fresh.selected_carrier)
              : null,
            ""
          ) || null,
          service: displayCarrierServiceLabel(
            fresh.selected_service != null
              ? String(fresh.selected_service)
              : null,
            ""
          ) || null,
        });
      }
      if (fresh?.label_storage_path) {
        await sendHotelLabelReadyEmail({
          supabase,
          organizationId,
          propertyId,
          lostItemId,
          shippingRequestId,
          propertyName,
          itemName,
          trackingNumber: purchased.trackingNumber,
          carrier: displayCarrierServiceLabel(
            fresh.selected_carrier != null
              ? String(fresh.selected_carrier)
              : null,
            ""
          ) || null,
          service: displayCarrierServiceLabel(
            fresh.selected_service != null
              ? String(fresh.selected_service)
              : null,
            ""
          ) || null,
          labelStoragePath: String(fresh.label_storage_path),
        });
      }
    } catch (emailError) {
      console.error(
        "[retry-label] confirmation email failed",
        emailError instanceof Error ? emailError.message : "unknown"
      );
    }
  } else if (!purchased.ok && !purchased.skipped) {
    try {
      const { alertLabelCreationFailed } = await import(
        "@/app/lib/lost-found-shipping/notify-shipping-fulfillment"
      );
      const { data: fresh } = await supabase
        .from("lost_found_shipping_requests")
        .select("guest_email,item_description_public,total_amount,error_message")
        .eq("id", shippingRequestId)
        .maybeSingle();
      const { data: property } = await supabase
        .from("properties")
        .select("name")
        .eq("id", propertyId)
        .eq("organization_id", organizationId)
        .maybeSingle();
      await alertLabelCreationFailed({
        supabase,
        organizationId,
        propertyId,
        lostItemId,
        shippingRequestId,
        propertyName: property?.name ? String(property.name) : "Property",
        itemName:
          String(fresh?.item_description_public || "").trim() || "Item",
        guestEmail: fresh?.guest_email ? String(fresh.guest_email) : null,
        errorMessage: String(
          fresh?.error_message || purchased.message || "Label purchase failed"
        ),
        amount: Number(fresh?.total_amount),
      });
    } catch {
      // non-fatal
    }
  }

  return {
    ok: purchased.ok,
    skipped: purchased.skipped,
    message: purchased.message,
    trackingNumber: purchased.trackingNumber,
    providerRateId,
  };
}
