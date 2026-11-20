/** Public storage bucket used by the retired guest prepaid-label upload. */
export const HISTORICAL_SHIPPING_LABELS_BUCKET = "shipping-labels";

const PUBLIC_OBJECT_MARKER = `/storage/v1/object/public/${HISTORICAL_SHIPPING_LABELS_BUCKET}/`;

/**
 * Extract the storage object path from a public shipping-labels URL.
 * Returns null for signed URLs, other buckets, or malformed values.
 */
export function parsePublicShippingLabelsObjectPath(
  raw: string | null | undefined
): string | null {
  const value = String(raw || "").trim();
  if (!value) return null;

  let pathname = "";
  try {
    if (/^https?:\/\//i.test(value)) {
      pathname = new URL(value).pathname;
    } else if (value.startsWith("/")) {
      pathname = value;
    } else {
      return null;
    }
  } catch {
    return null;
  }

  const markerIndex = pathname.indexOf(PUBLIC_OBJECT_MARKER);
  if (markerIndex < 0) return null;

  const encoded = pathname.slice(markerIndex + PUBLIC_OBJECT_MARKER.length);
  if (!encoded) return null;

  let objectPath = "";
  try {
    objectPath = decodeURIComponent(encoded);
  } catch {
    return null;
  }

  objectPath = objectPath.replace(/^\/+/, "").replace(/\/{2,}/g, "/");
  if (!objectPath || objectPath.includes("..") || objectPath.startsWith("/")) {
    return null;
  }

  return objectPath;
}

export function hasHistoricalShippingLabelsUrl(
  raw: string | null | undefined
): boolean {
  return parsePublicShippingLabelsObjectPath(raw) != null;
}

/**
 * Prefixed guest-upload paths must match the item's tenant.
 * Unprefixed legacy objects are authorized only via the tenant-scoped lost_items row.
 */
export function isHistoricalLabelPathAllowedForTenant(
  objectPath: string,
  organizationId: number,
  propertyId: number
): boolean {
  const match = objectPath.match(/^org-(\d+)\/property-(\d+)\//);
  if (!match) return true;
  return (
    Number(match[1]) === organizationId && Number(match[2]) === propertyId
  );
}

export function redactLostItemLabelUrlForClient<T extends Record<string, unknown>>(
  item: T
): Omit<T, "label_url"> & { has_historical_shipping_label: boolean } {
  const hasHistorical = hasHistoricalShippingLabelsUrl(
    typeof item.label_url === "string" ? item.label_url : null
  );
  const { label_url: _omitted, ...rest } = item;
  void _omitted;
  return {
    ...(rest as Omit<T, "label_url">),
    has_historical_shipping_label: hasHistorical,
  };
}
