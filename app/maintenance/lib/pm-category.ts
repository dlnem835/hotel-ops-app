import { PmCategory } from "./pm-types";

export const PM_UTILITY_AREA_NAME = "Hotel / Building / Main";
export const PM_CUSTOM_AREA_VALUE = "custom";

const LIFE_SAFETY_KEYWORDS = [
  "fire",
  "exit sign",
  "emergency",
  "alarm",
  "extinguisher",
  "life safety",
  "sprinkler",
];

export function derivePmCategory(input: {
  areaType?: string | null;
  areaName?: string | null;
  customAreaLabel?: string | null;
  templateName?: string | null;
}): PmCategory {
  const customLabel = input.customAreaLabel?.trim() || "";
  const templateName = (input.templateName || "").toLowerCase();

  if (customLabel) {
    const label = customLabel.toLowerCase();
    if (LIFE_SAFETY_KEYWORDS.some((term) => label.includes(term))) {
      return "Life Safety";
    }
    return "Custom";
  }

  if (input.areaName === PM_UTILITY_AREA_NAME) {
    if (LIFE_SAFETY_KEYWORDS.some((term) => templateName.includes(term))) {
      return "Life Safety";
    }
    return "Building";
  }

  switch (input.areaType) {
    case "Mechanical":
      return "Mechanical";
    case "Exterior":
      return "Exterior";
    case "Public Area":
      return "Public Area";
    case "Guest Room":
      return "Guest Room";
    case "Back Of House":
      return "Building";
    default:
      return "Custom";
  }
}

export function sortPmAreaOptions<T extends { name: string }>(areas: T[]): T[] {
  return [...areas].sort((a, b) => {
    if (a.name === PM_UTILITY_AREA_NAME) return -1;
    if (b.name === PM_UTILITY_AREA_NAME) return 1;
    return a.name.localeCompare(b.name);
  });
}

export function formatPmAreaLabel(input: {
  areaName?: string | null;
  customAreaLabel?: string | null;
}): string {
  if (input.areaName) return input.areaName;
  if (input.customAreaLabel?.trim()) return input.customAreaLabel.trim();
  return "Unassigned area";
}
