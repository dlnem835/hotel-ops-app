import type { InspectionProgram } from "@/app/inspections/lib/inspection-types";
import type { InspectionReportVariant } from "@/app/reports/lib/inspection-report-sample-data";

export type InspectionReportFilters = {
  propertyName: string;
  type: string;
  associate: string;
  inspector: string;
  dateStart: string;
  dateEnd: string;
};

export type InspectionReportSourceSession = {
  id: number;
  areaId: number;
  areaName: string;
  inspectionProgram: InspectionProgram;
  templateName: string;
  inspectorId: string | null;
  associateId: string | null;
  inspectorName: string;
  associateName: string;
  startedAt: string;
  completedAt: string;
  completedBy: string | null;
  scorePercent: number | null;
  failedItemCount: number;
  durationMs: number | null;
  durationLabel: string | null;
};

export type InspectionReportSourceFailedItem = {
  id: number;
  sessionId: number;
  areaId: number;
  areaName: string;
  categoryKey: string;
  categoryLabel: string;
  itemKey: string;
  itemLabel: string;
  itemNotes: string | null;
  inspectorName: string;
  associateName: string;
  completedAt: string;
  scorePercent: number | null;
  inspectionProgram: InspectionProgram;
  templateName: string;
};

export type InspectionReportSourceRoom = {
  id: number;
  name: string;
  status: string;
  inspectionEnabled: boolean;
};

export type InspectionReportSource = {
  variant: InspectionReportVariant;
  sessions: InspectionReportSourceSession[];
  failedItems: InspectionReportSourceFailedItem[];
  guestRooms: InspectionReportSourceRoom[];
  associateOptions: string[];
  inspectorOptions: string[];
};

export type InspectionAssociateRankingRow = {
  rank: number;
  associateId: string;
  associateName: string;
  completedCount: number;
  completedPercent: number;
  averageScore: number | null;
  failedItemCount: number;
  averageTimeLabel: string | null;
  averageTimeMs: number | null;
};

export type InspectionAverageTimeSessionRow = {
  sessionId: number;
  roomNumber: string;
  inspectionType: string;
  startedAt: string;
  startedAtSortIso: string;
  completedAt: string;
  completedAtSortIso: string;
  durationLabel: string | null;
  durationMs: number | null;
  scorePercent: number | null;
};

export type InspectionAverageTimeGroupRow = {
  inspectorId: string;
  inspectorName: string;
  completedCount: number;
  averageTimeLabel: string | null;
  averageTimeMs: number | null;
  sessions: InspectionAverageTimeSessionRow[];
};

export type InspectionRoomsDoneRow = {
  sessionId: number;
  roomNumber: string;
  inspectionType: string;
  inspectorName: string;
  associateName: string;
  scorePercent: number | null;
  failedItemCount: number;
  completedAt: string;
  completedAtSortIso: string;
  durationLabel: string | null;
  durationMs: number | null;
};

export type InspectionRoomsNotDoneRow = {
  areaId: number;
  roomNumber: string;
  lastDate: string | null;
  lastDateSortIso: string | null;
  lastInspectorName: string | null;
  daysSinceLast: number | null;
  statusLabel: string;
};

export type InspectionFailedOccurrenceDetailRow = {
  sessionId: number;
  roomNumber: string;
  categoryKey: string;
  itemKey: string;
  itemLabel: string;
  sectionLabel: string;
  inspectorName: string;
  associateName: string;
  scorePercent: number | null;
  completedAt: string;
  completedAtSortIso: string;
  notes: string;
};

export type InspectionFailedSectionGroupRow = {
  sectionKey: string;
  sectionLabel: string;
  totalFailures: number;
  items: InspectionFailedOccurrenceDetailRow[];
};

export type InspectionFailedItemGroupRow = {
  groupKey: string;
  itemLabel: string;
  sectionLabel: string;
  displayLabel: string;
  totalFailures: number;
  items: InspectionFailedOccurrenceDetailRow[];
};

/** @deprecated Use InspectionFailedOccurrenceDetailRow */
export type InspectionFailedSectionDetailRow = InspectionFailedOccurrenceDetailRow;

/** @deprecated Flat failed-item rows replaced by InspectionFailedItemGroupRow */
export type InspectionFailedItemRow = InspectionFailedOccurrenceDetailRow & {
  id: string;
};

export type InspectionInspectorShareRow = {
  inspectorId: string;
  inspectorName: string;
  roomCount: number;
  percent: number;
};

export type InspectionScoresByRoomSessionRow = {
  sessionId: number;
  inspectionType: string;
  inspectorName: string;
  scorePercent: number | null;
  failedItemCount: number;
  completedAt: string;
  completedAtSortIso: string;
  durationLabel: string | null;
  durationMs: number | null;
};

export type InspectionScoresByRoomGroupRow = {
  areaId: number;
  roomNumber: string;
  inspectionCount: number;
  latestScore: number | null;
  averageScore: number | null;
  lowestScore: number | null;
  failedItemTotal: number;
  lastInspectionDate: string | null;
  lastInspectionDateSortIso: string | null;
  sessions: InspectionScoresByRoomSessionRow[];
};
