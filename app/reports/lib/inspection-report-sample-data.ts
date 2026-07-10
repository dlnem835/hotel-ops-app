import { formatInspectionDuration } from "@/app/inspections/lib/inspection-duration";

export type InspectionReportVariant = "room" | "rpm";

export type { InspectionReportFilters } from "@/app/reports/lib/inspection-report-types";

export const SAMPLE_INSPECTION_ASSOCIATES = [
  "All",
  "Jasmine",
  "Grisell",
  "Maddie",
  "Rosa",
  "Carlos",
] as const;

export const SAMPLE_INSPECTION_INSPECTORS = [
  "All",
  "Maddie",
  "Grisell",
  "Dana",
  "Marcus",
] as const;

export const ROOM_INSPECTION_TYPE_FILTER_OPTIONS = [
  "All",
  "VR",
  "Stayover (SO)",
  "Deep Clean",
  "Public Area",
  "Exterior",
  "Pool",
  "Safety",
  "Custom",
] as const;

export const SAMPLE_ASSOCIATE_RANKING = [
  {
    name: "Grisell",
    roomsCount: 95,
    roomsPercent: 95,
    inspections: 102,
    averageScore: 94.2,
    failedItems: 18,
    averageTime: "4 min 05 sec",
  },
  {
    name: "Jasmine",
    roomsCount: 20,
    roomsPercent: 20,
    inspections: 22,
    averageScore: 91.8,
    failedItems: 6,
    averageTime: "3 min 40 sec",
  },
  {
    name: "Maddie",
    roomsCount: 68,
    roomsPercent: 68,
    inspections: 71,
    averageScore: 92.5,
    failedItems: 11,
    averageTime: "4 min 20 sec",
  },
];

export const SAMPLE_AVERAGE_TIME_DETAILS = [
  {
    inspector: "Maddie",
    averageTime: "4 min 20 sec",
    inspections: [
      { room: "Room 108", duration: formatInspectionDuration("2026-06-18T14:00:00Z", "2026-06-18T14:02:30Z") },
      { room: "Room 204", duration: formatInspectionDuration("2026-06-18T14:10:00Z", "2026-06-18T14:15:10Z") },
      { room: "Room 312", duration: formatInspectionDuration("2026-06-18T14:20:00Z", "2026-06-18T14:23:45Z") },
    ],
  },
  {
    inspector: "Grisell",
    averageTime: "4 min 05 sec",
    inspections: [
      { room: "Room 118", duration: formatInspectionDuration("2026-06-17T09:00:00Z", "2026-06-17T09:03:50Z") },
      { room: "Room 225", duration: formatInspectionDuration("2026-06-17T09:15:00Z", "2026-06-17T09:18:20Z") },
    ],
  },
];

export const SAMPLE_TOP_FAILED_SECTIONS = [
  { section: "Bathroom", count: 24 },
  { section: "Bedroom", count: 18 },
  { section: "Entry / Closet", count: 11 },
  { section: "Lighting & Electrical", count: 8 },
];

export const SAMPLE_TOP_FAILED_ITEMS = [
  { item: "Shower curtain liner condition", section: "Bathroom", count: 14 },
  { item: "Remote control present", section: "Bedroom", count: 9 },
  { item: "Door security latch", section: "Entry / Closet", count: 7 },
  { item: "Vanity light operation", section: "Lighting & Electrical", count: 6 },
];

export const SAMPLE_ROOMS_NOT_DONE = [
  { room: "Room 402", lastCompleted: "May 12, 2026" },
  { room: "Room 415", lastCompleted: "Never inspected" },
  { room: "Room 508", lastCompleted: "Apr 28, 2026" },
];

export const SAMPLE_ROOMS_DONE = [
  {
    room: "Room 108",
    type: "VR",
    inspector: "Maddie",
    score: 96,
    completedAt: "Jun 18, 2026 · 2:02 PM",
  },
  {
    room: "Room 204",
    type: "VR",
    inspector: "Maddie",
    score: 91,
    completedAt: "Jun 18, 2026 · 2:15 PM",
  },
  {
    room: "Room 312",
    type: "Stayover (SO)",
    inspector: "Grisell",
    score: 88,
    completedAt: "Jun 17, 2026 · 9:18 AM",
  },
];

export const SAMPLE_SCORES_BY_ROOM = [
  {
    room: "Room 108",
    type: "VR",
    latestScore: 96,
    averageScore: 94.5,
    failedItems: 1,
  },
  {
    room: "Room 204",
    type: "VR",
    latestScore: 91,
    averageScore: 90.2,
    failedItems: 2,
  },
  {
    room: "Room 312",
    type: "Stayover (SO)",
    latestScore: 88,
    averageScore: 89.1,
    failedItems: 3,
  },
];

export function getInspectionReportLabels(variant: InspectionReportVariant) {
  if (variant === "rpm") {
    return {
      roomsDoneTitle: "Rooms Completed",
      roomsNotDoneTitle: "Rooms Not Completed",
      roomsDoneColumn: "Rooms completed",
      roomsDonePercentColumn: "Rooms completed %",
      roomsNotDoneLead: "Rooms not completed in the selected date range.",
      roomsDoneLead: "Rooms completed in the selected date range.",
      typeLabel: "RPM Type",
    };
  }

  return {
    roomsDoneTitle: "Rooms Inspected",
    roomsNotDoneTitle: "Rooms Not Inspected",
    roomsDoneColumn: "Rooms inspected",
    roomsDonePercentColumn: "Rooms inspected %",
    roomsNotDoneLead: "Rooms not inspected in the selected date range.",
    roomsDoneLead: "Rooms inspected in the selected date range.",
    typeLabel: "Inspection Type",
  };
}
