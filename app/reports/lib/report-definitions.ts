export type ReportsTabId = "all" | "favorites" | "scheduled";

export const REPORTS_TABS: Array<{ id: ReportsTabId; label: string }> = [
  { id: "all", label: "All Reports" },
  { id: "favorites", label: "Favorites" },
  { id: "scheduled", label: "Scheduled" },
];

export type PmReportId =
  | "completed-pms"
  | "missed-pms"
  | "failed-pm-items"
  | "pm-report";

export type WorkOrderReportId =
  | "all-work-orders"
  | "work-order-completion-time"
  | "work-orders-by-category"
  | "work-orders-by-area"
  | "work-orders-by-source";

export type InspectionModuleReportId =
  | "associate-ranking"
  | "average-time"
  | "top-failed-sections"
  | "top-failed-items"
  | "rooms-not-done"
  | "rooms-done"
  | "scores-by-room";

export type LostFoundReportId =
  | "all-items"
  | "found-by"
  | "shipped-items"
  | "ready-to-discard";

export type PassOnReportId =
  | "entries-by-associate"
  | "entries-by-shift"
  | "edited-entries"
  | "keyword-search";

export type ReportRowDefinition = {
  id: string;
  title: string;
  enabled: boolean;
  pmReportId?: PmReportId;
  woReportId?: WorkOrderReportId;
  roomInspectionReportId?: InspectionModuleReportId;
  rpmInspectionReportId?: InspectionModuleReportId;
  lnfReportId?: LostFoundReportId;
  passOnReportId?: PassOnReportId;
};

export type ReportCategorySection = {
  id: string;
  title: string;
  reports: ReportRowDefinition[];
};

export const PM_TYPE_FILTER_OPTIONS = [
  "All",
  "Daily",
  "Weekly",
  "Monthly",
  "Quarterly",
  "Triannually",
  "Semi-Annual",
  "Annual",
] as const;

export const REPORT_PROPERTY_OPTIONS = ["One Eyrie Hotel"] as const;

export type PmReportFilters = {
  propertyName: string;
  pmType: string;
  completedBy: string;
  dateStart: string;
  dateEnd: string;
};

export const DEFAULT_PM_REPORT_FILTERS: PmReportFilters = {
  propertyName: REPORT_PROPERTY_OPTIONS[0],
  pmType: "All",
  completedBy: "All",
  dateStart: "",
  dateEnd: "",
};

export const WORK_ORDER_STATUS_FILTER_OPTIONS = ["All", "Open", "Completed"] as const;

export const WORK_ORDER_SOURCE_FILTER_OPTIONS = [
  "All",
  "Manual",
  "Pass-On Log",
  "Room Inspection",
  "RPM",
  "Preventive Maintenance",
  "Lost & Found",
  "Other",
] as const;

export type WorkOrderReportFilters = {
  propertyName: string;
  status: (typeof WORK_ORDER_STATUS_FILTER_OPTIONS)[number];
  source: (typeof WORK_ORDER_SOURCE_FILTER_OPTIONS)[number];
  areaId: number | null;
  areaLabel: string;
  category: string;
  dateStart: string;
  dateEnd: string;
};

export const DEFAULT_WORK_ORDER_REPORT_FILTERS: WorkOrderReportFilters = {
  propertyName: REPORT_PROPERTY_OPTIONS[0],
  status: "All",
  source: "All",
  areaId: null,
  areaLabel: "All",
  category: "All",
  dateStart: "",
  dateEnd: "",
};

export const LOST_FOUND_STATUS_FILTER_OPTIONS = [
  "All",
  "Stored",
  "Label Requested",
  "Label Sent",
  "Ready to Ship",
  "Shipped",
  "Returned",
  "Discarded",
  "Closed",
] as const;

export const LNF_DEPARTMENT_FILTER_OPTIONS = [
  "All",
  "Front Desk",
  "Housekeeping",
  "Maintenance",
  "Management",
] as const;

export type LostFoundReportFilters = {
  propertyName: string;
  status: (typeof LOST_FOUND_STATUS_FILTER_OPTIONS)[number];
  foundBy: string;
  createdBy: string;
  dateStart: string;
  dateEnd: string;
};

