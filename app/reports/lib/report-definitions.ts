export type ReportsTabId = "all" | "saved" | "generated";

export const REPORTS_TABS: Array<{ id: ReportsTabId; label: string }> = [
  { id: "all", label: "All Reports" },
  { id: "saved", label: "Saved Reports" },
  { id: "generated", label: "Generated Reports" },
];

export type PmReportId =
  | "completed-pms"
  | "missed-pms"
  | "failed-pm-items"
  | "pm-report";

export type ReportRowDefinition = {
  id: string;
  title: string;
  description: string;
  enabled: boolean;
  pmReportId?: PmReportId;
};

export type ReportCategorySection = {
  id: string;
  title: string;
  description: string;
  optional?: boolean;
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
  dateStart: string;
  dateEnd: string;
};

export const DEFAULT_PM_REPORT_FILTERS: PmReportFilters = {
  propertyName: REPORT_PROPERTY_OPTIONS[0],
  pmType: "All",
  dateStart: "",
  dateEnd: "",
};

export const PREVENTIVE_MAINTENANCE_SECTION: ReportCategorySection = {
  id: "preventative-maintenance",
  title: "Preventative Maintenance",
  description:
    "Property-wide PM cycles, completions, missed work, and failed checklist items.",
  reports: [
    {
      id: "completed-pms",
      title: "Completed PMs",
      description: "PMs completed within the selected date range and property.",
      enabled: true,
      pmReportId: "completed-pms",
    },
    {
      id: "missed-pms",
      title: "Missed PMs",
      description: "Scheduled PMs that were missed during the selected period.",
      enabled: true,
      pmReportId: "missed-pms",
    },
    {
      id: "failed-pm-items",
      title: "Failed PM Items",
      description: "Checklist items marked failed, with source PM traceability.",
      enabled: true,
      pmReportId: "failed-pm-items",
    },
    {
      id: "pm-report",
      title: "PM Report",
      description: "Frequency-grouped PM progress with period completion markers.",
      enabled: true,
      pmReportId: "pm-report",
    },
  ],
};

/** Blueprint sections shown on All Reports — PM is interactive; others are placeholders. */
export const ALL_REPORT_SECTIONS: ReportCategorySection[] = [
  PREVENTIVE_MAINTENANCE_SECTION,
  {
    id: "room-pm",
    title: "Room Preventative Maintenance",
    description: "RPM schedules, completion tracking, and room-level PM history.",
    reports: [
      {
        id: "past-due-rpms",
        title: "Past Due RPMs",
        description: "Rooms with overdue RPM assignments.",
        enabled: false,
      },
      {
        id: "upcoming-rpms",
        title: "Upcoming RPMs",
        description: "RPM work scheduled in the near term.",
        enabled: false,
      },
      {
        id: "completed-rpms",
        title: "Completed RPMs",
        description: "RPM completions by room and date.",
        enabled: false,
      },
    ],
  },
  {
    id: "work-orders",
    title: "Work Orders",
    description: "Open queue, completion trends, and technician workload.",
    reports: [
      {
        id: "open-work-orders",
        title: "Open Work Orders",
        description: "Current open work order backlog.",
        enabled: false,
      },
      {
        id: "completed-work-orders",
        title: "Completed Work Orders",
        description: "Closed work orders in a selected period.",
        enabled: false,
      },
      {
        id: "wo-by-priority",
        title: "Work Orders by Priority",
        description: "Volume breakdown by priority level.",
        enabled: false,
      },
    ],
  },
  {
    id: "room-inspections",
    title: "Room Inspections",
    description: "Housekeeping inspection scores, failures, and coverage.",
    reports: [
      {
        id: "inspection-scores",
        title: "Inspection Scores",
        description: "Score trends by room and inspector.",
        enabled: false,
      },
      {
        id: "failed-items",
        title: "Failed Items",
        description: "Items marked fail during room inspections.",
        enabled: false,
      },
      {
        id: "daily-inspection-summary",
        title: "Daily Inspection Summary",
        description: "Day-over-day inspection activity.",
        enabled: false,
      },
    ],
  },
  {
    id: "lost-and-found",
    title: "Lost & Found",
    description: "Stored items, returns, discards, and shipping activity.",
    reports: [
      {
        id: "active-items",
        title: "Active Items",
        description: "Items currently in storage.",
        enabled: false,
      },
      {
        id: "items-discarded",
        title: "Items Discarded",
        description: "Items removed from inventory.",
        enabled: false,
      },
      {
        id: "shipping-history",
        title: "Shipping History",
        description: "Label requests and shipment activity.",
        enabled: false,
      },
    ],
  },
  {
    id: "pass-on-log",
    title: "Pass-On Log",
    description: "Shift handoffs, department notes, and daily operational activity.",
    optional: true,
    reports: [
      {
        id: "daily-log",
        title: "Daily Log",
        description: "Published pass-on entries by day.",
        enabled: false,
      },
      {
        id: "department-notes",
        title: "Department Notes",
        description: "Notes grouped by department.",
        enabled: false,
      },
    ],
  },
];

export function getPmReportTitle(reportId: PmReportId): string {
  const match = PREVENTIVE_MAINTENANCE_SECTION.reports.find(
    (report) => report.pmReportId === reportId
  );
  return match?.title ?? "PM Report";
}
