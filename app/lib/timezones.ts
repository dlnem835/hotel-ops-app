/**
 * Supported property timezones (IANA identifiers) for the admin property form
 * and server-side create validation.
 *
 * Only values from this list may be stored on `properties.timezone`. Friendly
 * labels are display-only — the database always stores the IANA id.
 */

export type SupportedTimezone = {
  /** IANA timezone id, e.g. America/New_York — stored in the database. */
  id: string;
  /** Short region label, e.g. "Eastern Time". */
  label: string;
};

/** Curated allow-list of IANA zones used for property creation. */
export const SUPPORTED_TIMEZONES: readonly SupportedTimezone[] = [
  { id: "America/New_York", label: "Eastern Time" },
  { id: "America/Chicago", label: "Central Time" },
  { id: "America/Denver", label: "Mountain Time" },
  { id: "America/Phoenix", label: "Arizona Time" },
  { id: "America/Los_Angeles", label: "Pacific Time" },
  { id: "America/Anchorage", label: "Alaska Time" },
  { id: "Pacific/Honolulu", label: "Hawaii Time" },
  { id: "America/Puerto_Rico", label: "Atlantic Time (Puerto Rico)" },
  { id: "America/Toronto", label: "Eastern Time (Toronto)" },
  { id: "America/Winnipeg", label: "Central Time (Winnipeg)" },
  { id: "America/Edmonton", label: "Mountain Time (Edmonton)" },
  { id: "America/Vancouver", label: "Pacific Time (Vancouver)" },
] as const;

/** Fallback used when no organization property timezone is available. */
export const DEFAULT_PROPERTY_TIMEZONE = "America/New_York";

/** Pilot organization id — timezone default remains America/New_York for this org. */
export const PILOT_ORGANIZATION_ID_FOR_TIMEZONE = 1;

const SUPPORTED_ID_SET = new Set(SUPPORTED_TIMEZONES.map((zone) => zone.id));

/** Display string: "Eastern Time — America/New_York". */
export function formatTimezoneOptionLabel(zone: SupportedTimezone): string {
  return `${zone.label} — ${zone.id}`;
}

export function findSupportedTimezone(id: string): SupportedTimezone | null {
  const normalized = id.trim();
  return SUPPORTED_TIMEZONES.find((zone) => zone.id === normalized) ?? null;
}

/**
 * Strict allow-list check. Rejects arbitrary free-text — only curated IANA ids
 * from SUPPORTED_TIMEZONES are accepted for property writes.
 */
export function isSupportedTimezone(value: string | null | undefined): boolean {
  if (!value) return false;
  return SUPPORTED_ID_SET.has(value.trim());
}

/**
 * Resolves the initial timezone for the create-property form.
 *
 * Priority:
 * 1. First existing property timezone in the organization (when supported)
 * 2. America/New_York for the pilot organization (and as the general fallback)
 */
export function resolveDefaultPropertyTimezone(input: {
  organizationId: number | null;
  existingPropertyTimezones: string[];
}): string {
  for (const timezone of input.existingPropertyTimezones) {
    if (isSupportedTimezone(timezone)) {
      return timezone.trim();
    }
  }

  // Pilot defaults to Eastern; other orgs without properties use the same
  // safe fallback until property-specific defaults are configured.
  return DEFAULT_PROPERTY_TIMEZONE;
}

/** Case-insensitive filter for the searchable timezone control. */
export function filterSupportedTimezones(query: string): SupportedTimezone[] {
  const needle = query.trim().toLowerCase();
  if (!needle) return [...SUPPORTED_TIMEZONES];

  return SUPPORTED_TIMEZONES.filter((zone) => {
    const haystack = `${zone.label} ${zone.id}`.toLowerCase();
    return haystack.includes(needle);
  });
}