export const DEFAULT_LOST_FOUND_REPORT_FILTERS: LostFoundReportFilters = {
  propertyName: REPORT_PROPERTY_OPTIONS[0],
  status: "All",
  foundBy: "All",
  createdBy: "All",
  dateStart: "",
  dateEnd: "",
};

export type LostFoundFoundByReportFilters = {
  propertyName: string;
  foundBy: string;
  department: (typeof LNF_DEPARTMENT_FILTER_OPTIONS)[number];
  dateStart: string;
  dateEnd: string;
};

export const DEFAULT_LOST_FOUND_FOUND_BY_REPORT_FILTERS: LostFoundFoundByReportFilters = {
  propertyName: REPORT_PROPERTY_OPTIONS[0],
  foundBy: "All",
  department: "All",
  dateStart: "",
  dateEnd: "",
};

export const PASS_ON_SHIFT_FILTER_OPTIONS = [
  "All",
  "AM",
  "PM",
  "Overnight",
] as const;

export type PassOnReportFilters = {
  propertyName: string;
  associate: string;
  shift: (typeof PASS_ON_SHIFT_FILTER_OPTIONS)[number];
  keyword: string;
  dateStart: string;
  dateEnd: string;
};

export const DEFAULT_PASS_ON_REPORT_FILTERS: PassOnReportFilters = {
  propertyName: REPORT_PROPERTY_OPTIONS[0],
  associate: "All",
  shift: "All",
  keyword: "",
  dateStart: "",
  dateEnd: "",
};

function report(
  id: string,
  title: string,
  bindings: Omit<ReportRowDefinition, "id" | "title" | "enabled">
): ReportRowDefinition {
  return { id, title, enabled: true, ...bindings };
}

export const ROOM_PREVENTIVE_MAINTENANCE_SECTION: ReportCategorySection = {
  id: "room-pm",
  title: "Room Preventive Maintenance",
  reports: [
    report("rpm-associate-rankings", "Associate Rankings", {
      rpmInspectionReportId: "associate-ranking",
    }),
    report("rpm-average-time", "Average RPM Time", {
      rpmInspectionReportId: "average-time",
    }),
    report("rpm-rooms-completed", "Rooms Completed", {
      rpmInspectionReportId: "rooms-done",
    }),
    report("rpm-rooms-not-completed", "Rooms Not Completed", {
      rpmInspectionReportId: "rooms-not-done",
    }),
    report("rpm-failed-areas", "Failed Areas", {
      rpmInspectionReportId: "top-failed-sections",
    }),
    report("rpm-failed-items", "Failed Items", {
      rpmInspectionReportId: "top-failed-items",
    }),
    report("rpm-scores-by-room", "Scores by Room", {
      rpmInspectionReportId: "scores-by-room",
    }),
  ],
};

export const PREVENTIVE_MAINTENANCE_SECTION: ReportCategorySection = {
  id: "preventative-maintenance",
  title: "Preventive Maintenance",
  reports: [
    report("completed-pms", "Completed PMs", { pmReportId: "completed-pms" }),
    report("missed-pms", "Missed PMs", { pmReportId: "missed-pms" }),
    report("failed-pm-items", "Failed Items", { pmReportId: "failed-pm-items" }),
    report("pm-completion-status", "PM Completions Overview", { pmReportId: "pm-report" }),
  ],
};

export const WORK_ORDERS_SECTION: ReportCategorySection = {
  id: "work-orders",
  title: "Work Orders",
  reports: [
    report("all-work-orders", "All Work Orders", { woReportId: "all-work-orders" }),
    report("average-completion-time", "Average Completion Time", {
      woReportId: "work-order-completion-time",
    }),
    report("top-categories", "Top Categories", { woReportId: "work-orders-by-category" }),
    report("top-areas", "Top Areas", { woReportId: "work-orders-by-area" }),
    report("work-orders-by-source", "Work Orders by Source", {
      woReportId: "work-orders-by-source",
    }),
  ],
};

