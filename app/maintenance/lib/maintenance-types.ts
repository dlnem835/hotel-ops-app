import {
  WorkOrderCategory,
} from "./work-order-categories";

export type WorkOrderPriority = "Normal" | "Important" | "Urgent";

export type WorkOrderStatus = "Open" | "In Progress" | "Completed" | "Cancelled";

export type WorkOrderSourceModule =
  | "Maintenance"
  | "Inspections"
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
  category: WorkOrderCategory | null;
  item: string | null;
  createdBy: string | null;
  /** UI-only label resolved from team member first name */
  createdByLabel?: string | null;
  createdAt: string;
  updatedAt: string;
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

export type PmTile = {
  key: string;
  assignmentId: number;
  templateId: number;
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
};

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
