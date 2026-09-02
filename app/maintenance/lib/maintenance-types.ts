import { InspectionPeriod } from "@/app/inspections/lib/inspection-types";
import type { PmAssignmentType, PmStepOutcome } from "./pm-types";
import {
  WorkOrderCategory,
} from "./work-order-categories";

export type WorkOrderPriority = "Normal" | "Important" | "Urgent";

export type WorkOrderStatus = "Open" | "In Progress" | "Completed" | "Cancelled";

export const WORK_ORDER_PHOTO_ACTIVE_STATUSES: WorkOrderStatus[] = [
  "Open",
  "In Progress",
];

export function isWorkOrderPhotoAddableStatus(
  status: WorkOrderStatus | string
): boolean {
  return WORK_ORDER_PHOTO_ACTIVE_STATUSES.includes(status as WorkOrderStatus);
}

export type WorkOrderPhoto = {
  id: number;
  workOrderId: number;
  photoUrl: string;
  storagePath: string | null;
  uploadedBy: string | null;
  /** UI-only label resolved from team member first name */
  uploadedByLabel?: string | null;
  uploadedAt: string;
};

export type WorkOrderSourceModule =
  | "Maintenance"
  | "Inspections"
  | "Room Inspection"
  | "RPM Inspection"
  | "Preventive Maintenance"
  | "Pass-On Log"
  | "Housekeeping";

export type WorkOrder = {
  id: number;
  subject: string;
  description: string | null;
  priority: WorkOrderPriority;
  status: WorkOrderStatus;
  areaId: number | null;
  areaLabel: string | null;
  sourceModule: string | null;
  sourceRecordId: string | null;
  sourceNote: string | null;
  comments: string | null;
  photoUrl: string | null;
  resolutionPhotoUrl: string | null;
  /** Additional photos added after create (append-only). */
  photos?: WorkOrderPhoto[];
  category: WorkOrderCategory | null;
  item: string | null;
  createdBy: string | null;
  /** UI-only label resolved from team member first name */
  createdByLabel?: string | null;
  createdAt: string;
  updatedAt: string;
  commentsUpdatedAt: string | null;
  completedAt: string | null;
  completedBy: string | null;
  /** UI-only label resolved from team member first name */
  completedByLabel?: string | null;
};

export type WorkOrderInput = {
  subject: string;
  description?: string | null;
  priority?: WorkOrderPriority;
  status?: WorkOrderStatus;
  area_id?: number | null;
  area_label?: string | null;
  source_module?: string | null;
  source_record_id?: string | null;
  source_note?: string | null;
  comments?: string | null;
  photo_url?: string | null;
  resolution_photo_url?: string | null;
  category?: WorkOrderCategory | null;
  item?: string | null;
  created_by?: string | null;
  completed_by?: string | null;
};

export type PmTileUrgency =
  | "past_due"
  | "due_today"
  | "due_tomorrow"
  | "upcoming"
  | "current"
  | "completed";

export type PmCycleStatus = "completed" | "missed" | "due" | "upcoming";

export type PmCycleEntry = {
  label: string;
  dueDate: string;
  status: PmCycleStatus;
};

export type PmCycleHistory = {
  entries: PmCycleEntry[];
  completedCount: number;
  totalCount: number;
  summaryLabel: string;
};

export type PmTileLocation = {
  assignmentId: number;
  areaName: string | null;
  assetLabel: string | null;
  nextDueDate: string | null;
  urgency: PmTileUrgency;
  occurrenceId: number | null;
  targetOutcome: PmTargetOutcome | null;
  completed: boolean;
  inProgress: boolean;
  lastCompletedAt: string | null;
  lastCompletedBy: string | null;
};

export type PmTile = {
  key: string;
  assignmentId: number;
  templateId: number;
  assignmentType: PmAssignmentType;
  templateName: string;
  areaName: string | null;
  assetLabel: string | null;
  frequency: string;
  frequencyLabel: string;
  nextDueDate: string | null;
  urgency: PmTileUrgency;
  dueLabel: string;
  dueStatusLine: string;
  occurrenceId: number | null;
  estimatedMinutes: number | null;
  lastCompletedAt: string | null;
  lastCompletedBy: string | null;
  /** UI-only label resolved from team member first name */
  lastCompletedByLabel?: string | null;
  cycleHistory: PmCycleHistory;
  locations?: PmTileLocation[];
  locationCount?: number;
  completedLocationCount?: number;
};

export type PmPriorityQueueItem = {
  assignmentId: number;
  templateId: number;
  templateName: string;
  areaName: string | null;
  assetLabel: string | null;
  nextDueDate: string | null;
  urgency: PmTileUrgency;
  dueLabel: string;
  occurrenceId: number | null;
};

export const PM_COMPLIANCE_PERIODS = ["mtd", "qtd", "ytd"] as const;

export type PmCompliancePeriod = (typeof PM_COMPLIANCE_PERIODS)[number];

export type PmPeriodPerformance = {
  completionRate: number;
  onTimeRate: number | null;
};

export type PmHealthStatus = "healthy" | "needs_attention" | "critical";

export type PmHealthSummary = {
  status: PmHealthStatus;
  currentPms: number;
  completedOnTime: number;
  completedLate: number;
  pastDueCount: number;
  missedCount: number;
};

export type EngineeringPerformance = {
  pmHealth: PmHealthSummary;
  performanceByPeriod: Record<PmCompliancePeriod, PmPeriodPerformance>;
  completedMtd: number;
  completedByPeriod: Record<PmCompliancePeriod, number>;
  completedByKpiPeriod: Record<InspectionPeriod, number>;
  pastDueCount: number;
  failedPmItems: number;
  workOrdersClosedMtd: number;
};

export type MaintenanceMetrics = {
  openWorkOrders: number;
  pastDuePms: number;
  dueTodayPms: number;
  dueTomorrowPms: number;
  upcomingThisWeekPms: number;
  totalOpenPms: number;
  completedMtd: number;
  compliancePercent: number;
};

export type MaintenanceDashboardPayload = {
  metrics: MaintenanceMetrics;
  engineeringPerformance: EngineeringPerformance;
  workOrders: WorkOrder[];
  pmTiles: PmTile[];
  pmPriorityQueue: PmPriorityQueueItem[];
};

export type PmOccurrenceStepResponse = {
  stepKey: string;
  outcome: "pass" | "fail" | "na";
  notes?: string;
  photoUrl?: string | null;
};

export type PmOccurrenceResponses = {
  steps: PmOccurrenceStepResponse[];
  targetOutcome?: PmStoredTargetOutcome | null;
  targetNotes?: string;
  targetPhotoUrl?: string | null;
  sharedChecklistPrimary?: boolean;
};

export type PmTargetOutcome = PmStepOutcome;
export type PmStoredTargetOutcome =
  | PmTargetOutcome
  | "complete"
  | "issue_found";

export type PmOccurrence = {
  id: number;
  templateId: number;
  assignmentId: number;
  dueDate: string;
  status: "open" | "completed" | "missed";
  responses: PmOccurrenceResponses;
  sessionNotes: string | null;
  startedAt: string | null;
  completedAt: string | null;
  completedBy: string | null;
  createdAt: string;
  createdBy: string | null;
  lastSavedAt: string | null;
  lastSavedBy: string | null;
};
