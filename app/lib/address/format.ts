/** Shared structured address value used across One Eyrie forms. */

export type AddressValue = {
  line1: string;
  line2: string;
  city: string;
  state: string;
  postal: string;
  /** ISO country code (e.g. US) or display name. */
  country: string;
};

export const EMPTY_ADDRESS: AddressValue = {
  line1: "",
  line2: "",
  city: "",
  state: "",
  postal: "",
  country: "US",
};

export const ADDRESS_COUNTRY_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "US", label: "United States" },
  { value: "CA", label: "Canada" },
  { value: "MX", label: "Mexico" },
];

export function countryDisplayName(country: string): string {
  const normalized = (country || "US").trim().toUpperCase();
  const match = ADDRESS_COUNTRY_OPTIONS.find((option) => option.value === normalized);
  if (match) return match.label;
  if (normalized === "USA" || normalized === "UNITED STATES") return "United States";
  return country.trim() || "United States";
}

/** Single-line storage format for legacy `properties.address`. */
export function formatAddressSingleLine(address: AddressValue): string {
  const parts = [
    address.line1.trim(),
    address.line2.trim(),
    [address.city.trim(), address.state.trim()].filter(Boolean).join(", "),
    address.postal.trim(),
  ].filter(Boolean);
  return parts.join(", ");
}

/**
 * Best-effort parse of a legacy single-line address into structured fields.
 * Prefers "Street, City, ST ZIP" / "Street, Apt, City, ST ZIP" patterns.
 */
export function parseAddressSingleLine(raw: string): AddressValue {
  const text = (raw || "").trim();
  if (!text) return { ...EMPTY_ADDRESS };

  const parts = text.split(",").map((part) => part.trim()).filter(Boolean);
  if (parts.length === 1) {
    return { ...EMPTY_ADDRESS, line1: parts[0] };
  }

  // Last segment often "ST ZIP" or just ZIP
  const last = parts[parts.length - 1] || "";
  const stateZip = last.match(/^([A-Za-z]{2})\s+(\d{5}(?:-\d{4})?)$/);
  let state = "";
  let postal = "";
  let beforeLast = parts.slice(0, -1);

  if (stateZip) {
    state = stateZip[1].toUpperCase();
    postal = stateZip[2];
  } else if (/^\d{5}(?:-\d{4})?$/.test(last) && parts.length >= 2) {
    postal = last;
    const maybeStateCity = parts[parts.length - 2] || "";
    const cityState = maybeStateCity.match(/^(.*)\s+([A-Za-z]{2})$/);
    if (cityState) {
      beforeLast = [...parts.slice(0, -2), cityState[1].trim()];
      state = cityState[2].toUpperCase();
    } else {
      beforeLast = parts.slice(0, -1);
    }
  } else if (/^[A-Za-z]{2}$/.test(last) && parts.length >= 2) {
    state = last.toUpperCase();
  }

  const city = beforeLast.length > 0 ? beforeLast[beforeLast.length - 1] : "";
  const streetParts = beforeLast.slice(0, -1);
  const line1 = streetParts[0] || text;
  const line2 = streetParts.slice(1).join(", ");

  return {
    line1,
    line2,
    city,
    state,
    postal,
    country: "US",
  };
}

export type DestinationAddress = AddressValue & {
  name?: string;
};

/** Multiline destination lines for guest summary cards. */
export function formatDestinationLines(address: DestinationAddress): string[] {
  const lines: string[] = [];
  if (address.name?.trim()) lines.push(address.name.trim());
  if (address.line1.trim()) lines.push(address.line1.trim());
  if (address.line2.trim()) lines.push(address.line2.trim());
  const cityLine = [
    address.city.trim(),
    [address.state.trim(), address.postal.trim()].filter(Boolean).join(" "),
  ]
    .filter(Boolean)
    .join(", ");
  if (cityLine) lines.push(cityLine);
  lines.push(countryDisplayName(address.country));
  return lines;
}
