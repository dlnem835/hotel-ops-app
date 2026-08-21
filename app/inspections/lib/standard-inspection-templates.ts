import librarySnapshot from "@/app/inspections/lib/standard-inspection-library.snapshot.json";
import type {
  StandardTemplateDefinition,
  TemplateType,
} from "@/app/inspections/standards/types";

type SnapshotCategory = {
  key: string;
  name: { en: string; es: string };
  items: Array<{
    key: string;
    label: { en: string; es: string };
    pointValue: number;
    required: boolean;
  }>;
};

type SnapshotTemplate = {
  key: string;
  version: string;
  name: string;
  templateType: string;
  description: string;
  categories: SnapshotCategory[];
};

type StandardInspectionLibrarySnapshot = {
  sourcePropertyName: string;
  sourcePropertyId: number;
  sourceOrganizationId: number;
  capturedAt: string;
  templateCount: number;
  templates: SnapshotTemplate[];
};

const snapshot = librarySnapshot as StandardInspectionLibrarySnapshot;

export const STANDARD_INSPECTION_LIBRARY_META = {
  sourcePropertyName: snapshot.sourcePropertyName,
  sourcePropertyId: snapshot.sourcePropertyId,
  sourceOrganizationId: snapshot.sourceOrganizationId,
  capturedAt: snapshot.capturedAt,
} as const;

/**
 * Platform-level Room / RPM inspection standards.
 * Snapshot of SpringHill Suites Active property templates.
 * Property copies are independent; editing a property never mutates this library.
 */
export const STANDARD_INSPECTION_TEMPLATES: readonly StandardTemplateDefinition[] =
  snapshot.templates.map((template) => ({
    key: template.key,
    version: template.version,
    name: template.name,
    templateType: template.templateType as TemplateType,
    description: template.description,
    categories: template.categories.map((category) => ({
      key: category.key,
      name: { ...category.name },
      items: category.items.map((item) => ({
        key: item.key,
        label: { ...item.label },
        pointValue: Number(item.pointValue) || 0,
        required: item.required !== false,
      })),
    })),
  }));
