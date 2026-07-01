import {
  AssociateOption,
  RoomOption,
  TemplateOption,
} from "@/app/inspections/components/StartInspectionPanel";
import { compareInspectionAge } from "@/app/inspections/lib/inspection-age";
import { resolveDefaultTemplateForDashboard } from "@/app/inspections/lib/default-template";
import {
  DashboardPayload,
  PriorityQueueItem,
  RoomGridTile,
} from "@/app/inspections/lib/inspection-types";
import { templateMatchesDashboard } from "@/app/inspections/lib/program-map";
import { daysSince, parseDashboardProgram } from "@/app/inspections/lib/period-utils";
import { mapMembersToAssociateOptions } from "@/app/lib/member-display-name";
import { getClientSession } from "@/app/lib/auth";
import { supabase } from "@/app/supabaseClient";

export type { AssociateOption, RoomOption, TemplateOption };

export type InspectionBootstrap = {
  templates: TemplateOption[];
  rooms: RoomOption[];
  associates: AssociateOption[];
  inspectorId: string | null;
};

export async function fetchInspectionDashboard(
  program: "VR" | "RPM",
  period = "mtd"
): Promise<DashboardPayload> {
  const response = await fetch(
    `/api/inspections/dashboard?period=${period}&program=${program.toLowerCase()}`
  );
  const result = await response.json();
  if (!response.ok) {
    throw new Error(result.error || "Unable to load inspections");
  }
  return result as DashboardPayload;
}

export async function fetchInspectionBootstrap(): Promise<InspectionBootstrap> {
  const session = await getClientSession();
  if (!session) {
    throw new Error("Not signed in");
  }

  const [templatesRes, areasRes, membersRes, teamMemberRes] = await Promise.all([
    fetch("/api/inspections/sessions"),
    fetch("/api/buildings-areas"),
    supabase.from("team_members").select("id, first_name, last_name, username"),
    supabase
      .from("team_members")
      .select("id")
      .eq("auth_user_id", session.user.id)
      .maybeSingle(),
  ]);

  const templatesJson = await templatesRes.json();
  const areasJson = await areasRes.json();

  if (!templatesRes.ok) {
    throw new Error(templatesJson.error || "Unable to load inspection templates");
  }
  if (!areasRes.ok) {
    throw new Error(areasJson.error || "Unable to load guest rooms");
  }

  const templates = (templatesJson.templates || []) as TemplateOption[];
  const rooms = ((areasJson.areas || []) as { id: number; name: string; status: string; area_type: string }[])
    .filter((area) => area.area_type === "Guest Room")
    .map((area) => ({
      id: Number(area.id),
      name: String(area.name),
      status: String(area.status),
    }));

  const associates = mapMembersToAssociateOptions(membersRes.data || []);

  return {
    templates,
    rooms: sortRoomsNumerically(rooms),
    associates,
    inspectorId: teamMemberRes.data ? String(teamMemberRes.data.id) : null,
  };
}

export function sortRoomsNumerically<T extends { name: string }>(rooms: T[]): T[] {
  return rooms.slice().sort((a, b) => Number(a.name) - Number(b.name));
}

export function buildFullPriorityQueue(rooms: RoomGridTile[]): PriorityQueueItem[] {
  return rooms
    .filter((room) => room.status === "Active")
    .slice()
    .sort((a, b) =>
      compareInspectionAge(
        a.neverInspectedForProgram,
        a.operationalLastCompletedAt,
        a.name,
        b.neverInspectedForProgram,
        b.operationalLastCompletedAt,
        b.name
      )
    )
    .map((room) => ({
      areaId: room.areaId,
      name: room.name,
      neverInspected: room.neverInspectedForProgram,
      lastCompletedAt: room.neverInspectedForProgram
        ? null
        : room.operationalLastCompletedAt,
      daysSinceInspection:
        room.neverInspectedForProgram || !room.operationalLastCompletedAt
          ? null
          : daysSince(room.operationalLastCompletedAt),
    }));
}

export function matchingTemplates(
  templates: TemplateOption[],
  program: "VR" | "RPM"
): TemplateOption[] {
  return templates.filter((template) =>
    templateMatchesDashboard(template.inspection_program as never, program)
  );
}

export function defaultTemplateId(
  templates: TemplateOption[],
  program: "VR" | "RPM"
): number | null {
  return resolveDefaultTemplateForDashboard(templates, program);
}

export async function startInspectionSession(params: {
  areaId: number;
  templateId: number;
  inspectorId: string | null;
  associateId: string | null;
  program: "VR" | "RPM";
}): Promise<number> {
  const response = await fetch("/api/inspections/sessions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      areaId: params.areaId,
      templateId: params.templateId,
      inspectorId: params.inspectorId,
      associateId: params.associateId,
      program: params.program.toLowerCase(),
    }),
  });
  const result = await response.json();
  if (!response.ok) {
    throw new Error(result.error || "Unable to start inspection");
  }
  return Number(result.session.id);
}

export function inspectionSessionUrl(sessionId: number): string {
  return `/mobile/inspections/session/${sessionId}`;
}

export function mobileInspectionListHref(program: string): string {
  return parseDashboardProgram(program) === "RPM" ? "/mobile/rpms" : "/mobile/inspections";
}

export function mobileInspectionListLabel(program: string): string {
  return parseDashboardProgram(program) === "RPM"
    ? "Rooms Preventative Maintenance"
    : "Inspections";
}

export function filterRoomsBySearch<T extends { name: string }>(
  rooms: T[],
  search: string
): T[] {
  const query = search.trim().toLowerCase();
  if (!query) return rooms;
  return rooms.filter((room) => room.name.toLowerCase().includes(query));
}