export const ROOM_INSPECTIONS_SECTION: ReportCategorySection = {
  id: "room-inspections",
  title: "Room Inspections",
  reports: [
    report("associate-rankings", "Associate Rankings", {
      roomInspectionReportId: "associate-ranking",
    }),
    report("average-inspection-time", "Average Inspection Time", {
      roomInspectionReportId: "average-time",
    }),
    report("rooms-inspected", "Rooms Inspected", {
      roomInspectionReportId: "rooms-done",
    }),
    report("rooms-not-inspected", "Rooms Not Inspected", {
      roomInspectionReportId: "rooms-not-done",
    }),
    report("failed-areas", "Failed Areas", {
      roomInspectionReportId: "top-failed-sections",
    }),
    report("failed-items", "Failed Items", {
      roomInspectionReportId: "top-failed-items",
    }),
    report("scores-by-room", "Scores by Room", {
      roomInspectionReportId: "scores-by-room",
    }),
  ],
};

export const LOST_AND_FOUND_SECTION: ReportCategorySection = {
  id: "lost-and-found",
  title: "Lost & Found",
  reports: [
    report("all-items", "All Items", { lnfReportId: "all-items" }),
    report("found-by", "Found By", { lnfReportId: "found-by" }),
    report("shipping-report", "Shipping Report", { lnfReportId: "shipped-items" }),
    report("aging-report", "Aging Report", { lnfReportId: "ready-to-discard" }),
  ],
};

export const PASS_ON_LOG_SECTION: ReportCategorySection = {
  id: "pass-on-log",
  title: "Pass-On Log",
  reports: [
    report("entries-by-associate", "Entries by Associate", {
      passOnReportId: "entries-by-associate",
    }),
    report("entries-by-shift", "Entries by Shift", {
      passOnReportId: "entries-by-shift",
    }),
    report("edited-entries", "Edited Entries", { passOnReportId: "edited-entries" }),
    report("keyword-search", "Keyword Search", { passOnReportId: "keyword-search" }),
  ],
};

/** StayPMS-inspired category grid — six primary report modules. */
export const ALL_REPORT_SECTIONS: ReportCategorySection[] = [
  ROOM_PREVENTIVE_MAINTENANCE_SECTION,
  PREVENTIVE_MAINTENANCE_SECTION,
  WORK_ORDERS_SECTION,
  ROOM_INSPECTIONS_SECTION,
  LOST_AND_FOUND_SECTION,
  PASS_ON_LOG_SECTION,
];

function findReportTitle(
  predicate: (report: ReportRowDefinition) => boolean,
  fallback: string
): string {
  for (const section of ALL_REPORT_SECTIONS) {
    const match = section.reports.find(predicate);
    if (match) return match.title;
  }
  return fallback;
}

export function getPmReportTitle(reportId: PmReportId): string {
  return findReportTitle((report) => report.pmReportId === reportId, "PM Report");
}

export function getWorkOrderReportTitle(reportId: WorkOrderReportId): string {
  return findReportTitle((report) => report.woReportId === reportId, "Work Order Report");
}

export function getRoomInspectionReportTitle(reportId: InspectionModuleReportId): string {
  return findReportTitle(
    (report) => report.roomInspectionReportId === reportId,
    "Room Inspection Report"
  );
}

export function getRpmInspectionReportTitle(reportId: InspectionModuleReportId): string {
  return findReportTitle(
    (report) => report.rpmInspectionReportId === reportId,
    "RPM Report"
  );
}

export function getLostFoundReportTitle(reportId: LostFoundReportId): string {
  return findReportTitle((report) => report.lnfReportId === reportId, "Lost & Found Report");
}

export function getPassOnReportTitle(reportId: PassOnReportId): string {
  return findReportTitle((report) => report.passOnReportId === reportId, "Pass-On Report");
}

export type InspectionReportModalTarget =
  | { variant: "room"; reportId: InspectionModuleReportId }
  | { variant: "rpm"; reportId: InspectionModuleReportId };

export const DEFAULT_INSPECTION_REPORT_FILTERS = {
  propertyName: REPORT_PROPERTY_OPTIONS[0],
  type: "All",
  associate: "All",
  inspector: "All",
  dateStart: "",
  dateEnd: "",
};
