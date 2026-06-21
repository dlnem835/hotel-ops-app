export const TEMPLATE_TYPES = [
  "Guest Room",
  "Public Area",
  "RPM",
  "Safety",
  "Custom",
] as const;

export const TEMPLATE_STATUSES = ["Active", "Inactive"] as const;

export type TemplateType = (typeof TEMPLATE_TYPES)[number];
export type TemplateStatus = (typeof TEMPLATE_STATUSES)[number];
export type TemplateLanguage = "en" | "es";

export type LocalizedText = {
  en: string;
  es: string;
};

export type StandardItemDef = {
  key: string;
  label: LocalizedText;
  pointValue: number;
  required: boolean;
};

export type StandardCategoryDef = {
  key: string;
  name: LocalizedText;
  items: StandardItemDef[];
};

export type StandardTemplateDefinition = {
  key: string;
  version: string;
  name: string;
  templateType: TemplateType;
  description: string;
  categories: StandardCategoryDef[];
};

export type PropertyItem = {
  key: string;
  label: LocalizedText;
  pointValue: number;
  required: boolean;
  sortOrder: number;
};

export type PropertyCategory = {
  key: string;
  name: LocalizedText;
  sortOrder: number;
  items: PropertyItem[];
};

export type PropertyTemplateContent = {
  categories: PropertyCategory[];
};

export type PropertyInspectionTemplate = {
  id: number;
  standard_key: string | null;
  based_on_standard_version: string | null;
  name: string;
  template_type: TemplateType;
  status: TemplateStatus;
  property_version: number;
  content: PropertyTemplateContent;
  last_modified_at: string;
  created_at: string;
};

export type StandardTemplateSummary = {
  key: string;
  version: string;
  name: string;
  templateType: TemplateType;
  description: string;
  categoryCount: number;
  itemCount: number;
  /** Sum of item weights if all pass; not required to equal 100. */
  totalPoints: number;
};

/** Pass earns full item weight; fail earns 0; N/A is excluded from possible points. */
export type InspectionItemOutcome = "pass" | "fail" | "na";

export type InspectionScore = {
  earnedPoints: number;
  possiblePoints: number;
  scorePercent: number | null;
};
