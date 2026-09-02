export const WORK_ORDER_ITEM_ISSUES = [
  "AC / HVAC",
  "Appliance",
  "Bed / Furniture",
  "Bathroom Door",
  "Boiler / Water Heater",
  "Bugs / Pest",
  "Carpet / Flooring",
  "Ceiling",
  "Door",
  "Drain",
  "Electrical",
  "Elevator",
  "Exit Sign",
  "Fire / Life Safety",
  "Furniture",
  "Hot Water",
  "Internet / Wi-Fi",
  "Leak / Water",
  "Light",
  "Lock / Key",
  "Odor / Smell",
  "Plumbing",
  "Pool / Spa",
  "Refrigerator",
  "Shower Door",
  "Sink",
  "Toilet",
  "TV",
  "Wall / Wallpaper",
  "Window",
  "Other",
] as const;

export type WorkOrderItemIssue = (typeof WORK_ORDER_ITEM_ISSUES)[number];

export function isWorkOrderItemIssue(value: string): value is WorkOrderItemIssue {
  return (WORK_ORDER_ITEM_ISSUES as readonly string[]).includes(value);
}

type ClassificationRule = {
  result: WorkOrderItemIssue;
  patterns: RegExp[];
};

/**
 * Exact / near-exact source labels (PM templates, equipment names, inspection
 * topics) → catalog. Prefer these over keyword regex so PM library names land
 * on reusable operational categories instead of "Other" or duplicates.
 */
const SOURCE_ITEM_ALIASES: Record<string, WorkOrderItemIssue> = {
  // HVAC
  "ac / hvac": "AC / HVAC",
  hvac: "AC / HVAC",
  "ac unit": "AC / HVAC",
  "a/c unit": "AC / HVAC",
  ptac: "AC / HVAC",
  "ptac / ac unit": "AC / HVAC",
  "public space ac units": "AC / HVAC",
  "rooftop units": "AC / HVAC",
  "rooftop exhausts": "AC / HVAC",
  "rooftop exhaust": "AC / HVAC",
  rtu: "AC / HVAC",

  // Boiler / water heater equipment
  "boiler / water heater": "Boiler / Water Heater",
  "boilers / water heaters": "Boiler / Water Heater",
  "boiler/water heater": "Boiler / Water Heater",
  "boiler/water heater room": "Boiler / Water Heater",
  "boilers / water heaters room": "Boiler / Water Heater",
  "water heater": "Boiler / Water Heater",
  "water heaters": "Boiler / Water Heater",
  boiler: "Boiler / Water Heater",
  boilers: "Boiler / Water Heater",

  // Pool equipment → Pool / Spa (reusable category)
  "pool equipment": "Pool / Spa",
  "pool pump": "Pool / Spa",
  "pool circulation pump": "Pool / Spa",
  "pool filter": "Pool / Spa",
  "pool heater": "Pool / Spa",
  "chlorine feeders": "Pool / Spa",
  "chlorine feeder": "Pool / Spa",
  pool: "Pool / Spa",
  spa: "Pool / Spa",

  // Lighting
  light: "Light",
  lighting: "Light",
  "lighting & signage": "Light",
  "lighting and signage": "Light",
  "recessed light": "Light",
  "ceiling lamp": "Light",
  "floor lamp": "Light",
  lamp: "Light",
  "emergency lights": "Fire / Life Safety",
  "emergency light": "Fire / Life Safety",
  "exit sign": "Exit Sign",
  "exit signs": "Exit Sign",

  // Fire / life safety
  "fire extinguishers": "Fire / Life Safety",
  "fire extinguisher": "Fire / Life Safety",
  "fire system flow": "Fire / Life Safety",
  relay: "Fire / Life Safety",
  "relay / beacon devices": "Fire / Life Safety",

  // Elevator
  elevator: "Elevator",
  "elevator checklist": "Elevator",

  // Electrical
  "electrical rooms": "Electrical",
  "electrical room": "Electrical",
  electrical: "Electrical",

  // Appliances
  appliance: "Appliance",
  "ice machines": "Appliance",
  "ice machine": "Appliance",
  "juice machine": "Appliance",
  "dishwasher / sanitizer": "Appliance",
  "commercial dishwasher / sanitizer": "Appliance",
  dishwasher: "Appliance",
  "commercial dryer": "Appliance",
  "commercial washing machine": "Appliance",
  "guest dryer": "Appliance",
  "guest washer": "Appliance",
  vacuums: "Appliance",
  vacuum: "Appliance",
  "water softener": "Plumbing",

  // Refrigeration
  "refrigerators and freezers": "Refrigerator",
  refrigerator: "Refrigerator",
  freezer: "Refrigerator",
  "market cooler": "Refrigerator",
  "market freezer": "Refrigerator",
  "kitchen refrigerator": "Refrigerator",
  "bar cooler": "Refrigerator",

  // Furniture
  furniture: "Furniture",
  "outdoor furniture": "Furniture",
  "pool furniture": "Furniture",
  "fire pit furniture": "Furniture",

  // TV / IT room
  tv: "TV",
  "phone/tv/computer room": "TV",
  "phone / tv / computer room": "TV",

  // Plumbing / restrooms (area PMs often fail on fixtures → notes refine)
  "public restrooms": "Plumbing",
  "public restroom": "Plumbing",
  "employee restroom": "Plumbing",

  // Hot water symptom (guest-facing) — keep distinct from boiler equipment
  "hot water": "Hot Water",
};

