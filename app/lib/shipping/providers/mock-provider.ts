import type {
  AddressValidationResult,
  PurchasedLabel,
  ShippingAddress,
  ShippingPackage,
  ShippingRate,
  TrackingResult,
} from "../types";
import type { ShippingProvider } from "../provider";

/**
 * Deterministic mock provider for Phase 1 UI and tests.
 * No network calls. Replace via SHIPPING_PROVIDER=shippo in Phase 2.
 */
export class MockShippingProvider implements ShippingProvider {
  readonly id = "mock";

  async validateAddress(address: ShippingAddress): Promise<AddressValidationResult> {
    const missing: string[] = [];
    if (!address.line1.trim()) missing.push("Street address is required.");
    if (!address.city.trim()) missing.push("City is required.");
    if (!address.state.trim()) missing.push("State is required.");
    if (!address.postal.trim()) missing.push("Postal code is required.");
    if (!address.country.trim()) missing.push("Country is required.");

    if (missing.length > 0) {
      return { isValid: false, messages: missing, suggestedAddress: null };
    }

    const postal = address.postal.trim();
    if (address.country.toUpperCase() === "US" && !/^\d{5}(-\d{4})?$/.test(postal)) {
      return {
        isValid: false,
        messages: ["Enter a valid US ZIP code (12345 or 12345-6789)."],
        suggestedAddress: null,
      };
    }

    // Mock “suggestion”: title-case city when all-caps.
    const suggested =
      address.city === address.city.toUpperCase() && address.city.length > 1
        ? {
            ...address,
            city:
              address.city.charAt(0) +
              address.city.slice(1).toLowerCase(),
          }
        : null;

    return {
      isValid: true,
      messages: suggested ? ["Suggested city capitalization applied."] : [],
      suggestedAddress: suggested,
    };
  }

  async getRates(input: {
    shipFrom: ShippingAddress;
    shipTo: ShippingAddress;
    parcel: ShippingPackage;
  }): Promise<ShippingRate[]> {
    const weightFactor = Math.max(1, input.parcel.weightOz / 16);
    const base = 8.5 + weightFactor * 2.25;

    return [
      {
        providerRateId: "mock_usps_ground",
        carrier: "USPS",
        service: "Ground Advantage",
        amount: roundMoney(base),
        currency: "usd",
        estimatedDaysMin: 2,
        estimatedDaysMax: 5,
        estimatedDeliveryLabel: "2–5 business days",
      },
      {
        providerRateId: "mock_usps_priority",
        carrier: "USPS",
        service: "Priority Mail",
        amount: roundMoney(base + 6.5),
        currency: "usd",
        estimatedDaysMin: 1,
        estimatedDaysMax: 3,
        estimatedDeliveryLabel: "1–3 business days",
      },
      {
        providerRateId: "mock_ups_ground",
        carrier: "UPS",
        service: "Ground",
        amount: roundMoney(base + 4.25),
        currency: "usd",
        estimatedDaysMin: 1,
        estimatedDaysMax: 5,
        estimatedDeliveryLabel: "1–5 business days",
      },
    ];
  }

  async purchaseLabel(input: {
    shipFrom: ShippingAddress;
    shipTo: ShippingAddress;
    parcel: ShippingPackage;
    providerRateId: string;
    idempotencyKey: string;
  }): Promise<PurchasedLabel> {
    const trackingNumber = `MOCK${input.idempotencyKey.replace(/[^a-zA-Z0-9]/g, "").slice(0, 12).toUpperCase()}`;
    return {
      providerTransactionId: `mock_txn_${input.idempotencyKey}`,
      trackingNumber,
      trackingUrl: `https://example.com/track/${trackingNumber}`,
      labelPdfBase64: null,
      labelUrl: null,
      carrier: input.providerRateId.includes("ups") ? "UPS" : "USPS",
      service: input.providerRateId.includes("priority")
        ? "Priority Mail"
        : "Ground",
    };
  }

  async voidLabel(_providerTransactionId: string): Promise<void> {
    return;
  }

  async getTrackingStatus(trackingNumber: string): Promise<TrackingResult> {
    return {
      status: "pre_transit",
      trackingNumber,
      trackingUrl: `https://example.com/track/${trackingNumber}`,
      rawStatus: "MOCK_PRE_TRANSIT",
    };
  }
}

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}
