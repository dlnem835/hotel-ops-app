import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getShippingProvider } from "@/app/lib/shipping/get-shipping-provider";
import type { ShippingAddress } from "@/app/lib/shipping/types";
import {
  hashShippingGuestToken,
  isTokenExpired,
} from "@/app/lib/lost-found-shipping/token";
import { resolveGuestShippingRequestByToken } from "@/app/lib/lost-found-shipping/shipping-requests";

type RouteContext = { params: Promise<{ token: string }> };

function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function GET(_request: Request, context: RouteContext) {
  try {
    const { token } = await context.params;
    const supabase = getServiceClient();
    const view = await resolveGuestShippingRequestByToken(supabase, token);
    return NextResponse.json({ request: view });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unable to load request";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/** Phase 1: mock address validation for the guest page. */
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

      const validation = await provider.validateAddress(address);
      if (!validation.isValid) {
        return NextResponse.json({ validation });
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
        .eq("id", row.id);

      return NextResponse.json({ validation: { ...validation, suggestedAddress: confirmed } });
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

      const rateExpiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString();
      await supabase
        .from("lost_found_shipping_requests")
        .update({
          rate_snapshot_json: rates,
          rate_expires_at: rateExpiresAt,
          updated_at: new Date().toISOString(),
        })
        .eq("id", row.id);

      return NextResponse.json({ rates, rateExpiresAt });
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
      await supabase
        .from("lost_found_shipping_requests")
        .update({
          provider_rate_id: providerRateId,
          selected_carrier: String(selected.carrier || ""),
          selected_service: String(selected.service || ""),
          quoted_shipping_amount: amount,
          total_amount: amount,
          updated_at: new Date().toISOString(),
        })
        .eq("id", row.id);

      // Phase 1: mock checkout acknowledgement only (no Stripe).
      return NextResponse.json({
        ok: true,
        mockCheckout: true,
        amount,
        currency: String(selected.currency || "usd"),
        message:
          "Phase 1 mock: Stripe Checkout will be connected in Phase 2. Rate selection saved.",
      });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Request failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
