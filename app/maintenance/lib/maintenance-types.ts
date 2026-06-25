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
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
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
  created_by?: string | null;
};

export type PmTileUrgency =
  | "past_due"
  | "due_today"
  | "due_tomorrow"
  | "upcoming"
  | "current"
  | "completed";

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

export type EngineeringPerformance = {
  performanceByPeriod: Record<PmCompliancePeriod, PmPeriodPerformance>;
  completedMtd: number;
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
  status: "open" | "completed";
  responses: PmOccurrenceResponses;
  sessionNotes: string | null;
  startedAt: string | null;
  completedAt: string | null;
  completedBy: string | null;
  createdAt: string;
};
