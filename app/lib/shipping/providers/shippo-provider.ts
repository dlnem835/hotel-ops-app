import "server-only";

import type { Address, Rate, Transaction } from "shippo";
import type { ShippingProvider } from "@/app/lib/shipping/provider";
import { getShippoClient } from "@/app/lib/shipping/shippo-client";
import type {
  AddressValidationResult,
  PurchasedLabel,
  ShippingAddress,
  ShippingPackage,
  ShippingRate,
  TrackingResult,
  TrackingStatus,
} from "@/app/lib/shipping/types";

/**
 * Shippo test/live adapter. All Shippo field names stay inside this file.
 * Domain code must only see One Eyrie Shipping* types.
 */
export class ShippoShippingProvider implements ShippingProvider {
  readonly id = "shippo";

  async validateAddress(address: ShippingAddress): Promise<AddressValidationResult> {
    const client = getShippoClient();
    const created = await client.addresses.create({
      ...toShippoAddress(address),
      validate: true,
    });

    const validation = created.validationResults;
    const isValid = validation?.isValid !== false;
    const messages = (validation?.messages || [])
      .map((message) => String(message.text || message.source || "").trim())
      .filter(Boolean);

    if (!isValid) {
      return {
        isValid: false,
        messages: messages.length > 0 ? messages : ["Address could not be validated."],
        suggestedAddress: null,
      };
    }

    const suggested = fromShippoAddress(created, address);
    const changed = !addressesEqual(address, suggested);

    return {
      isValid: true,
      messages: changed
        ? messages.length > 0
          ? messages
          : ["Suggested address corrections are available."]
        : messages,
      suggestedAddress: changed ? suggested : null,
    };
  }

  async getRates(input: {
    shipFrom: ShippingAddress;
    shipTo: ShippingAddress;
    parcel: ShippingPackage;
  }): Promise<ShippingRate[]> {
    const client = getShippoClient();
    const shipment = await client.shipments.create({
      addressFrom: toShippoAddress(input.shipFrom),
      addressTo: toShippoAddress(input.shipTo),
      parcels: [toShippoParcel(input.parcel)],
      async: false,
    });

    const rates = shipment.rates || [];
    return rates
      .map((rate) => mapShippoRate(rate))
      .filter((rate): rate is ShippingRate => rate != null)
      .sort((a, b) => a.amount - b.amount);
  }

  async purchaseLabel(input: {
    shipFrom: ShippingAddress;
    shipTo: ShippingAddress;
    parcel: ShippingPackage;
    providerRateId: string;
    idempotencyKey: string;
  }): Promise<PurchasedLabel> {
    const client = getShippoClient();
    const transaction = await client.transactions.create({
      rate: input.providerRateId,
      async: false,
      labelFileType: "PDF",
      metadata: input.idempotencyKey.slice(0, 100),
    });

    if (String(transaction.status || "").toUpperCase() !== "SUCCESS") {
      const detail = (transaction.messages || [])
        .map((message) => String(message.text || "").trim())
        .filter(Boolean)
        .join("; ");
      throw new Error(
        detail || `Shippo label purchase failed (status=${transaction.status || "unknown"}).`
      );
    }

    return mapPurchasedLabel(transaction);
  }

  async voidLabel(providerTransactionId: string): Promise<void> {
    const client = getShippoClient();
    await client.refunds.create({
      transaction: providerTransactionId,
      async: false,
    });
  }

  async getTrackingStatus(input: {
    trackingNumber: string;
    carrier?: string | null;
  }): Promise<TrackingResult> {
    const carrier = normalizeCarrierSlug(input.carrier);
    if (!carrier) {
      throw new Error("Carrier is required to retrieve Shippo tracking status.");
    }

    const client = getShippoClient();
    const track = await client.trackingStatus.get(input.trackingNumber, carrier);
    const raw = track.trackingStatus?.status || "UNKNOWN";

    return {
      status: mapTrackingStatus(String(raw)),
      trackingNumber: track.trackingNumber || input.trackingNumber,
      trackingUrl: null,
      rawStatus: String(raw),
    };
  }
}

function toShippoAddress(address: ShippingAddress) {
  return {
    name: address.name.trim(),
    street1: address.line1.trim(),
    street2: address.line2?.trim() || undefined,
    city: address.city.trim(),
    state: address.state.trim(),
    zip: address.postal.trim(),
    country: (address.country || "US").trim().toUpperCase(),
    phone: address.phone?.trim() || undefined,
    email: address.email?.trim() || undefined,
  };
}

