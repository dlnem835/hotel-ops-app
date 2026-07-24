import type { SupabaseClient } from "@supabase/supabase-js";
import {
  getPackagePreset,
  isPackagePresetKey,
  type PackagePresetKey,
} from "@/app/lib/shipping/package-presets";
import type { ShippingAddress } from "@/app/lib/shipping/types";

export type PropertyShippingScope = {
  organizationId: number;
  propertyId: number;
};

export type PropertyShippingSettings = {
  propertyId: number;
  organizationId: number;
  shippingEnabled: boolean;
  senderName: string;
  shipFromLine1: string;
  shipFromLine2: string;
  shipFromCity: string;
  shipFromState: string;
  shipFromPostal: string;
  shipFromCountry: string;
  propertyPhone: string;
  propertyEmail: string;
  defaultPackagePreset: PackagePresetKey;
  defaultLengthIn: number | null;
  defaultWidthIn: number | null;
  defaultHeightIn: number | null;
  defaultWeightOz: number | null;
  defaultSenderContact: string;
  tokenTtlHours: number;
  updatedAt: string | null;
};

export type PropertyShippingSettingsInput = {
  shippingEnabled: boolean;
  senderName: string;
  shipFromLine1: string;
  shipFromLine2: string;
  shipFromCity: string;
  shipFromState: string;
  shipFromPostal: string;
  shipFromCountry: string;
  propertyPhone: string;
  propertyEmail: string;
  defaultPackagePreset: string;
  defaultLengthIn: number | null;
  defaultWidthIn: number | null;
  defaultHeightIn: number | null;
  defaultWeightOz: number | null;
  defaultSenderContact: string;
  tokenTtlHours: number;
};

const REQUIRED_FOR_ENABLE = [
  { key: "senderName", label: "Sender / property name" },
  { key: "shipFromLine1", label: "Ship-from street address" },
  { key: "shipFromCity", label: "City" },
  { key: "shipFromState", label: "State" },
  { key: "shipFromPostal", label: "Postal code" },
  { key: "shipFromCountry", label: "Country" },
  { key: "propertyPhone", label: "Property phone" },
  { key: "propertyEmail", label: "Property email" },
] as const;

function emptySettings(scope: PropertyShippingScope): PropertyShippingSettings {
  const preset = getPackagePreset("small_box");
  return {
    propertyId: scope.propertyId,
    organizationId: scope.organizationId,
    shippingEnabled: false,
    senderName: "",
    shipFromLine1: "",
    shipFromLine2: "",
    shipFromCity: "",
    shipFromState: "",
    shipFromPostal: "",
    shipFromCountry: "US",
    propertyPhone: "",
    propertyEmail: "",
    defaultPackagePreset: "small_box",
    defaultLengthIn: preset.lengthIn,
    defaultWidthIn: preset.widthIn,
    defaultHeightIn: preset.heightIn,
    defaultWeightOz: preset.weightOz,
    defaultSenderContact: "",
    tokenTtlHours: 168,
    updatedAt: null,
  };
}

