import type { SupabaseClient } from "@supabase/supabase-js";
import {
  getPropertyAddressIncompleteFields,
  isPropertyAddressComplete,
  propertyAddressToDbColumns,
  propertyRowToAddressFields,
  propertyToShipFromAddress,
  type PropertyAddressFields,
} from "@/app/lib/address/property-address";
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
  /** Mirrored from property for display; ship-from source of truth is properties.* */
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
  propertyAddressComplete: boolean;
  propertyAddressIncompleteFields: string[];
};

export type PropertyShippingSettingsInput = {
  shippingEnabled: boolean;
  senderName: string;
  /** When provided, updates canonical property address (Ship From source of truth). */
  shipFromLine1?: string;
  shipFromLine2?: string;
  shipFromCity?: string;
  shipFromState?: string;
  shipFromPostal?: string;
  shipFromCountry?: string;
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

const REQUIRED_CONTACT_FOR_ENABLE = [
  { key: "senderName" as const, label: "Ship From Name" },
  { key: "propertyPhone" as const, label: "Phone Number" },
  { key: "propertyEmail" as const, label: "Return Email" },
];

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
    propertyAddressComplete: false,
    propertyAddressIncompleteFields: getPropertyAddressIncompleteFields({
      addressLine1: "",
      addressLine2: "",
      addressCity: "",
      addressState: "",
      addressPostal: "",
      addressCountry: "US",
    }),
  };
}

function toNumberOrNull(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function applyPropertyAddressMirror(
  settings: PropertyShippingSettings,
  address: PropertyAddressFields
): PropertyShippingSettings {
  const incomplete = getPropertyAddressIncompleteFields(address);
  return {
    ...settings,
    shipFromLine1: address.addressLine1,
    shipFromLine2: address.addressLine2,
    shipFromCity: address.addressCity,
    shipFromState: address.addressState,
    shipFromPostal: address.addressPostal,
    shipFromCountry: address.addressCountry || "US",
    propertyAddressComplete: incomplete.length === 0,
    propertyAddressIncompleteFields: incomplete,
  };
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
    propertyAddressComplete: false,
    propertyAddressIncompleteFields: [],
  };
}

/** Contact + Ship From address fields that must be filled to enable shipping. */
export function getShippingSettingsIncompleteFields(
  settings: PropertyShippingSettings | PropertyShippingSettingsInput
): string[] {
  const missing: string[] = [];
  for (const field of REQUIRED_CONTACT_FOR_ENABLE) {
    const value = String(settings[field.key] ?? "").trim();
    if (!value) missing.push(field.label);
  }
  if (!String(settings.propertyEmail || "").includes("@")) {
    if (!missing.includes("Return Email")) missing.push("Return Email");
  }

  const addressFields: PropertyAddressFields = {
    addressLine1: String(settings.shipFromLine1 ?? "").trim(),
    addressLine2: String(settings.shipFromLine2 ?? "").trim(),
    addressCity: String(settings.shipFromCity ?? "").trim(),
    addressState: String(settings.shipFromState ?? "").trim(),
    addressPostal: String(settings.shipFromPostal ?? "").trim(),
    addressCountry: String(settings.shipFromCountry ?? "US").trim() || "US",
  };
  for (const label of getPropertyAddressIncompleteFields(addressFields)) {
    missing.push(label);
  }
  return missing;
}

export function isShippingSettingsReady(
  settings: PropertyShippingSettings
): boolean {
  return (
    settings.shippingEnabled &&
    settings.propertyAddressComplete &&
    getShippingSettingsIncompleteFields(settings).length === 0
  );
}

/** @deprecated Prefer resolveShipFromForProperty — kept for transitional callers. */
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

export async function fetchPropertyAddressFields(
  supabase: SupabaseClient,
  scope: PropertyShippingScope
): Promise<{ name: string; phone: string; address: PropertyAddressFields }> {
  const { data, error } = await supabase
    .from("properties")
    .select(
      "name, phone_number, address_line1, address_line2, address_city, address_state, address_postal, address_country"
    )
    .eq("id", scope.propertyId)
    .eq("organization_id", scope.organizationId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) {
    return {
      name: "",
      phone: "",
      address: {
        addressLine1: "",
        addressLine2: "",
        addressCity: "",
        addressState: "",
        addressPostal: "",
        addressCountry: "US",
      },
    };
  }

  return {
    name: String(data.name || ""),
    phone: String(data.phone_number || ""),
    address: propertyRowToAddressFields(data as Record<string, unknown>),
  };
}