function fromShippoAddress(
  address: Address,
  fallback: ShippingAddress
): ShippingAddress {
  return {
    name: String(address.name || fallback.name || "").trim(),
    line1: String(address.street1 || fallback.line1 || "").trim(),
    line2: address.street2 ? String(address.street2).trim() : fallback.line2,
    city: String(address.city || fallback.city || "").trim(),
    state: String(address.state || fallback.state || "").trim(),
    postal: String(address.zip || fallback.postal || "").trim(),
    country: String(address.country || fallback.country || "US")
      .trim()
      .toUpperCase(),
    phone: address.phone ? String(address.phone).trim() : fallback.phone,
    email: address.email ? String(address.email).trim() : fallback.email,
  };
}

function toShippoParcel(parcel: ShippingPackage) {
  return {
    length: String(parcel.lengthIn),
    width: String(parcel.widthIn),
    height: String(parcel.heightIn),
    distanceUnit: "in" as const,
    weight: String(parcel.weightOz),
    massUnit: "oz" as const,
  };
}

function mapShippoRate(rate: Rate): ShippingRate | null {
  const amount = Number(rate.amount);
  if (!rate.objectId || !Number.isFinite(amount)) return null;

  const days = rate.estimatedDays;
  const serviceName =
    rate.servicelevel?.name || rate.servicelevel?.token || "Service";

  return {
    providerRateId: rate.objectId,
    carrier: String(rate.provider || "Carrier"),
    service: String(serviceName),
    amount: Math.round(amount * 100) / 100,
    currency: String(rate.currency || "USD").toLowerCase(),
    estimatedDaysMin: typeof days === "number" ? days : null,
    estimatedDaysMax: typeof days === "number" ? days : null,
    estimatedDeliveryLabel:
      typeof days === "number"
        ? `${days} business day${days === 1 ? "" : "s"}`
        : rate.durationTerms || null,
  };
}

function mapPurchasedLabel(transaction: Transaction): PurchasedLabel {
  const objectId = String(transaction.objectId || "").trim();
  const trackingNumber = String(transaction.trackingNumber || "").trim();
  if (!objectId || !trackingNumber) {
    throw new Error("Shippo transaction missing object id or tracking number.");
  }

  let carrier = "Carrier";
  let service = "Service";
  if (transaction.rate && typeof transaction.rate === "object") {
    const rate = transaction.rate as {
      provider?: string;
      servicelevel?: { name?: string; token?: string };
    };
    carrier = String(rate.provider || carrier);
    service = String(rate.servicelevel?.name || rate.servicelevel?.token || service);
  }

  return {
    providerTransactionId: objectId,
    trackingNumber,
    trackingUrl: transaction.trackingUrlProvider
      ? String(transaction.trackingUrlProvider)
      : null,
    labelPdfBase64: null,
    labelUrl: transaction.labelUrl ? String(transaction.labelUrl) : null,
    carrier,
    service,
  };
}

function mapTrackingStatus(raw: string): TrackingStatus {
  switch (raw.toUpperCase()) {
    case "PRE_TRANSIT":
      return "pre_transit";
    case "TRANSIT":
      return "in_transit";
    case "DELIVERED":
      return "delivered";
    case "RETURNED":
      return "returned";
    case "FAILURE":
      return "exception";
    default:
      return "unknown";
  }
}

function normalizeCarrierSlug(carrier: string | null | undefined): string | null {
  if (!carrier) return null;
  const value = carrier.trim().toLowerCase();
  if (!value) return null;
  if (value.includes("usps") || value.includes("united states postal")) return "usps";
  if (value.includes("ups")) return "ups";
  if (value.includes("fedex")) return "fedex";
  if (value.includes("dhl")) return "dhl_express";
  return value.replace(/\s+/g, "_");
}

function addressesEqual(a: ShippingAddress, b: ShippingAddress): boolean {
  return (
    a.name.trim().toLowerCase() === b.name.trim().toLowerCase() &&
    a.line1.trim().toLowerCase() === b.line1.trim().toLowerCase() &&
    (a.line2 || "").trim().toLowerCase() === (b.line2 || "").trim().toLowerCase() &&
    a.city.trim().toLowerCase() === b.city.trim().toLowerCase() &&
    a.state.trim().toLowerCase() === b.state.trim().toLowerCase() &&
    a.postal.trim() === b.postal.trim() &&
    a.country.trim().toUpperCase() === b.country.trim().toUpperCase()
  );
}