function toNumberOrNull(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

export function rowToPropertyShippingSettings(
  row: Record<string, unknown>
): PropertyShippingSettings {
  const presetRaw = String(row.default_package_preset || "small_box");
  const presetKey = isPackagePresetKey(presetRaw) ? presetRaw : "small_box";

  return {
    propertyId: Number(row.property_id),
    organizationId: Number(row.organization_id),
    shippingEnabled: Boolean(row.shipping_enabled),
    senderName: String(row.sender_name || ""),
    shipFromLine1: String(row.ship_from_line1 || ""),
    shipFromLine2: String(row.ship_from_line2 || ""),
    shipFromCity: String(row.ship_from_city || ""),
    shipFromState: String(row.ship_from_state || ""),
    shipFromPostal: String(row.ship_from_postal || ""),
    shipFromCountry: String(row.ship_from_country || "US"),
    propertyPhone: String(row.property_phone || ""),
    propertyEmail: String(row.property_email || ""),
    defaultPackagePreset: presetKey,
    defaultLengthIn: toNumberOrNull(row.default_length_in),
    defaultWidthIn: toNumberOrNull(row.default_width_in),
    defaultHeightIn: toNumberOrNull(row.default_height_in),
    defaultWeightOz: toNumberOrNull(row.default_weight_oz),
    defaultSenderContact: String(row.default_sender_contact || ""),
    tokenTtlHours: Number(row.token_ttl_hours) || 168,
    updatedAt: row.updated_at ? String(row.updated_at) : null,
  };
}

/** Fields that must be filled before automated shipping can be used. */
export function getShippingSettingsIncompleteFields(
  settings: PropertyShippingSettings | PropertyShippingSettingsInput
): string[] {
  const missing: string[] = [];
  for (const field of REQUIRED_FOR_ENABLE) {
    const value = String(settings[field.key] ?? "").trim();
    if (!value) missing.push(field.label);
  }
  if (!String(settings.propertyEmail || "").includes("@")) {
    if (!missing.includes("Property email")) missing.push("Property email");
  }
  return missing;
}

export function isShippingSettingsReady(
  settings: PropertyShippingSettings
): boolean {
  return (
    settings.shippingEnabled &&
    getShippingSettingsIncompleteFields(settings).length === 0
  );
}

export function settingsToShipFromAddress(
  settings: PropertyShippingSettings
): ShippingAddress {
  return {
    name: settings.senderName.trim(),
    line1: settings.shipFromLine1.trim(),
    line2: settings.shipFromLine2.trim() || undefined,
    city: settings.shipFromCity.trim(),
    state: settings.shipFromState.trim(),
    postal: settings.shipFromPostal.trim(),
    country: settings.shipFromCountry.trim() || "US",
    phone: settings.propertyPhone.trim() || undefined,
    email: settings.propertyEmail.trim() || undefined,
  };
}

export async function fetchPropertyShippingSettings(
  supabase: SupabaseClient,
  scope: PropertyShippingScope
): Promise<PropertyShippingSettings> {
  const { data, error } = await supabase
    .from("property_shipping_settings")
    .select("*")
    .eq("property_id", scope.propertyId)
    .eq("organization_id", scope.organizationId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) return emptySettings(scope);
  return rowToPropertyShippingSettings(data as Record<string, unknown>);
}

export async function upsertPropertyShippingSettings(
  supabase: SupabaseClient,
  scope: PropertyShippingScope,
  input: PropertyShippingSettingsInput
): Promise<PropertyShippingSettings> {
  const presetKey = isPackagePresetKey(input.defaultPackagePreset)
    ? input.defaultPackagePreset
    : "small_box";

  const incomplete = getShippingSettingsIncompleteFields(input);
  const shippingEnabled =
    Boolean(input.shippingEnabled) && incomplete.length === 0;

  const payload = {
    property_id: scope.propertyId,
    organization_id: scope.organizationId,
    shipping_enabled: shippingEnabled,
    sender_name: input.senderName.trim(),
    ship_from_line1: input.shipFromLine1.trim(),
    ship_from_line2: input.shipFromLine2.trim(),
    ship_from_city: input.shipFromCity.trim(),
    ship_from_state: input.shipFromState.trim(),
    ship_from_postal: input.shipFromPostal.trim(),
    ship_from_country: (input.shipFromCountry.trim() || "US").toUpperCase(),
    property_phone: input.propertyPhone.trim(),
    property_email: input.propertyEmail.trim(),
    default_package_preset: presetKey,
    default_length_in: input.defaultLengthIn,
    default_width_in: input.defaultWidthIn,
    default_height_in: input.defaultHeightIn,
    default_weight_oz: input.defaultWeightOz,
    default_sender_contact: input.defaultSenderContact.trim(),
    token_ttl_hours: Math.min(720, Math.max(1, Math.round(input.tokenTtlHours) || 168)),
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from("property_shipping_settings")
    .upsert(payload, { onConflict: "property_id" })
    .select("*")
    .single();

  if (error) throw new Error(error.message);
  return rowToPropertyShippingSettings(data as Record<string, unknown>);
}
