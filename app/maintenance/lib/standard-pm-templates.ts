import type {
  PmAppliesTo,
  PmAssignmentType,
  PmCategory,
  PmChecklist,
  PmFrequency,
} from "@/app/maintenance/lib/pm-types";
import librarySnapshot from "@/app/maintenance/lib/standard-pm-library.snapshot.json";

export type StandardPmDefaultItem = {
  name: string;
  areaName?: string;
};

export type StandardPmTemplateDefinition = {
  key: string;
  name: string;
  description: string;
  category: PmCategory;
  frequency: PmFrequency;
  checklist: PmChecklist;
  /**
   * Days after Add Standard PMs activation (Day 0) when this PM's
   * initial start_date should begin. Future cycles use frequency.
   */
  startOffsetDays: number;
  estimatedMinutes?: number | null;
  assignedRole?: string | null;
  appliesTo?: PmAppliesTo;
  defaultAreaName?: string;
  defaultAreaNames?: readonly string[];
  defaultNamedLocations?: readonly string[];
  assignmentType?: PmAssignmentType;
  defaultUnits?: readonly string[];
  /** Named items with optional per-item location mapping for library seeding. */
  defaultItems?: readonly StandardPmDefaultItem[];
  legacyNames?: readonly string[];
};

type SnapshotTemplate = {
  key: string;
  name: string;
  description: string;
  category: string;
  frequency: string;
  estimatedMinutes?: number | null;
  assignedRole?: string | null;
  appliesTo?: string;
  startOffsetDays: number;
  defaultItems?: StandardPmDefaultItem[];
  checklist: PmChecklist;
  legacyNames?: string[];
};

type StandardPmLibrarySnapshot = {
  sourcePropertyName: string;
  sourcePropertyId: number;
  sourceOrganizationId: number;
  dayZeroSourceDate: string;
  capturedAt: string;
  templateCount: number;
  templates: SnapshotTemplate[];
};

const snapshot = librarySnapshot as StandardPmLibrarySnapshot;

export const STANDARD_PM_LIBRARY_META = {
  sourcePropertyName: snapshot.sourcePropertyName,
  sourcePropertyId: snapshot.sourcePropertyId,
  sourceOrganizationId: snapshot.sourceOrganizationId,
  dayZeroSourceDate: snapshot.dayZeroSourceDate,
  capturedAt: snapshot.capturedAt,
} as const;

/**
 * Platform-level Standard PM Library.
 * Snapshot of SpringHill Suites configuration with relative Day-0 offsets.
 * Property copies are independent; editing a property never mutates this library.
 */
export const STANDARD_PM_TEMPLATES: readonly StandardPmTemplateDefinition[] =
  snapshot.templates.map((template) => ({
    key: template.key,
    name: template.name,
    description: template.description,
    category: template.category as PmCategory,
    frequency: template.frequency as PmFrequency,
    checklist: template.checklist,
    startOffsetDays: Number(template.startOffsetDays) || 0,
    estimatedMinutes: template.estimatedMinutes ?? null,
    assignedRole: template.assignedRole ?? "Maintenance",
    appliesTo: (template.appliesTo as PmAppliesTo | undefined) ?? "asset",
    defaultItems: template.defaultItems ?? [],
    legacyNames: template.legacyNames ?? [],
  }));

/** Local calendar date YYYY-MM-DD for Standard PM package activation (Day 0). */
export function getStandardPmActivationDate(now = new Date()): string {
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/** Add whole days to an ISO date-only string (UTC calendar arithmetic). */
export function addDaysToIsoDate(isoDate: string, days: number): string {
  const date = new Date(`${isoDate}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) {
    throw new Error(`Invalid ISO date: ${isoDate}`);
  }
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function resolveStandardPmStartDate(
  template: Pick<StandardPmTemplateDefinition, "startOffsetDays">,
  activationDayZero: string
): string {
  return addDaysToIsoDate(activationDayZero, template.startOffsetDays || 0);
}
