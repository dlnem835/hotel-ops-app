/**
 * Display-only property labels for compact UI (sidebar selector).
 * Does not alter stored `properties.name` used for auth, reporting, or search.
 */

export type PropertyDisplayLabels = {
  /** Full official property name (unchanged). */
  fullName: string;
  /** Brand / product line shown as the primary closed-card line. */
  primary: string;
  /** Location / market shown as the secondary closed-card line. */
  secondary: string | null;
};

type PropertyDisplayInput = {
  name: string;
  brand?: string | null;
};

/** Normalize for fuzzy matching of known hotels. */
function normalizePropertyKey(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Explicit presentation mappings for current One Eyrie hotels.
 * Keys are normalized forms of likely stored official names.
 */
const EXPLICIT_DISPLAY_BY_NAME: Record<
  string,
  { primary: string; secondary: string }
> = {
  "marriott courtyard port st lucie tradition": {
    primary: "Courtyard by Marriott",
    secondary: "Port St. Lucie Tradition",
  },
  "courtyard by marriott port st lucie tradition": {
    primary: "Courtyard by Marriott",
    secondary: "Port St. Lucie Tradition",
  },
  "courtyard marriott port st lucie tradition": {
    primary: "Courtyard by Marriott",
    secondary: "Port St. Lucie Tradition",
  },
  "springhill suites tampa suncoast parkway": {
    primary: "SpringHill Suites",
    secondary: "Tampa Suncoast Parkway",
  },
  "springhill suites by marriott tampa suncoast parkway": {
    primary: "SpringHill Suites",
    secondary: "Tampa Suncoast Parkway",
  },
};

const KNOWN_BRAND_PREFIXES = [
  "Courtyard by Marriott",
  "SpringHill Suites by Marriott",
  "SpringHill Suites",
  "Residence Inn by Marriott",
  "Fairfield by Marriott",
  "TownePlace Suites by Marriott",
  "AC Hotel by Marriott",
  "Marriott",
  "Hilton Garden Inn",
  "Hampton Inn",
  "Homewood Suites",
  "Holiday Inn Express",
  "Holiday Inn",
] as const;

function splitAfterKnownBrand(name: string): PropertyDisplayLabels | null {
  const trimmed = name.trim();
  for (const brand of KNOWN_BRAND_PREFIXES) {
    if (trimmed.toLowerCase().startsWith(brand.toLowerCase())) {
      const rest = trimmed.slice(brand.length).trim();
      if (!rest) {
        return { fullName: trimmed, primary: brand, secondary: null };
      }
      return { fullName: trimmed, primary: brand, secondary: rest };
    }
  }
  return null;
}

function splitNearMidpoint(name: string): PropertyDisplayLabels {
  const trimmed = name.trim();
  const words = trimmed.split(/\s+/).filter(Boolean);
  if (words.length < 2) {
    return { fullName: trimmed, primary: trimmed, secondary: null };
  }

  const mid = Math.ceil(words.length / 2);
  return {
    fullName: trimmed,
    primary: words.slice(0, mid).join(" "),
    secondary: words.slice(mid).join(" "),
  };
}

/**
 * Derives compact primary/secondary labels for the closed property selector.
 * Prefer explicit mappings, then `brand` + remainder of name, then heuristics.
 */
export function getPropertyDisplayLabels(
  property: PropertyDisplayInput
): PropertyDisplayLabels {
  const fullName = property.name.trim();
  if (!fullName) {
    return { fullName: property.name, primary: property.name, secondary: null };
  }

  const explicit = EXPLICIT_DISPLAY_BY_NAME[normalizePropertyKey(fullName)];
  if (explicit) {
    return {
      fullName,
      primary: explicit.primary,
      secondary: explicit.secondary,
    };
  }

  const brand = property.brand?.trim() || null;
  if (brand) {
    const normalizedFull = normalizePropertyKey(fullName);
    const normalizedBrand = normalizePropertyKey(brand);
    if (
      normalizedFull.startsWith(normalizedBrand) &&
      normalizedFull.length > normalizedBrand.length
    ) {
      // Strip brand tokens from the front of the official name for the location line.
      const brandWordCount = brand.split(/\s+/).filter(Boolean).length;
      const nameWords = fullName.split(/\s+/).filter(Boolean);
      const secondary = nameWords.slice(brandWordCount).join(" ").trim();
      return {
        fullName,
        primary: brand,
        secondary: secondary || null,
      };
    }

    // Brand present but not a prefix — still use brand as primary when useful.
    if (!normalizedFull.includes(normalizedBrand)) {
      return { fullName, primary: brand, secondary: fullName };
    }
  }

  return splitAfterKnownBrand(fullName) ?? splitNearMidpoint(fullName);
}
