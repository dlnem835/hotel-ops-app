import type { WorkOrderLocationOption } from "@/app/maintenance/lib/work-order-location";
import type { WorkOrderReportRow } from "@/app/reports/lib/work-order-report-types";

/** Blueprint location options — mirrors Work Orders searchable room/area list. */
export const SAMPLE_WORK_ORDER_LOCATION_OPTIONS: WorkOrderLocationOption[] = [
  { id: 101, label: "Room 204", searchText: "room 204 204" },
  { id: 102, label: "Room 312", searchText: "room 312 312" },
  { id: 103, label: "Room 418", searchText: "room 418 418" },
  { id: 201, label: "Main Lobby", searchText: "main lobby public area" },
  { id: 202, label: "Pool Deck", searchText: "pool deck swimming pool" },
  { id: 203, label: "Kitchen", searchText: "kitchen back of house" },
  { id: 204, label: "Boiler Room", searchText: "boiler room mechanical" },
].sort((a, b) => a.label.localeCompare(b.label, undefined, { numeric: true }));

export type SampleWorkOrderRow = WorkOrderReportRow;

export const SAMPLE_WORK_ORDER_ROWS: SampleWorkOrderRow[] = [
  {
    id: "wo-1042",
    title: "AC not cooling — guest complaint",
    area: "Room 204",
    category: "HVAC",
    priority: "Urgent",
    status: "Open",
    createdBy: "Front Desk — John Smith",
    createdAt: "Jun 18, 2026 · 2:14 PM",
    createdAtIso: "2026-06-18",
    source: "Manual",
    completedBy: null,
    completedAt: null,
    completedAtIso: null,
    comments: "Guest reports room at 78°F. Maintenance notified.",
    daysOpen: 2,
    hoursOpen: 52,
  },
  {
    id: "wo-1038",
    title: "Replace lobby light fixture",
    area: "Main Lobby",
    category: "Electrical",
    priority: "Important",
    status: "Completed",
    createdBy: "J. Martinez",
    createdAt: "Jul 1, 2026 · 9:05 AM",
    createdAtIso: "2026-07-01",
    source: "Room Inspection",
    completedBy: "D. Chen",
    completedAt: "Jul 3, 2026 · 4:30 PM",
    completedAtIso: "2026-07-03",
    comments: "Fixture replaced and tested.",
    daysOpen: 2,
    hoursOpen: 55,
  },
  {
    id: "wo-1031",
    title: "Pool pump vibration",
    area: "Pool Deck",
    category: "Swimming Pool",
    priority: "Important",
    status: "Completed",
    createdBy: "D. Chen",
    createdAt: "Jul 2, 2026 · 7:40 AM",
    createdAtIso: "2026-07-02",
    source: "Preventive Maintenance",
    completedBy: "D. Chen",
    completedAt: "Jul 3, 2026 · 11:15 AM",
    completedAtIso: "2026-07-03",
    comments: "Bearing assembly adjusted.",
    daysOpen: 1,
    hoursOpen: 28,
  },
  {
    id: "wo-1025",
    title: "Leaking sink — slow drain",
    area: "Room 312",
    category: "Plumbing",
    priority: "Normal",
    status: "Open",
    createdBy: "Maddie",
    createdAt: "Jun 15, 2026 · 10:22 AM",
    createdAtIso: "2026-06-15",
    source: "Room Inspection",
    completedBy: null,
    completedAt: null,
    completedAtIso: null,
    comments: "Snake scheduled for tomorrow.",
    daysOpen: 5,
    hoursOpen: 120,
  },
  {
    id: "wo-1019",
    title: "Fire extinguisher bracket loose",
    area: "Boiler Room",
    category: "Fire & Life Safety",
    priority: "Important",
    status: "Completed",
    createdBy: "R. Patel",
    createdAt: "Jul 4, 2026 · 1:50 PM",
    createdAtIso: "2026-07-04",
    source: "Preventive Maintenance",
    completedBy: "R. Patel",
    completedAt: "Jul 5, 2026 · 8:10 AM",
    completedAtIso: "2026-07-05",
    comments: "Re-secured to wall anchor.",
    daysOpen: 1,
    hoursOpen: 18,
  },
];

export const SAMPLE_WO_SUMMARY = {
  total: 47,
  open: 12,
  completed: 35,
  avgCompletionTime: "1.8 days",
  avgDaysOpenBeforeCompleted: 2.1,
  topCategory: "HVAC",
  topArea: "Room 204",
};

export const SAMPLE_WO_BY_CATEGORY = [
  { category: "HVAC", count: 14 },
  { category: "Plumbing", count: 9 },
  { category: "Electrical", count: 8 },
  { category: "Fire & Life Safety", count: 6 },
  { category: "Swimming Pool", count: 5 },
  { category: "Other", count: 5 },
];

export const SAMPLE_WO_BY_AREA = [
  { area: "Room 204", count: 7 },
  { area: "Main Lobby", count: 6 },
  { area: "Pool Deck", count: 5 },
  { area: "Room 312", count: 4 },
  { area: "Kitchen", count: 4 },
  { area: "Boiler Room", count: 3 },
];

export type SampleWorkOrderBySourceRow = {
  source: string;
  total: number;
  open: number;
  completed: number;
  avgCompletionTime: string;
  avgDaysOpen: number;
};

export const SAMPLE_WO_BY_SOURCE: SampleWorkOrderBySourceRow[] = [
  {
    source: "Pass-On Log",
    total: 12,
    open: 3,
    completed: 9,
    avgCompletionTime: "1.8 days",
    avgDaysOpen: 2.4,
  },
  {
    source: "Room Inspection",
    total: 8,
    open: 2,
    completed: 6,
    avgCompletionTime: "2.4 days",
    avgDaysOpen: 3.1,
  },
  {
    source: "RPM",
    total: 5,
    open: 1,
    completed: 4,
    avgCompletionTime: "1.2 days",
    avgDaysOpen: 1.6,
  },
  {
    source: "Manual",
    total: 9,
    open: 2,
    completed: 7,
    avgCompletionTime: "2.1 days",
    avgDaysOpen: 2.8,
  },
  {
    source: "Preventive Maintenance",
    total: 7,
    open: 2,
    completed: 5,
    avgCompletionTime: "1.5 days",
    avgDaysOpen: 2.0,
  },
  {
    source: "Lost & Found",
    total: 4,
    open: 1,
    completed: 3,
    avgCompletionTime: "3.2 days",
    avgDaysOpen: 4.1,
  },
  {
    source: "Other",
    total: 2,
    open: 1,
    completed: 1,
    avgCompletionTime: "4.0 days",
    avgDaysOpen: 5.5,
  },
];