/** Normalize PM/inspection labels for alias lookup (#1, extra spaces, etc.). */
export function normalizeSourceItemKey(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/\s*#\s*\d+\b/g, "")
    .replace(/\brt\s*u\s*\d+\b/gi, "rtu")
    .replace(/[_/]+/g, (m) => (m.includes("/") ? " / " : " "))
    .replace(/[^a-z0-9/&\s.-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function lookupSourceAlias(value: string | null | undefined): WorkOrderItemIssue | null {
  const raw = String(value || "").trim();
  if (!raw) return null;

  if (isWorkOrderItemIssue(raw)) return raw;

  const key = normalizeSourceItemKey(raw);
  if (SOURCE_ITEM_ALIASES[key]) return SOURCE_ITEM_ALIASES[key];

  // Prefix match for "Front Desk - AC Unit", "Kitchen Refrigerator #1", etc.
  for (const [alias, result] of Object.entries(SOURCE_ITEM_ALIASES)) {
    if (key === alias) return result;
    if (key.endsWith(` ${alias}`) || key.startsWith(`${alias} `)) return result;
    if (key.includes(` ${alias} `)) return result;
    if (key.includes(alias) && alias.length >= 8) return result;
  }

  return null;
}

// Specific equipment and symptoms come before broad trade names.
const CLASSIFICATION_RULES: ClassificationRule[] = [
  {
    result: "Exit Sign",
    patterns: [/\bexit\s*(?:sign|light|lighting)\b/i],
  },
  {
    result: "Boiler / Water Heater",
    patterns: [
      /\bboilers?\b/i,
      /\bwater\s*heaters?\b/i,
      /\bburner\s+assembly\b/i,
      /\bpressure\s+relief\s+valve\b/i,
    ],
  },
  {
    result: "Pool / Spa",
    patterns: [
      /\b(?:pool|spa|hot\s+tub|jacuzzi|chlorine\s+feeder|pool\s+pump|pool\s+filter|pool\s+heater)\b/i,
    ],
  },
  {
    result: "AC / HVAC",
    patterns: [
      /\bhvac\b/i,
      /\ba\/?c\b/i,
      /\bair\s*condition(?:er|ing)?\b/i,
      /\bptac\b/i,
      /\brtu\b/i,
      /\brooftop\s+unit\b/i,
      /\bthermostat\b/i,
      /\bnot\s+cool(?:ing)?\b/i,
      /\bnot\s+heat(?:ing)?\b/i,
      /\bspace\s+heater\b/i,
      /\bexhaust\s+fan\b/i,
    ],
  },
  {
    result: "Bugs / Pest",
    patterns: [
      /\b(?:bug|bugs|pest|pests|roach|roaches|cockroach|bedbug|bed\s+bug|ant|ants|rodent|mouse|mice)\b/i,
    ],
  },
  {
    result: "Odor / Smell",
    patterns: [/\b(?:odor|odour|smell|smells|smelly|stink|smoke\s+smell|musty)\b/i],
  },
  {
    result: "Leak / Water",
    patterns: [
      /\b(?:leak|leaking|leaky|water\s+damage|water\s+intrusion|dripping|flood|flooding)\b/i,
    ],
  },
  {
    result: "Hot Water",
    patterns: [/\b(?:hot\s+water|no\s+hot\s+water|water\s+not\s+hot)\b/i],
  },
  {
    result: "Internet / Wi-Fi",
    patterns: [/\b(?:wi-?fi|internet|network|router)\b/i],
  },
  {
    result: "Fire / Life Safety",
    patterns: [
      /\b(?:fire|smoke\s+detector|sprinkler|extinguisher|life\s+safety|carbon\s+monoxide|co\s+detector|emergency\s+lights?|beacon)\b/i,
    ],
  },
  {
    result: "Refrigerator",
    patterns: [/\b(?:refrigerator|fridge|mini\s*fridge|freezer|cooler)\b/i],
  },
  {
    result: "Toilet",
    patterns: [/\b(?:toilet|commode)\b/i],
  },
  {
    result: "Sink",
    patterns: [/\b(?:sink|basin|faucet)\b/i],
  },
  {
    result: "Shower Door",
    patterns: [/\bshower\s+door\b/i],
  },
  {
    result: "Bathroom Door",
    patterns: [/\bbathroom\s+door\b/i],
  },
  {
    result: "Drain",
    patterns: [/\b(?:drain|drainage|clog|clogged|backed\s+up|slow\s+drain)\b/i],
  },
  {
    result: "TV",
    patterns: [
      /\b(?:tv|television|tv\s+remote|television\s+remote|remote\s+control|cable\s+box|set[- ]top\s+box)\b/i,
    ],
  },
  {
    result: "Light",
    patterns: [
      /\b(?:light|lighting|lamp|bulb|sconce|light\s+fixture|vanity\s+light|headboard\s+light|recessed\s+light|welcome\s+light|ceiling\s+lamp|floor\s+lamp|flicker|flickering)\b/i,
    ],
  },
  {
    result: "Lock / Key",
    patterns: [/\b(?:lock|key|keycard|key\s+card|deadbolt|latch)\b/i],
  },
  {
    result: "Elevator",
    patterns: [/\b(?:elevator|lift)\b/i],
  },
  {
    result: "Electrical",
    patterns: [/\b(?:electrical|electric|outlet|receptacle|breaker|power|voltage|wiring)\b/i],
  },
  {
    result: "Plumbing",
    patterns: [
      /\b(?:plumbing|pipe|pipes|shower|tub|bathtub|water\s+softener)\b/i,
    ],
  },
  {
    result: "Appliance",
    patterns: [
      /\b(?:appliance|microwave|dishwasher|washer|dryer|washing\s+machine|coffee\s*maker|iron|hair\s*dryer|ice\s*machine|juice\s*machine|vacuum|sanitizer)\b/i,
    ],
  },
  {
    result: "Bed / Furniture",
    patterns: [/\b(?:bed|mattress|box\s+spring|headboard)\b/i],
  },
  {
    result: "Carpet / Flooring",
    patterns: [/\b(?:carpet|floor|flooring|tile|vinyl)\b/i],
  },
  {
    result: "Ceiling",
    patterns: [/\bceiling\b/i],
  },
  {
    result: "Door",
    patterns: [/\b(?:door|hinge|doorframe|door\s+frame)\b/i],
  },
  {
    result: "Wall / Wallpaper",
    patterns: [/\b(?:wall|wallpaper|drywall)\b/i],
  },
  {
    result: "Window",
    patterns: [/\b(?:window|curtain|blind|blinds|drape|drapes)\b/i],
  },
  {
    result: "Furniture",
    patterns: [
      /\bfurniture\b/i,
      /\b(?:chair|sofa|couch|dresser|nightstand|cabinet)\b/i,
      /\b(?<!front\s)desk\b/i,
      /\b(?<!front\s)table\b/i,
    ],
  },
];

function classifyText(value: string | null | undefined): WorkOrderItemIssue | null {
  const text = String(value || "").trim();
  if (!text) return null;
  for (const rule of CLASSIFICATION_RULES) {
    if (rule.patterns.some((pattern) => pattern.test(text))) {
      return rule.result;
    }
  }
  return null;
}

/**
 * Classification priority:
 * 1) already a catalog value
 * 2) explicit source alias on the structured PM/inspection label
 * 3) keyword rules on structured label
 * 4) explicit alias / keyword rules on description & details (failed notes/steps)
 * 5) Other
 *
 * Do not invent new free-text labels — always return a catalog value.
 */
export function classifyWorkOrderItemIssue(input: {
  structuredItem?: string | null;
  description?: string | null;
  details?: string | null;
}): WorkOrderItemIssue {
  const structured = String(input.structuredItem || "").trim();
  if (isWorkOrderItemIssue(structured)) return structured;

  const structuredAlias = lookupSourceAlias(structured);
  if (structuredAlias) return structuredAlias;

  const fromStructuredText = classifyText(structured);
  if (fromStructuredText) return fromStructuredText;

  const narrative = [input.description, input.details].filter(Boolean).join(" ");
  return (
    lookupSourceAlias(input.details) ||
    lookupSourceAlias(input.description) ||
    classifyText(narrative) ||
    "Other"
  );
}

/**
 * Audit helper: map a PM template (and optional default items) to catalog values.
 * Used to confirm Standard PM Library coverage for Work Order creation.
 */
export function mapPmLibraryNameToItemIssue(
  name: string
): WorkOrderItemIssue {
  return classifyWorkOrderItemIssue({ structuredItem: name });
}