export async function resolveShipFromForProperty(
  supabase: SupabaseClient,
  scope: PropertyShippingScope,
  settings: PropertyShippingSettings
): Promise<ShippingAddress> {
  const property = await fetchPropertyAddressFields(supabase, scope);
  if (!isPropertyAddressComplete(property.address)) {
    throw new Error(
      "Complete the Ship From address in Shipping Settings before sending shipping requests."
    );
  }
  return propertyToShipFromAddress({
    propertyName: settings.senderName.trim() || property.name,
    address: property.address,
    phone: settings.propertyPhone || property.phone,
    email: settings.propertyEmail,
  });
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

  const property = await fetchPropertyAddressFields(supabase, scope);
  const base = data
    ? rowToPropertyShippingSettings(data as Record<string, unknown>)
    : emptySettings(scope);

  // Prefer property phone when shipping phone empty.
  if (!base.propertyPhone.trim() && property.phone.trim()) {
    base.propertyPhone = property.phone;
  }
  if (!base.senderName.trim() && property.name.trim()) {
    base.senderName = property.name;
  }

  return applyPropertyAddressMirror(base, property.address);
}

export async function upsertPropertyShippingSettings(
  supabase: SupabaseClient,
  scope: PropertyShippingScope,
  input: PropertyShippingSettingsInput
): Promise<PropertyShippingSettings> {
  const presetKey = isPackagePresetKey(input.defaultPackagePreset)
    ? input.defaultPackagePreset
    : "small_box";

  let property = await fetchPropertyAddressFields(supabase, scope);

  // Shipping Settings may update the canonical property address.
  const hasAddressPayload =
    input.shipFromLine1 !== undefined ||
    input.shipFromCity !== undefined ||
    input.shipFromState !== undefined ||
    input.shipFromPostal !== undefined;

  if (hasAddressPayload) {
    const nextAddress: PropertyAddressFields = {
      addressLine1: String(input.shipFromLine1 ?? property.address.addressLine1).trim(),
      addressLine2: String(input.shipFromLine2 ?? property.address.addressLine2).trim(),
      addressCity: String(input.shipFromCity ?? property.address.addressCity).trim(),
      addressState: String(input.shipFromState ?? property.address.addressState).trim(),
      addressPostal: String(input.shipFromPostal ?? property.address.addressPostal).trim(),
      addressCountry: String(
        input.shipFromCountry ?? property.address.addressCountry ?? "US"
      ).trim() || "US",
    };
    const columns = propertyAddressToDbColumns(nextAddress);
    const { error: propertyError } = await supabase
      .from("properties")
      .update({
        ...columns,
        // Keep hotel phone in sync when shipping phone is provided.
        ...(input.propertyPhone.trim()
          ? { phone_number: input.propertyPhone.trim() }
          : {}),
        updated_at: new Date().toISOString(),
      })
      .eq("id", scope.propertyId)
      .eq("organization_id", scope.organizationId);
    if (propertyError) throw new Error(propertyError.message);
    property = await fetchPropertyAddressFields(supabase, scope);
  }

  const mirrored = applyPropertyAddressMirror(
    {
      ...emptySettings(scope),
      shippingEnabled: Boolean(input.shippingEnabled),
      senderName: input.senderName.trim(),
      propertyPhone: input.propertyPhone.trim(),
      propertyEmail: input.propertyEmail.trim(),
      defaultPackagePreset: presetKey,
      defaultLengthIn: input.defaultLengthIn,
      defaultWidthIn: input.defaultWidthIn,
      defaultHeightIn: input.defaultHeightIn,
      defaultWeightOz: input.defaultWeightOz,
      defaultSenderContact: input.defaultSenderContact.trim(),
      tokenTtlHours: Math.min(
        720,
        Math.max(1, Math.round(input.tokenTtlHours) || 168)
      ),
    },
    property.address
  );

  const incomplete = getShippingSettingsIncompleteFields(mirrored);
  const shippingEnabled =
    Boolean(input.shippingEnabled) &&
    mirrored.propertyAddressComplete &&
    incomplete.length === 0;

  // Persist mirrored ship-from columns for audit/compat; source of truth remains properties.
  const payload = {
    property_id: scope.propertyId,
    organization_id: scope.organizationId,
    shipping_enabled: shippingEnabled,
    sender_name: mirrored.senderName,
    ship_from_line1: mirrored.shipFromLine1,
    ship_from_line2: mirrored.shipFromLine2,
    ship_from_city: mirrored.shipFromCity,
    ship_from_state: mirrored.shipFromState,
    ship_from_postal: mirrored.shipFromPostal,
    ship_from_country: (mirrored.shipFromCountry || "US").toUpperCase(),
    property_phone: mirrored.propertyPhone,
    property_email: mirrored.propertyEmail,
    default_package_preset: presetKey,
    default_length_in: input.defaultLengthIn,
    default_width_in: input.defaultWidthIn,
    default_height_in: input.defaultHeightIn,
    default_weight_oz: input.defaultWeightOz,
    default_sender_contact: input.defaultSenderContact.trim(),
    token_ttl_hours: mirrored.tokenTtlHours,
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from("property_shipping_settings")
    .upsert(payload, { onConflict: "property_id" })
    .select("*")
    .single();

  if (error) throw new Error(error.message);
  return applyPropertyAddressMirror(
    rowToPropertyShippingSettings(data as Record<string, unknown>),
    property.address
  );
}
