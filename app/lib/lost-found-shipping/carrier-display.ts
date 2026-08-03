/**
 * Helpers for carrier/service labels from Shippo (and stored request rows).
 * Avoids treating Shippo SDK placeholders ("Carrier" / "Service") as real values.
 */

export function isGenericCarrierLabel(
  value: string | null | undefined
): boolean {
  const normalized = String(value || "")
    .trim()
    .toLowerCase();
  return !normalized || normalized === "carrier" || normalized === "service";
}

export function displayCarrierServiceLabel(
  value: string | null | undefined,
  fallback = "Not available"
): string {
  if (isGenericCarrierLabel(value)) return fallback;
  return String(value).trim();
}

export function resolveStoredCarrierService(input: {
  purchasedCarrier?: string | null;
  purchasedService?: string | null;
  selectedCarrier?: string | null;
  selectedService?: string | null;
  snapshotCarrier?: string | null;
  snapshotService?: string | null;
}): { carrier: string | null; service: string | null } {
  const carrier =
    pickRealLabel(input.purchasedCarrier) ||
    pickRealLabel(input.selectedCarrier) ||
    pickRealLabel(input.snapshotCarrier);
  const service =
    pickRealLabel(input.purchasedService) ||
    pickRealLabel(input.selectedService) ||
    pickRealLabel(input.snapshotService);
  return { carrier, service };
}

function pickRealLabel(value: string | null | undefined): string | null {
  if (isGenericCarrierLabel(value)) return null;
  return String(value).trim();
}

/** Look up carrier/service from a rate snapshot by provider rate id. */
export function carrierServiceFromRateSnapshot(
  snapshot: unknown,
  providerRateId: string | null | undefined
): { carrier: string | null; service: string | null } {
  const rateId = String(providerRateId || "").trim();
  if (!rateId || !Array.isArray(snapshot)) {
    return { carrier: null, service: null };
  }
  const match = snapshot.find(
    (row) =>
      row &&
      typeof row === "object" &&
      String((row as { providerRateId?: unknown }).providerRateId || "").trim() ===
        rateId
  ) as { carrier?: unknown; service?: unknown } | undefined;
  if (!match) return { carrier: null, service: null };
  return {
    carrier: pickRealLabel(
      match.carrier != null ? String(match.carrier) : null
    ),
    service: pickRealLabel(
      match.service != null ? String(match.service) : null
    ),
  };
}
