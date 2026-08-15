export const WORK_ORDER_ITEM_ISSUES = [
  "AC / HVAC",
  "Appliance",
  "Bed / Furniture",
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

// Specific equipment and symptoms come before broad trade names.
const CLASSIFICATION_RULES: ClassificationRule[] = [
  {
    result: "Exit Sign",
    patterns: [/\bexit\s*(?:sign|light|lighting)\b/i],
  },
  {
    result: "AC / HVAC",
    patterns: [
      /\bhvac\b/i,
      /\ba\/?c\b/i,
      /\bair\s*condition(?:er|ing)?\b/i,
      /\bptac\b/i,
      /\bheat(?:er|ing)?\b/i,
      /\bthermostat\b/i,
      /\bnot\s+cool(?:ing)?\b/i,
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
    patterns: [/\b(?:hot\s+water|water\s+heater|no\s+hot\s+water|water\s+not\s+hot)\b/i],
  },
  {
    result: "Internet / Wi-Fi",
    patterns: [/\b(?:wi-?fi|internet|network|router)\b/i],
  },
  {
    result: "Fire / Life Safety",
    patterns: [
      /\b(?:fire|smoke\s+detector|sprinkler|extinguisher|life\s+safety|carbon\s+monoxide|co\s+detector)\b/i,
    ],
  },
  {
    result: "Pool / Spa",
    patterns: [/\b(?:pool|spa|hot\s+tub|jacuzzi)\b/i],
  },
  {
    result: "Refrigerator",
    patterns: [/\b(?:refrigerator|fridge|mini\s*fridge)\b/i],
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
      /\b(?:light|lighting|lamp|bulb|sconce|light\s+fixture|vanity\s+light|headboard\s+light|recessed\s+light|welcome\s+light|flicker|flickering)\b/i,
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
    patterns: [/\b(?:plumbing|pipe|pipes|shower|tub|bathtub)\b/i],
  },
  {
    result: "Appliance",
    patterns: [
      /\b(?:appliance|microwave|dishwasher|washer|dryer|coffee\s*maker|iron|hair\s*dryer)\b/i,
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
    patterns: [/\b(?:furniture|chair|desk|table|sofa|couch|dresser|nightstand|cabinet)\b/i],
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
 * Classification priority: structured inspection/RPM item, then descriptive
 * text, then Other. Existing valid Item / Issue values pass through unchanged.
 */
export function classifyWorkOrderItemIssue(input: {
  structuredItem?: string | null;
  description?: string | null;
  details?: string | null;
}): WorkOrderItemIssue {
  const structured = String(input.structuredItem || "").trim();
  if (isWorkOrderItemIssue(structured)) return structured;
  return (
    classifyText(structured) ||
    classifyText([input.description, input.details].filter(Boolean).join(" ")) ||
    "Other"
  );
}
