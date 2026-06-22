export const PM_CATEGORIES = [
  "Building",
  "Mechanical",
  "Life Safety",
  "Pool",
  "Guest Room",
  "Public Area",
  "Exterior",
  "Equipment",
  "Custom",
] as const;

export const PM_FREQUENCIES = [
  "daily",
  "weekly",
  "biweekly",
  "monthly",
  "quarterly",
  "triannually",
  "semiannually",
  "yearly",
] as const;

export const PM_FREQUENCY_LABELS: Record<PmFrequency, string> = {
  daily: "Daily",
  weekly: "Weekly",
  biweekly: "Bi-weekly",
  monthly: "Monthly",
  quarterly: "Quarterly",
  triannually: "Triannually",
  semiannually: "Semi-annually",
  yearly: "Yearly",
};

export const PM_FREQUENCY_ORDER: Record<PmFrequency, number> = {
  daily: 0,
  weekly: 1,
  biweekly: 2,
  monthly: 3,
  quarterly: 4,
  triannually: 5,
  semiannually: 6,
  yearly: 7,
};

export const PM_APPLIES_TO = [
  "entire_property",
  "asset",
  "room",
  "public_area",
  "exterior_area",
] as const;

export const PM_APPLIES_TO_LABELS: Record<PmAppliesTo, string> = {
  entire_property: "Entire Property",
  asset: "Asset",
  room: "Room",
  public_area: "Public Area",
  exterior_area: "Exterior Area",
};

export const PM_TEMPLATE_STATUSES = ["Active", "Inactive"] as const;

export const PM_ASSIGNED_ROLES = [
  "Management",
  "Maintenance",
  "RPM/Maintenance",
  "Housekeeping",
  "Front Desk",
] as const;

export type PmCategory = (typeof PM_CATEGORIES)[number];
export type PmFrequency = (typeof PM_FREQUENCIES)[number];
export type PmAppliesTo = (typeof PM_APPLIES_TO)[number];
export type PmTemplateStatus = (typeof PM_TEMPLATE_STATUSES)[number];

export type PmChecklistStep = {
  key: string;
  label: string;
  required: boolean;
  photoRequiredOnFail: boolean;
  sortOrder: number;
};

export type PmChecklistCategory = {
  key: string;
  name: string;
  sortOrder: number;
  steps: PmChecklistStep[];
};

export type PmChecklist = {
  categories: PmChecklistCategory[];
};

export type PmScheduleAssignment = {
  id: number;
  template_id: number;
  area_id: number | null;
  asset_label: string | null;
  start_date: string;
  end_date: string | null;
  status: PmTemplateStatus;
  created_at: string;
};

export type PmTemplate = {
  id: number;
  name: string;
  description: string | null;
  category: PmCategory;
  frequency: PmFrequency;
  estimated_minutes: number | null;
  assigned_role: string | null;
  assigned_member_id: string | null;
  applies_to: PmAppliesTo;
  checklist: PmChecklist;
  status: PmTemplateStatus;
  created_at: string;
  updated_at: string;
};

export type PmDueStatus = "missing" | "current" | "due_soon" | "overdue" | "inactive";

export type PmAssignmentSchedule = {
  assignmentId: number;
  templateId: number;
  templateName: string;
  frequency: PmFrequency;
  category: PmCategory;
  areaId: number | null;
  areaName: string | null;
  assetLabel: string | null;
  startDate: string;
  endDate: string | null;
  nextDueDate: string | null;
  dueStatus: PmDueStatus;
  templateStatus: PmTemplateStatus;
  assignmentStatus: PmTemplateStatus;
  estimatedMinutes: number | null;
  assignedRole: string | null;
};

export type AreaPmGridSummary = {
  areaId: number;
  areaName: string;
  areaType: string;
  assignedCount: number;
  nextDueDate: string | null;
  overdueCount: number;
  marker: "none" | "due_soon" | "overdue" | "missing";
};

export type PmTemplateInput = {
  name: string;
  description?: string | null;
  category: PmCategory;
  frequency: PmFrequency;
  estimated_minutes?: number | null;
  assigned_role?: string | null;
  assigned_member_id?: string | null;
  applies_to: PmAppliesTo;
  checklist: PmChecklist;
  status?: PmTemplateStatus;
  assignment: {
    area_id?: number | null;
    asset_label?: string | null;
    start_date: string;
    end_date?: string | null;
    status?: PmTemplateStatus;
  };
};
