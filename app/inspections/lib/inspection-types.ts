export const INSPECTION_PERIODS = [
  "today",
  "wtd",
  "mtd",
  "qtd",
  "ytd",
] as const;

export const INSPECTION_PROGRAMS = [
  "VR",
  "STAYOVER",
  "DEEP_CLEAN",
  "RPM",
  "PUBLIC_AREA",
  "EXTERIOR",
  "POOL",
  "SAFETY",
  "CUSTOM",
] as const;

export const DASHBOARD_PROGRAMS = ["VR", "RPM"] as const;

export type InspectionPeriod = (typeof INSPECTION_PERIODS)[number];
export type InspectionProgram = (typeof INSPECTION_PROGRAMS)[number];
export type DashboardProgram = (typeof DASHBOARD_PROGRAMS)[number];

export type InspectionSessionStatus =
  | "draft"
  | "in_progress"
  | "completed"
  | "voided";

export type GridState = "oos" | "not_inspected" | "strong" | "watch" | "low";

export type GuestRoomRow = {
  id: number;
  name: string;
  area_type: string;
  floor_location: string;
  status: string;
  inspection_enabled: boolean;
};

export type PeriodBounds = {
  start: string;
  end: string;
};

export type RpmCycleCompliance = {
  compliancePercent: number;
  completedCount: number;
  requiredCount: number;
  remainingCount: number;
  cycleLabel: string;
  cycleNumber: number;
};

export type DashboardMetrics = {
  inspected: number;
  total: number;
  remaining: number;
  coveragePercent: number;
  averageScore: number | null;
  lowScoreRooms: number;
  vrInspected: number;
  rpmInspected: number;
  vrTotal: number;
  rpmTotal: number;
  rpmCompliance: RpmCycleCompliance;
};

export type RoomGridTile = {
  areaId: number;
  name: string;
  status: string;
  gridState: GridState;
  scorePercent: number | null;
  lastCompletedAt: string | null;
  operationalLastCompletedAt: string | null;
  neverInspectedForProgram: boolean;
  openDeficiencyCount: number;
  neverInspectedInPeriod: boolean;
  inspectorName: string | null;
  associateName: string | null;
  inspectionType: string | null;
};

export type InspectorRanking = {
  inspectorId: string;
  name: string;
  inspectionCount: number;
};

export type HousekeeperRanking = {
  associateId: string;
  name: string;
  roomsInspected: number;
  averageScore: number | null;
  coveragePercent: number;
};

export type PriorityQueueItem = {
  areaId: number;
  name: string;
  lastCompletedAt: string | null;
  daysSinceInspection: number | null;
  neverInspected: boolean;
};

export type InspectionSession = {
  id: number;
  area_id: number;
  template_id: number;
  inspection_program: InspectionProgram;
  status: InspectionSessionStatus;
  inspector_id: string | null;
  associate_id: string | null;
  started_at: string;
  completed_at: string | null;
  completed_by: string | null;
  earned_points: number;
  possible_points: number;
  score_percent: number | null;
  failed_item_count: number;
  session_notes: string | null;
  template_snapshot: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

export type InspectionItemResponse = {
  id: number;
  inspection_id: number;
  category_key: string;
  item_key: string;
  label_snapshot: { en?: string; es?: string };
  point_value: number;
  required: boolean;
  outcome: "pass" | "fail" | "na";
  points_earned: number;
  item_notes: string | null;
  photo_url: string | null;
  sort_order: number;
};

export type FailedItemHistory = {
  categoryKey: string;
  itemKey: string;
  label: string;
  itemNotes: string | null;
  photoUrl: string | null;
};

export type RoomHistoryEntry = {
  id: number;
  inspection_program: InspectionProgram;
  completed_at: string;
  score_percent: number | null;
  earned_points: number;
  possible_points: number;
  inspector_name: string | null;
  associate_name: string | null;
  failed_item_count: number;
  template_name: string;
  failedItems: FailedItemHistory[];
};

export type DashboardPayload = {
  period: InspectionPeriod;
  program: DashboardProgram;
  periodBounds: PeriodBounds;
  metrics: DashboardMetrics;
  rooms: RoomGridTile[];
  priorityQueue: PriorityQueueItem[];
  housekeeperRankings: HousekeeperRanking[];
  topInspectors: InspectorRanking[];
  thresholds: {
    lowScore: number;
    strongScore: number;
  };
};

export type ItemResponseInput = {
  categoryKey: string;
  itemKey: string;
  outcome: "pass" | "fail" | "na";
  itemNotes?: string;
  photoUrl?: string | null;
};
