import type { AddressValue } from "@/app/lib/address/format";
import {
  EMPTY_ADDRESS,
  formatAddressSingleLine,
} from "@/app/lib/address/format";
import type { ShippingAddress } from "@/app/lib/shipping/types";

/** Structured address columns on `properties`. */
export type PropertyAddressFields = {
  addressLine1: string;
  addressLine2: string;
  addressCity: string;
  addressState: string;
  addressPostal: string;
  addressCountry: string;
};

export const EMPTY_PROPERTY_ADDRESS: PropertyAddressFields = {
  addressLine1: "",
  addressLine2: "",
  addressCity: "",
  addressState: "",
  addressPostal: "",
  addressCountry: "US",
};

export function addressValueToPropertyFields(
  value: AddressValue
): PropertyAddressFields {
  return {
    addressLine1: value.line1.trim(),
    addressLine2: value.line2.trim(),
    addressCity: value.city.trim(),
    addressState: value.state.trim(),
    addressPostal: value.postal.trim(),
    addressCountry: (value.country.trim() || "US").toUpperCase(),
  };
}

export function propertyFieldsToAddressValue(
  fields: PropertyAddressFields
): AddressValue {
  return {
    line1: fields.addressLine1 || "",
    line2: fields.addressLine2 || "",
    city: fields.addressCity || "",
    state: fields.addressState || "",
    postal: fields.addressPostal || "",
    country: fields.addressCountry || "US",
  };
}

export function propertyRowToAddressFields(
  row: Record<string, unknown>
): PropertyAddressFields {
  return {
    addressLine1: String(row.address_line1 || ""),
    addressLine2: String(row.address_line2 || ""),
    addressCity: String(row.address_city || ""),
    addressState: String(row.address_state || ""),
    addressPostal: String(row.address_postal || ""),
    addressCountry: String(row.address_country || "US") || "US",
  };
}

export function getPropertyAddressIncompleteFields(
  fields: PropertyAddressFields
): string[] {
  const missing: string[] = [];
  if (!fields.addressLine1.trim()) missing.push("Street Address");
  if (!fields.addressCity.trim()) missing.push("City");
  if (!fields.addressState.trim()) missing.push("State / Province");
  if (!fields.addressPostal.trim()) missing.push("Postal Code");
  if (!fields.addressCountry.trim()) missing.push("Country");
  return missing;
}

export function isPropertyAddressComplete(fields: PropertyAddressFields): boolean {
  return getPropertyAddressIncompleteFields(fields).length === 0;
}

/** Denormalized single-line for lists / legacy readers. */
export function composePropertyAddressLine(fields: PropertyAddressFields): string {
  return formatAddressSingleLine(propertyFieldsToAddressValue(fields));
}

export function propertyAddressToDbColumns(fields: PropertyAddressFields) {
  const normalized: PropertyAddressFields = {
    addressLine1: fields.addressLine1.trim(),
    addressLine2: fields.addressLine2.trim(),
    addressCity: fields.addressCity.trim(),
    addressState: fields.addressState.trim(),
    addressPostal: fields.addressPostal.trim(),
    addressCountry: (fields.addressCountry.trim() || "US").toUpperCase(),
  };
  return {
    address_line1: normalized.addressLine1,
    address_line2: normalized.addressLine2,
    address_city: normalized.addressCity,
    address_state: normalized.addressState,
    address_postal: normalized.addressPostal,
    address_country: normalized.addressCountry,
    address: composePropertyAddressLine(normalized),
  };
}

/**
 * Canonical Ship From for Shippo — from the property record, not guest input.
 */
export function propertyToShipFromAddress(input: {
  propertyName: string;
  address: PropertyAddressFields;
  phone?: string | null;
  email?: string | null;
}): ShippingAddress {
  return {
    name: input.propertyName.trim() || "Hotel",
    line1: input.address.addressLine1.trim(),
    line2: input.address.addressLine2.trim() || undefined,
    city: input.address.addressCity.trim(),
    state: input.address.addressState.trim(),
    postal: input.address.addressPostal.trim(),
    country: input.address.addressCountry.trim() || "US",
    phone: input.phone?.trim() || undefined,
    email: input.email?.trim() || undefined,
  };
}

export function emptyAddressValue(): AddressValue {
  return { ...EMPTY_ADDRESS };
}
