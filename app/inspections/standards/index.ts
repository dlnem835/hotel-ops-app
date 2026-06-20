import {
  countContentItems,
  countContentPoints,
  standardToPropertyContent,
} from "./builders";
import { HK_VACANT_READY } from "./hk-vacant-ready";
import { RPM_GUEST_ROOM } from "./rpm-guest-room";
import {
  StandardTemplateDefinition,
  StandardTemplateSummary,
} from "./types";

export {
  countContentItems,
  countContentPoints,
  getLocalized,
  standardToPropertyContent,
} from "./builders";
export type {
  LocalizedText,
  PropertyCategory,
  PropertyInspectionTemplate,
  PropertyItem,
  PropertyTemplateContent,
  StandardTemplateDefinition,
  StandardTemplateSummary,
  TemplateLanguage,
  TemplateStatus,
  TemplateType,
} from "./types";

export const STANDARD_TEMPLATE_LIBRARY: StandardTemplateDefinition[] = [
  HK_VACANT_READY,
  RPM_GUEST_ROOM,
];

export const STANDARD_TEMPLATE_MAP: Record<string, StandardTemplateDefinition> =
  Object.fromEntries(
    STANDARD_TEMPLATE_LIBRARY.map((entry) => [entry.key, entry])
  );

export function getStandardTemplate(key: string): StandardTemplateDefinition | undefined {
  return STANDARD_TEMPLATE_MAP[key];
}

export function getStandardSummaries(): StandardTemplateSummary[] {
  return STANDARD_TEMPLATE_LIBRARY.map((entry) => {
    const content = standardToPropertyContent(entry);
    return {
      key: entry.key,
      version: entry.version,
      name: entry.name,
      templateType: entry.templateType,
      description: entry.description,
      categoryCount: entry.categories.length,
      itemCount: countContentItems(content),
      totalPoints: countContentPoints(content),
    };
  });
}

export function getStandardVersion(key: string): string | null {
  return STANDARD_TEMPLATE_MAP[key]?.version ?? null;
}

/** Map legacy display names to standard keys for migration. */
export const LEGACY_NAME_TO_KEY: Record<string, string> = {
  "housekeeping vacant ready": "hk-vacant-ready",
  "rpm guest room": "rpm-guest-room",
  rpm: "rpm-guest-room",
};

export function resolveStandardKeyFromName(name: string): string | null {
  return LEGACY_NAME_TO_KEY[name.trim().toLowerCase()] ?? null;
}
