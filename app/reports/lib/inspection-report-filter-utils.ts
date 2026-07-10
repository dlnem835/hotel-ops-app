import type { InspectionProgram } from "@/app/inspections/lib/inspection-types";
import { programMatchesDashboard } from "@/app/inspections/lib/program-map";
import type { InspectionReportVariant } from "@/app/reports/lib/inspection-report-sample-data";
import { ROOM_INSPECTION_TYPE_FILTER_OPTIONS } from "@/app/reports/lib/inspection-report-sample-data";
import type { InspectionReportFilters } from "@/app/reports/lib/inspection-report-types";

const ROOM_TYPE_TO_PROGRAMS: Record<
  (typeof ROOM_INSPECTION_TYPE_FILTER_OPTIONS)[number],
  InspectionProgram[] | null
> = {
  All: null,
  VR: ["VR"],
  "Stayover (SO)": ["STAYOVER"],
  "Deep Clean": ["DEEP_CLEAN"],
  "Public Area": ["PUBLIC_AREA"],
  Exterior: ["EXTERIOR"],
  Pool: ["POOL"],
  Safety: ["SAFETY"],
  Custom: ["CUSTOM"],
};

const ROOM_INSPECTION_PROGRAMS: InspectionProgram[] = [
  "VR",
  "STAYOVER",
  "DEEP_CLEAN",
  "PUBLIC_AREA",
  "EXTERIOR",
  "POOL",
  "SAFETY",
  "CUSTOM",
];

export function formatInspectionProgramLabel(program: InspectionProgram): string {
  switch (program) {
    case "VR":
      return "VR";
    case "STAYOVER":
      return "Stayover (SO)";
    case "DEEP_CLEAN":
      return "Deep Clean";
    case "RPM":
      return "RPM";
    case "PUBLIC_AREA":
      return "Public Area";
    case "EXTERIOR":
      return "Exterior";
    case "POOL":
      return "Pool";
    case "SAFETY":
      return "Safety";
    case "CUSTOM":
      return "Custom";
    default:
      return program;
  }
}

export function formatInspectionReportDateTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function formatInspectionReportDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function toDateOnly(iso: string | null | undefined): string {
  if (!iso) return "";
  return iso.slice(0, 10);
}

export function matchesInspectionDateRange(
  completedAtIso: string | null | undefined,
  filters: Pick<InspectionReportFilters, "dateStart" | "dateEnd">
): boolean {
  if (!filters.dateStart && !filters.dateEnd) return true;
  if (!completedAtIso) return false;
  const dateOnly = toDateOnly(completedAtIso);
  if (filters.dateStart && dateOnly < filters.dateStart) return false;
  if (filters.dateEnd && dateOnly > filters.dateEnd) return false;
  return true;
}

export function sessionMatchesVariantProgram(
  program: InspectionProgram,
  variant: InspectionReportVariant,
  typeFilter: string
): boolean {
  if (variant === "rpm") {
    return program === "RPM";
  }

  if (typeFilter !== "All") {
    const allowed =
      ROOM_TYPE_TO_PROGRAMS[typeFilter as (typeof ROOM_INSPECTION_TYPE_FILTER_OPTIONS)[number]];
    return allowed ? allowed.includes(program) : true;
  }

  return ROOM_INSPECTION_PROGRAMS.includes(program);
}

export function matchesInspectionReportFilters(
  session: {
    inspectionProgram: InspectionProgram;
    associateName: string;
    inspectorName: string;
    completedAt: string;
  },
  filters: InspectionReportFilters,
  variant: InspectionReportVariant
): boolean {
  if (!sessionMatchesVariantProgram(session.inspectionProgram, variant, filters.type)) {
    return false;
  }
  if (!matchesInspectionDateRange(session.completedAt, filters)) return false;
  if (filters.associate !== "All" && session.associateName !== filters.associate) {
    return false;
  }
  if (filters.inspector !== "All" && session.inspectorName !== filters.inspector) {
    return false;
  }
  return true;
}

export function getActiveGuestRooms(
  rooms: Array<{ id: number; name: string; status: string; inspectionEnabled: boolean }>
) {
  return rooms.filter((room) => room.inspectionEnabled && room.status === "Active");
}

export function calculateDaysSince(iso: string | null | undefined, now = new Date()): number | null {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const then = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  return Math.floor((today.getTime() - then.getTime()) / (24 * 60 * 60 * 1000));
}

export function averageDurationMs(values: Array<number | null>): number | null {
  const valid = values.filter((value): value is number => value !== null);
  if (valid.length === 0) return null;
  return Math.round(valid.reduce((sum, value) => sum + value, 0) / valid.length);
}

export function formatAverageDurationLabel(durationMs: number | null): string | null {
  if (durationMs === null) return null;
  const totalSeconds = Math.round(durationMs / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (hours > 0) return `${hours} hr ${minutes} min`;
  if (minutes > 0) return seconds > 0 ? `${minutes} min ${seconds} sec` : `${minutes} min`;
  return `${seconds} sec`;
}

export function getDashboardProgram(variant: InspectionReportVariant): "VR" | "RPM" {
  return variant === "rpm" ? "RPM" : "VR";
}

export function programInVariantScope(
  program: InspectionProgram,
  variant: InspectionReportVariant
): boolean {
  if (variant === "rpm") return program === "RPM";
  return programMatchesDashboard(program, "VR") || ROOM_INSPECTION_PROGRAMS.includes(program);
}
