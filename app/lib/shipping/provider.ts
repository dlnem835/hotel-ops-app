import type {
  AddressValidationResult,
  PurchasedLabel,
  ShippingAddress,
  ShippingPackage,
  ShippingRate,
  TrackingResult,
} from "./types";

/**
 * Replaceable shipping carrier integration.
 * Lost & Found business logic must depend on this interface only —
 * never on Shippo (or any vendor) field names.
 */
export interface ShippingProvider {
  readonly id: string;

  validateAddress(address: ShippingAddress): Promise<AddressValidationResult>;

  getRates(input: {
    shipFrom: ShippingAddress;
    shipTo: ShippingAddress;
    parcel: ShippingPackage;
  }): Promise<ShippingRate[]>;

  purchaseLabel(input: {
    shipFrom: ShippingAddress;
    shipTo: ShippingAddress;
    parcel: ShippingPackage;
    providerRateId: string;
    idempotencyKey: string;
  }): Promise<PurchasedLabel>;

  voidLabel(providerTransactionId: string): Promise<void>;

  getTrackingStatus(trackingNumber: string): Promise<TrackingResult>;
}
