import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getShippingProviderMode } from "@/app/lib/shipping/env";
import { getShippingProvider } from "@/app/lib/shipping/get-shipping-provider";
import type { ShippingAddress } from "@/app/lib/shipping/types";
import {
  hashShippingGuestToken,
  isTokenExpired,
} from "@/app/lib/lost-found-shipping/token";
import {
  appendShippingEvent,
  recordGuestOpenedIfNeeded,
  resolveGuestShippingRequestByToken,
  type ShippingRequestRow,
} from "@/app/lib/lost-found-shipping/shipping-requests";
import { SHIPPING_TIMELINE_EVENTS } from "@/app/lib/lost-found-shipping/timeline";
import { isStripeCheckoutEnvReady } from "@/app/lib/payments/stripe-env";

type RouteContext = { params: Promise<{ token: string }> };

function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

function eventContext(row: ShippingRequestRow) {
  return {
    organizationId: Number(row.organization_id),
    propertyId: Number(row.property_id),
    lostItemId: Number(row.lost_item_id),
    shippingRequestId: Number(row.id),
  };
}

export async function GET(_request: Request, context: RouteContext) {
  try {
    const { token } = await context.params;
    const supabase = getServiceClient();
    const view = await resolveGuestShippingRequestByToken(supabase, token);

    if (view.state !== "unavailable" && view.state !== "expired") {
      const tokenHash = hashShippingGuestToken(token.trim());
      const { data: row } = await supabase
        .from("lost_found_shipping_requests")
        .select("*")
        .eq("secure_token_hash", tokenHash)
        .maybeSingle();
      if (row) {
        await recordGuestOpenedIfNeeded(supabase, row as ShippingRequestRow);
      }
    }

    return NextResponse.json({
      request: view,
      shippingProvider: getShippingProviderMode(),
      checkoutAvailable: isStripeCheckoutEnvReady(),
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unable to load request";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * Guest shipping actions.
 * Checkpoint B/C: address validation + rates use ShippingProvider;
 * Checkout is created via /checkout (Stripe test mode).
 */
export async function POST(request: Request, context: RouteContext) {
  try {
    const { token } = await context.params;
    const body = (await request.json()) as Record<string, unknown>;
    const action = String(body.action || "validate_address");

    const supabase = getServiceClient();
    const tokenHash = hashShippingGuestToken(token.trim());
    const { data: row, error } = await supabase
      .from("lost_found_shipping_requests")
      .select("*")
      .eq("secure_token_hash", tokenHash)
      .maybeSingle();

    if (error || !row) {
      return NextResponse.json({ error: "Request unavailable" }, { status: 404 });
    }
    if (row.cancelled_at) {
      return NextResponse.json({ error: "Request unavailable" }, { status: 410 });
    }
    if (
      String(row.payment_status) === "pending" &&
      isTokenExpired(String(row.token_expires_at))
    ) {
      return NextResponse.json({ error: "Request expired" }, { status: 410 });
    }

    const provider = getShippingProvider();
    const ctx = eventContext(row as ShippingRequestRow);

    if (action === "validate_address") {
      const address: ShippingAddress = {
        name: String(body.name ?? "").trim(),
        line1: String(body.line1 ?? "").trim(),
        line2: String(body.line2 ?? "").trim() || undefined,
        city: String(body.city ?? "").trim(),
        state: String(body.state ?? "").trim(),
        postal: String(body.postal ?? "").trim(),
        country: String(body.country ?? "US").trim() || "US",
        phone: String(body.phone ?? "").trim() || undefined,
        email: String(body.email ?? row.guest_email ?? "").trim() || undefined,
      };

      await appendShippingEvent(supabase, {
        ...ctx,
        eventType: SHIPPING_TIMELINE_EVENTS.guestEnteredAddress,
        eventSource: "guest",
        eventData: {
          notes: "Guest submitted a shipping address",
          city: address.city,
          state: address.state,
          postal: address.postal,
          country: address.country,
        },
      });

      const validation = await provider.validateAddress(address);
      if (!validation.isValid) {
        await appendShippingEvent(supabase, {
          ...ctx,
          eventType: SHIPPING_TIMELINE_EVENTS.addressValidationFailed,
          eventSource: "system",
          eventData: {
            notes: validation.messages.join(" ") || "Address validation failed",
            provider: provider.id,
          },
        });
        return NextResponse.json({ validation, shippingProvider: provider.id });
      }

      const confirmed = validation.suggestedAddress || address;
      await supabase
        .from("lost_found_shipping_requests")
        .update({
          recipient_name: confirmed.name,
          recipient_phone: confirmed.phone || "",
          recipient_address_json: confirmed,
          shipment_status: "awaiting_payment",
          updated_at: new Date().toISOString(),
        })
        .eq("id", row.id)
        .eq("organization_id", Number(row.organization_id))
        .eq("property_id", Number(row.property_id));

      await appendShippingEvent(supabase, {
        ...ctx,
        eventType: SHIPPING_TIMELINE_EVENTS.addressValidated,
        eventSource: "system",
        eventData: {
          notes: validation.suggestedAddress
            ? "Address validated with suggested corrections"
            : "Address validated",
          provider: provider.id,
        },
      });

      return NextResponse.json({
        validation: { ...validation, suggestedAddress: confirmed },
        shippingProvider: provider.id,
      });
    }

    if (action === "get_rates") {
      const shipFrom = row.ship_from_address_json as ShippingAddress;
      const shipTo = row.recipient_address_json as ShippingAddress | null;
      if (!shipTo) {
        return NextResponse.json(
          { error: "Confirm a shipping address before requesting rates." },
          { status: 400 }
        );
      }

      const rates = await provider.getRates({
        shipFrom,
        shipTo,
        parcel: {
          lengthIn: Number(row.length_in),
          widthIn: Number(row.width_in),
          heightIn: Number(row.height_in),
          weightOz: Number(row.weight_oz),
        },
      });

      if (rates.length === 0) {
        return NextResponse.json(
          { error: "No shipping rates are available for this package and address." },
          { status: 422 }
        );
      }

      const rateExpiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString();
      await supabase
        .from("lost_found_shipping_requests")
        .update({
          rate_snapshot_json: rates,
          rate_expires_at: rateExpiresAt,
          shipping_provider: provider.id,
          updated_at: new Date().toISOString(),
        })
        .eq("id", row.id)
        .eq("organization_id", Number(row.organization_id))
        .eq("property_id", Number(row.property_id));

      await appendShippingEvent(supabase, {
        ...ctx,
        eventType: SHIPPING_TIMELINE_EVENTS.ratesRetrieved,
        eventSource: "system",
        eventData: {
          notes: `${rates.length} rate(s) retrieved`,
          provider: provider.id,
          rateCount: rates.length,
        },
      });

      return NextResponse.json({
        rates,
        rateExpiresAt,
        shippingProvider: provider.id,
      });
    }

    if (action === "select_rate") {
      const providerRateId = String(body.providerRateId || "").trim();
      const snapshot = Array.isArray(row.rate_snapshot_json)
        ? (row.rate_snapshot_json as Array<Record<string, unknown>>)
        : [];
      const selected = snapshot.find(
        (rate) => String(rate.providerRateId) === providerRateId
      );
      if (!selected) {
        return NextResponse.json({ error: "Selected rate is no longer valid." }, { status: 400 });
      }
      if (row.rate_expires_at && isTokenExpired(String(row.rate_expires_at))) {
        return NextResponse.json({ error: "Rates expired. Request rates again." }, { status: 400 });
      }

      const amount = Number(selected.amount);
      if (!Number.isFinite(amount) || amount <= 0) {
        return NextResponse.json({ error: "Invalid rate amount." }, { status: 400 });
      }

      await supabase
        .from("lost_found_shipping_requests")
        .update({
          provider_rate_id: providerRateId,
          selected_carrier: String(selected.carrier || ""),
          selected_service: String(selected.service || ""),
          quoted_shipping_amount: amount,
          // Guest pays carrier shipping only (fees_enabled defaults false; no fees charged).
          total_amount: amount,
          updated_at: new Date().toISOString(),
        })
        .eq("id", row.id)
        .eq("organization_id", Number(row.organization_id))
        .eq("property_id", Number(row.property_id));

      await appendShippingEvent(supabase, {
        ...ctx,
        eventType: SHIPPING_TIMELINE_EVENTS.rateSelected,
        eventSource: "guest",
        eventData: {
          notes: `${selected.carrier} ${selected.service} — $${amount.toFixed(2)}`,
          carrier: selected.carrier,
          service: selected.service,
          amount,
          currency: selected.currency || "usd",
        },
      });

      return NextResponse.json({
        ok: true,
        checkoutReady: true,
        amount,
        currency: String(selected.currency || "usd"),
        shippingProvider: provider.id,
        message:
          "Rate saved. Continue to Secure Checkout when you are ready. No payment has been collected yet.",
      });
    }

    if (action === "edit_address") {
      if (String(row.payment_status) === "paid") {
        return NextResponse.json(
          { error: "Address cannot be changed after payment." },
          { status: 400 }
        );
      }
      if (
        String(row.fulfillment_status) === "label_ready" ||
        String(row.shipment_status) === "label_ready" ||
        String(row.shipment_status) === "in_transit" ||
        String(row.shipment_status) === "delivered"
      ) {
        return NextResponse.json(
          { error: "Address cannot be changed at this stage." },
          { status: 400 }
        );
      }

      await supabase
        .from("lost_found_shipping_requests")
        .update({
          recipient_name: "",
          recipient_phone: "",
          recipient_address_json: null,
          provider_rate_id: null,
          selected_carrier: null,
          selected_service: null,
          rate_snapshot_json: null,
          rate_expires_at: null,
          quoted_shipping_amount: null,
          total_amount: null,
          shipment_status: "awaiting_guest",
          updated_at: new Date().toISOString(),
        })
        .eq("id", row.id)
        .eq("organization_id", Number(row.organization_id))
        .eq("property_id", Number(row.property_id));

      await appendShippingEvent(supabase, {
        ...ctx,
        eventType: SHIPPING_TIMELINE_EVENTS.guestEditingAddress,
        eventSource: "guest",
        eventData: {
          notes: "Guest returned to edit the shipping address",
        },
      });

      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Request failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
