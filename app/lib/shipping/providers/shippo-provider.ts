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
    const localIssues = localAddressIssues(address);
    if (localIssues.length > 0) {
      return { isValid: false, messages: localIssues, suggestedAddress: null };
    }

    const client = getShippoClient();
    const created = await client.addresses.create({
      ...toShippoAddress(address),
      validate: true,
    });

    const validation = created.validationResults;
    const messages = (validation?.messages || [])
      .map((message) => String(message.text || message.source || "").trim())
      .filter(Boolean);

    // Require an explicit Shippo validation pass when results are present.
    if (validation && validation.isValid !== true) {
      return {
        isValid: false,
        messages: messages.length > 0 ? messages : ["Address could not be validated."],
        suggestedAddress: null,
      };
    }

    // Defensive: if Shippo returns no validation payload, reject rather than guess.
    if (!validation) {
      return {
        isValid: false,
        messages: ["Address could not be validated by the carrier service."],
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
    // No carrier_accounts / carriers filter — Shippo quotes every active
    // carrier account on the API token. Missing FedEx/UPS is almost always
    // inactive/restricted accounts on the Shippo side, not app filtering.
    await logActiveCarrierAccounts(client);

    const shipment = await client.shipments.create({
      addressFrom: toShippoAddress(input.shipFrom),
      // Guest destinations are residential return addresses.
      addressTo: toShippoAddress(input.shipTo, { isResidential: true }),
      parcels: [toShippoParcel(input.parcel)],
      async: false,
    });

    const rates = shipment.rates || [];
    const shipmentMessages = (shipment.messages || []).map((message) => ({
      source: message.source != null ? String(message.source) : null,
      code: message.code != null ? String(message.code) : null,
      text: message.text != null ? String(message.text) : null,
    }));

    // Full Shippo rates payload (no address PII — rates array only).
    logShippoRates("shippo.rates.raw_response", {
      shipmentObjectId: shipment.objectId ?? null,
      shipmentStatus: shipment.status ?? null,
      rawRateCount: rates.length,
      shipmentMessages,
      rates: rates.map((rate) => serializeShippoRateForLog(rate)),
    });

    const mapped: ShippingRate[] = [];
    const dropped: Array<Record<string, unknown>> = [];
    for (const rate of rates) {
      const next = mapShippoRate(rate);
      if (next) {
        mapped.push(next);
      } else {
        dropped.push({
          objectId: rateObjectId(rate),
          provider: rate.provider ?? null,
          amount: rate.amount ?? null,
          reason: "mapShippoRate_returned_null",
        });
      }
    }

    const deduped = dedupeRates(mapped).sort((a, b) => a.amount - b.amount);

    logShippoRates("shippo.rates.mapped_summary", {
      shipmentObjectId: shipment.objectId ?? null,
      rawRateCount: rates.length,
      mappedCount: mapped.length,
      droppedCount: dropped.length,
      dropped,
      dedupedCount: deduped.length,
      providersRaw: uniqueStrings(rates.map((rate) => String(rate.provider || ""))),
      providersReturned: uniqueStrings(deduped.map((rate) => rate.carrier)),
      servicesReturned: deduped.map((rate) => ({
        carrier: rate.carrier,
        service: rate.service,
        amount: rate.amount,
        providerRateId: rate.providerRateId,
      })),
    });

    return deduped;
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

function toShippoAddress(
  address: ShippingAddress,
  options?: { isResidential?: boolean }
) {
  return {
    name: String(address.name || "").trim(),
    street1: String(address.line1 || "").trim(),
    street2: address.line2?.trim() || undefined,
    city: String(address.city || "").trim(),
    state: String(address.state || "").trim(),
    zip: String(address.postal || "").trim(),
    country: String(address.country || "US").trim().toUpperCase(),
    phone: address.phone?.trim() || undefined,
    email: address.email?.trim() || undefined,
    ...(options?.isResidential != null
      ? { isResidential: options.isResidential }
      : {}),
  };
}

/** Log which Shippo carrier accounts are active (explains USPS-only quotes). */
async function logActiveCarrierAccounts(client: ReturnType<typeof getShippoClient>) {
  try {
    const listed = await client.carrierAccounts.list({ results: 100 });
    const accounts = (listed.results || []).map((account) => ({
      carrier: String(account.carrier || ""),
      active: account.active !== false,
      isShippoAccount: Boolean(account.isShippoAccount),
      test: Boolean(account.test),
      objectId: account.objectId ?? null,
    }));
    const activeCarriers = uniqueStrings(
      accounts.filter((row) => row.active).map((row) => row.carrier)
    );
    logShippoRates("shippo.carrier_accounts", {
      accountCount: accounts.length,
      activeCarriers,
      hasFedEx: activeCarriers.some((carrier) =>
        carrier.toLowerCase().includes("fedex")
      ),
      hasUps: activeCarriers.some((carrier) =>
        carrier.toLowerCase().includes("ups")
      ),
      accounts,
    });
  } catch (error) {
    logShippoRates("shippo.carrier_accounts_error", {
      message: error instanceof Error ? error.message : String(error),
    });
  }
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

function rateObjectId(rate: Rate): string {
  const raw = rate as Rate & { object_id?: string };
  return String(rate.objectId || raw.object_id || "").trim();
}

function rateAmount(rate: Rate): number {
  const raw = rate as Rate & { amount_local?: string | number };
  const amount = Number(rate.amount ?? raw.amount_local);
  return amount;
}

function mapShippoRate(rate: Rate): ShippingRate | null {
  const objectId = rateObjectId(rate);
  const amount = rateAmount(rate);
  if (!objectId || !Number.isFinite(amount)) return null;

  const days = rate.estimatedDays;
  const serviceName =
    rate.servicelevel?.name || rate.servicelevel?.token || "Service";
  const durationTerms = rate.durationTerms
    ? String(rate.durationTerms).trim()
    : "";
  const estimatedDeliveryLabel =
    typeof days === "number"
      ? `${days} business day${days === 1 ? "" : "s"}`
      : durationTerms || null;

  const attrs = (rate.attributes || []).map((value) => String(value).toUpperCase());
  const badges: NonNullable<ShippingRate["badges"]> = [];
  if (attrs.includes("BESTVALUE") || attrs.includes("CHEAPEST")) {
    badges.push("best_value");
  }
  if (attrs.includes("FASTEST")) {
    badges.push("fastest");
  }
  if (attrs.includes("CHEAPEST") && !attrs.includes("BESTVALUE")) {
    badges.push("lowest_price");
  }

  let highlight: ShippingRate["highlight"] = null;
  if (badges.includes("best_value")) highlight = "best_value";
  else if (badges.includes("fastest")) highlight = "fastest";
  else if (badges.includes("lowest_price")) highlight = "cheapest";

  const logo =
    rate.providerImage75 || rate.providerImage200
      ? String(rate.providerImage75 || rate.providerImage200)
      : null;

  // Carrier/service come straight from Shippo — never hardcode brand names.
  return {
    providerRateId: objectId,
    carrier: String(rate.provider || "Carrier"),
    service: String(serviceName),
    amount: Math.round(amount * 100) / 100,
    currency: String(rate.currency || "USD").toLowerCase(),
    estimatedDaysMin: typeof days === "number" ? days : null,
    estimatedDaysMax: typeof days === "number" ? days : null,
    estimatedDeliveryLabel,
    estimatedDeliveryDate:
      typeof days === "number" ? projectBusinessDateIso(days) : null,
    carrierLogoUrl: logo,
    badges,
    highlight,
  };
}

function serializeShippoRateForLog(rate: Rate): Record<string, unknown> {
  // Prefer a structured subset, then attach the full rate object for diagnosis.
  return {
    objectId: rateObjectId(rate),
    provider: rate.provider ?? null,
    servicelevel: rate.servicelevel ?? null,
    amount: rate.amount ?? null,
    currency: rate.currency ?? null,
    estimatedDays: rate.estimatedDays ?? null,
    durationTerms: rate.durationTerms ?? null,
    attributes: rate.attributes ?? null,
    carrierAccount: (rate as Rate & { carrierAccount?: unknown }).carrierAccount ?? null,
    zone: (rate as Rate & { zone?: unknown }).zone ?? null,
    messages: (rate as Rate & { messages?: unknown }).messages ?? null,
    fullRate: rate,
  };
}

function uniqueStrings(values: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const value of values) {
    const trimmed = value.trim();
    if (!trimmed) continue;
    const key = trimmed.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(trimmed);
  }
  return out;
}

function logShippoRates(
  step: string,
  fields: Record<string, unknown>
): void {
  console.info(
    JSON.stringify({
      scope: "shippo-rates",
      step,
      at: new Date().toISOString(),
      vercelEnv: process.env.VERCEL_ENV || null,
      ...fields,
    })
  );
}

function projectBusinessDateIso(businessDays: number, from = new Date()): string {
  const date = new Date(from);
  let remaining = Math.max(0, Math.floor(businessDays));
  while (remaining > 0) {
    date.setDate(date.getDate() + 1);
    const day = date.getDay();
    if (day !== 0 && day !== 6) remaining -= 1;
  }
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function localAddressIssues(address: ShippingAddress): string[] {
  const issues: string[] = [];
  if (!address.name?.trim()) issues.push("Full name is required.");
  if (!address.line1?.trim()) issues.push("Street address is required.");
  if (!address.city?.trim()) issues.push("City is required.");
  if (!address.state?.trim()) issues.push("State is required.");
  if (!address.postal?.trim()) issues.push("Postal code is required.");
  if (!address.country?.trim()) issues.push("Country is required.");

  const country = String(address.country || "").trim().toUpperCase();
  const postal = String(address.postal || "").trim();
  if (country === "US" && postal && !/^\d{5}(-\d{4})?$/.test(postal)) {
    issues.push("Enter a valid US ZIP code (12345 or 12345-6789).");
  }

  return issues;
}

/** Keep the cheapest quote when Shippo returns duplicate carrier/service rows. */
function dedupeRates(rates: ShippingRate[]): ShippingRate[] {
  const best = new Map<string, ShippingRate>();
  for (const rate of rates) {
    const key = `${rate.carrier.trim().toLowerCase()}::${rate.service.trim().toLowerCase()}`;
    const existing = best.get(key);
    if (!existing || rate.amount < existing.amount) {
      best.set(key, rate);
    }
  }
  return Array.from(best.values());
}

function mapPurchasedLabel(transaction: Transaction): PurchasedLabel {
  const objectId = String(transaction.objectId || "").trim();
  const trackingNumber = String(transaction.trackingNumber || "").trim();
  if (!objectId || !trackingNumber) {
    throw new Error("Shippo transaction missing object id or tracking number.");
  }

  // Empty when Shippo does not expand the rate object — callers fall back to
  // the selected rate snapshot / selected_carrier fields (never "Carrier"/"Service").
  let carrier = "";
  let service = "";
  if (transaction.rate && typeof transaction.rate === "object") {
    const rate = transaction.rate as {
      provider?: string;
      servicelevel?: { name?: string; token?: string };
    };
    carrier = String(rate.provider || "").trim();
    service = String(
      rate.servicelevel?.name || rate.servicelevel?.token || ""
    ).trim();
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
