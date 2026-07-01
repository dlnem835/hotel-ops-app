import { SupabaseClient } from "@supabase/supabase-js";
import { calculateInspectionScore, deriveScorePercent } from "./scoring";
import { getGridState } from "./grid-state";
import {
  DashboardPayload,
  GuestRoomRow,
  HousekeeperRanking,
  InspectorRanking,
  InspectionItemResponse,
  InspectionSession,
  ItemResponseInput,
  RoomHistoryEntry,
} from "./inspection-types";
import {
  getMtdMonthBounds,
  getPeriodBounds,
  parseDashboardProgram,
  parseMtdMonthYear,
  parsePeriod,
} from "./period-utils";
import { buildMtdPriorityQueue, buildPriorityQueue, SummaryRow } from "./priority-queue";
import {
  fetchMemberDisplayNameResolver,
} from "@/app/lib/member-display-name";
import { programMatchesDashboard, resolveInspectionProgram } from "./program-map";
import {
  calculateRpmCycleCompliance,
  formatRpmCycleLabel,
  getRpmCycleBounds,
  getRpmCycleEndIso,
} from "./rpm-cycle";
import { standardToPropertyContent } from "../standards/builders";
import { PropertyInspectionTemplate, PropertyTemplateContent } from "../standards/types";
import { getSupabaseAdmin } from "./property-template-db";

export { getSupabaseAdmin };

type SettingsRow = {
  property_timezone: string;
  week_starts_on: "monday" | "sunday";
  low_score_threshold: number;
  strong_score_threshold: number;
};

type SessionRow = {
  id: number;
  area_id: number;
  template_id: number;
  inspection_program: string;
  status: string;
  inspector_id: string | null;
  associate_id: string | null;
  started_at: string;
  completed_at: string | null;
  earned_points: number;
  possible_points: number;
  score_percent: number | null;
  failed_item_count: number;
  session_notes: string | null;
  template_snapshot: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

function normalizeSession(row: SessionRow): InspectionSession {
  return {
    id: row.id,
    area_id: row.area_id,
    template_id: row.template_id,
    inspection_program: row.inspection_program as InspectionSession["inspection_program"],
    status: row.status as InspectionSession["status"],
    inspector_id: row.inspector_id ? String(row.inspector_id) : null,
    associate_id: row.associate_id ? String(row.associate_id) : null,
    started_at: row.started_at,
    completed_at: row.completed_at,
    earned_points: row.earned_points,
    possible_points: row.possible_points,
    score_percent:
      row.score_percent === null || row.score_percent === undefined
        ? deriveScorePercent(row.earned_points, row.possible_points)
        : deriveScorePercent(row.earned_points, row.possible_points, Number(row.score_percent)),
    failed_item_count: row.failed_item_count,
    session_notes: row.session_notes,
    template_snapshot: row.template_snapshot,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

export async function fetchInspectionSettings(
  supabase: SupabaseClient
): Promise<SettingsRow> {
  const { data, error } = await supabase
    .from("inspection_settings")
    .select("*")
    .eq("id", 1)
    .maybeSingle();

  if (error || !data) {
    return {
      property_timezone: "America/New_York",
      week_starts_on: "monday",
      low_score_threshold: 80,
      strong_score_threshold: 90,
    };
  }

  return {
    property_timezone: String(data.property_timezone || "America/New_York"),
    week_starts_on:
      data.week_starts_on === "sunday" ? "sunday" : "monday",
    low_score_threshold: Number(data.low_score_threshold) || 80,
    strong_score_threshold: Number(data.strong_score_threshold) || 90,
  };
}

export async function fetchGuestRooms(
  supabase: SupabaseClient
): Promise<GuestRoomRow[]> {
  const { data, error } = await supabase
    .from("buildings_and_areas")
    .select("id, name, area_type, floor_location, status, inspection_enabled")
    .eq("area_type", "Guest Room")
    .order("name");

  if (error) {
    throw new Error(error.message);
  }

  return (data || [])
    .map((row) => ({
      id: Number(row.id),
      name: String(row.name),
      area_type: String(row.area_type),
      floor_location: String(row.floor_location || ""),
      status: String(row.status),
      inspection_enabled: Boolean(row.inspection_enabled),
    }))
    .sort((a, b) => Number(a.name) - Number(b.name));
}

function templateNameFromSnapshot(snapshot: unknown): string {
  if (!snapshot || typeof snapshot !== "object") return "Inspection";
  const name = (snapshot as { name?: string }).name;
  return name?.trim() || "Inspection";
}

function programLabel(program: string): string {
  if (program === "VR") return "Vacant Ready";
  if (program === "STAYOVER") return "Stayover";
  if (program === "RPM") return "RPM";
  return program;
}

type PeriodSessionRow = {
  area_id: number;
  inspection_program: string;
  completed_at: string;
  earned_points: number;
  possible_points: number;
  score_percent: number | null;
  inspector_id: string | null;
  associate_id: string | null;
  template_snapshot: Record<string, unknown>;
};

type PeriodSessionSummary = {
  completed_at: string;
  scorePercent: number | null;
  inspector_id: string | null;
  associate_id: string | null;
  inspection_program: string;
  template_name: string;
};

function resolveSessionScore(row: {
  earned_points?: number | null;
  possible_points?: number | null;
  score_percent?: number | null;
}): number | null {
  return deriveScorePercent(
    row.earned_points,
    row.possible_points,
    row.score_percent === null || row.score_percent === undefined
      ? null
      : Number(row.score_percent)
  );
}

function latestSessionsInPeriod(
  sessions: PeriodSessionRow[],
  program: "VR" | "RPM",
  periodStart: string,
  periodEnd: string
) {
  const map = new Map<number, PeriodSessionSummary>();

  for (const session of sessions) {
    if (!session.completed_at) continue;
    if (session.completed_at < periodStart || session.completed_at > periodEnd) {
      continue;
    }
    if (!programMatchesDashboard(session.inspection_program as never, program)) {
      continue;
    }

    const existing = map.get(session.area_id);
    if (!existing || session.completed_at > existing.completed_at) {
      map.set(session.area_id, {
        completed_at: session.completed_at,
        scorePercent: resolveSessionScore(session),
        inspector_id: session.inspector_id,
        associate_id: session.associate_id,
        inspection_program: session.inspection_program,
        template_name: templateNameFromSnapshot(session.template_snapshot),
      });
    }
  }

  return map;
}

async function loadMemberNames(
  supabase: SupabaseClient,
  memberIds: string[]
): Promise<Map<string, string>> {
  const members = new Map<string, string>();
  if (memberIds.length === 0) return members;

  const resolver = await fetchMemberDisplayNameResolver(supabase);

  for (const id of memberIds) {
    members.set(id, resolver.displayForMemberId(id) || "Unknown");
  }

  return members;
}

function buildHousekeeperRankings(
  sessions: PeriodSessionRow[],
  program: "VR" | "RPM",
  periodStart: string,
  periodEnd: string,
  totalActiveRooms: number,
  memberNames: Map<string, string>
): HousekeeperRanking[] {
  const byAssociate = new Map<string, { rooms: Set<number>; scores: number[] }>();

  for (const session of sessions) {
    if (!session.associate_id || !session.completed_at) continue;
    if (session.completed_at < periodStart || session.completed_at > periodEnd) {
      continue;
    }
    if (!programMatchesDashboard(session.inspection_program as never, program)) {
      continue;
    }

    const score = resolveSessionScore(session);
    if (score === null) continue;

    const associateId = String(session.associate_id);
    const entry = byAssociate.get(associateId) || {
      rooms: new Set<number>(),
      scores: [],
    };
    entry.rooms.add(session.area_id);
    entry.scores.push(score);
    byAssociate.set(associateId, entry);
  }

  return [...byAssociate.entries()]
    .map(([associateId, data]) => ({
      associateId,
      name: memberNames.get(associateId) || "Unknown",
      roomsInspected: data.rooms.size,
      averageScore:
        data.scores.length > 0
          ? Math.round(
              (data.scores.reduce((sum, score) => sum + score, 0) / data.scores.length) *
                10
            ) / 10
          : null,
      coveragePercent:
        totalActiveRooms > 0
          ? Math.round((data.rooms.size / totalActiveRooms) * 1000) / 10
          : 0,
    }))
    .sort((a, b) => {
      if (b.roomsInspected !== a.roomsInspected) {
        return b.roomsInspected - a.roomsInspected;
      }
      return (b.averageScore ?? 0) - (a.averageScore ?? 0);
    })
    .slice(0, 5);
}

function buildTopInspectors(
  sessions: PeriodSessionRow[],
  program: "VR" | "RPM",
  periodStart: string,
  periodEnd: string,
  memberNames: Map<string, string>
): InspectorRanking[] {
  const byInspector = new Map<string, number>();

  for (const session of sessions) {
    if (!session.inspector_id || !session.completed_at) continue;
    if (session.completed_at < periodStart || session.completed_at > periodEnd) {
      continue;
    }
    if (!programMatchesDashboard(session.inspection_program as never, program)) {
      continue;
    }

    const inspectorId = String(session.inspector_id);
    byInspector.set(inspectorId, (byInspector.get(inspectorId) || 0) + 1);
  }

  return [...byInspector.entries()]
    .map(([inspectorId, inspectionCount]) => ({
      inspectorId,
      name: memberNames.get(inspectorId) || "Unknown",
      inspectionCount,
    }))
    .sort((a, b) => {
      if (b.inspectionCount !== a.inspectionCount) {
        return b.inspectionCount - a.inspectionCount;
      }
      return a.name.localeCompare(b.name);
    })
    .slice(0, 5);
}

export async function buildDashboard(
  supabase: SupabaseClient,
  periodParam: string | null,
  programParam: string | null,
  monthParam: string | null = null,
  yearParam: string | null = null
): Promise<DashboardPayload> {
  const period = parsePeriod(periodParam);
  const program = parseDashboardProgram(programParam);
  const settings = await fetchInspectionSettings(supabase);
  const now = new Date();
  const mtdMonthYear = parseMtdMonthYear(monthParam, yearParam, now);
  const periodBounds =
    period === "mtd"
      ? getMtdMonthBounds(mtdMonthYear.year, mtdMonthYear.month, now)
      : getPeriodBounds(period, now, settings.week_starts_on);
  const mtdReferenceDate = new Date(periodBounds.end);
  const rpmCycleBounds = getRpmCycleBounds(now, settings.week_starts_on);

  const rooms = await fetchGuestRooms(supabase);
  const activeRooms = rooms.filter(
    (room) => room.inspection_enabled && room.status === "Active"
  );
  const activeRoomIds = new Set(activeRooms.map((room) => room.id));

  const [sessionResult, rpmCycleSessionResult] = await Promise.all([
    supabase
      .from("inspection_sessions")
      .select(
        "area_id, inspection_program, completed_at, score_percent, earned_points, possible_points, status, inspector_id, associate_id, template_snapshot"
      )
      .eq("status", "completed")
      .gte("completed_at", periodBounds.start)
      .lte("completed_at", periodBounds.end),
    supabase
      .from("inspection_sessions")
      .select("area_id, inspection_program, completed_at")
      .eq("status", "completed")
      .gte("completed_at", rpmCycleBounds.start.toISOString())
      .lte("completed_at", getRpmCycleEndIso(rpmCycleBounds)),
  ]);

  const { data: sessionRows, error: sessionError } = sessionResult;

  if (sessionError) {
    throw new Error(sessionError.message);
  }

  if (rpmCycleSessionResult.error) {
    throw new Error(rpmCycleSessionResult.error.message);
  }

  const rpmCycleComplianceResult = calculateRpmCycleCompliance(
    activeRoomIds,
    (rpmCycleSessionResult.data || []).map((row) => ({
      area_id: Number(row.area_id),
      inspection_program: String(row.inspection_program),
      completed_at: String(row.completed_at),
    })),
    (inspectionProgram) =>
      programMatchesDashboard(inspectionProgram as never, "RPM")
  );

  const completedSessions: PeriodSessionRow[] = (sessionRows || []).map((row) => ({
    area_id: Number(row.area_id),
    inspection_program: String(row.inspection_program),
    completed_at: String(row.completed_at),
    earned_points: Number(row.earned_points) || 0,
    possible_points: Number(row.possible_points) || 0,
    score_percent: resolveSessionScore({
      earned_points: Number(row.earned_points) || 0,
      possible_points: Number(row.possible_points) || 0,
      score_percent:
        row.score_percent === null || row.score_percent === undefined
          ? null
          : Number(row.score_percent),
    }),
    inspector_id: row.inspector_id ? String(row.inspector_id) : null,
    associate_id: row.associate_id ? String(row.associate_id) : null,
    template_snapshot: (row.template_snapshot as Record<string, unknown>) || {},
  }));

  const memberIdSet = new Set<string>();
  for (const session of completedSessions) {
    if (session.inspector_id) memberIdSet.add(session.inspector_id);
    if (session.associate_id) memberIdSet.add(session.associate_id);
  }
  const memberNames = await loadMemberNames(supabase, [...memberIdSet]);

  const vrMap = latestSessionsInPeriod(
    completedSessions,
    "VR",
    periodBounds.start,
    periodBounds.end
  );
  const rpmMap = latestSessionsInPeriod(
    completedSessions,
    "RPM",
    periodBounds.start,
    periodBounds.end
  );

  const activeProgramMap = program === "VR" ? vrMap : rpmMap;
  const inspectedCount = activeRooms.filter((room) =>
    activeProgramMap.has(room.id)
  ).length;

  const scores = activeRooms
    .map((room) => activeProgramMap.get(room.id)?.scorePercent)
    .filter((score): score is number => score !== null && score !== undefined);

  const lowScoreRooms = activeRooms.filter((room) => {
    const score = activeProgramMap.get(room.id)?.scorePercent;
    return score !== null && score !== undefined && score < settings.low_score_threshold;
  }).length;

  const { data: summaryRows } = await supabase
    .from("area_inspection_summary")
    .select(
      "area_id, inspection_program, last_completed_at, last_score_percent, last_failed_item_count, open_deficiency_count, recurring_deficiency_count, never_inspected"
    );

  const summaryByArea = new Map<number, typeof summaryRows>();
  for (const row of summaryRows || []) {
    const areaId = Number(row.area_id);
    const list = summaryByArea.get(areaId) || [];
    list.push(row);
    summaryByArea.set(areaId, list);
  }

  const gridRooms = rooms
    .filter((room) => room.status !== "Inactive")
    .map((room) => {
      const inPeriod = activeProgramMap.get(room.id);
      const summaries = summaryByArea.get(room.id) || [];
      const programSummary = summaries.find((entry) =>
        programMatchesDashboard(String(entry.inspection_program) as never, program)
      );
      const neverInspectedForProgram = programSummary
        ? Boolean(programSummary.never_inspected) ||
          !programSummary.last_completed_at
        : true;
      const operationalLastCompletedAt = programSummary?.last_completed_at
        ? String(programSummary.last_completed_at)
        : null;
      const openDeficiencyCount = summaries.reduce(
        (sum, entry) => sum + Number(entry.open_deficiency_count || 0),
        0
      );

      return {
        areaId: room.id,
        name: room.name,
        status: room.status,
        gridState: getGridState({
          roomStatus: room.status,
          inspectedInPeriod: Boolean(inPeriod),
          scorePercent: inPeriod?.scorePercent ?? null,
          lowThreshold: settings.low_score_threshold,
          strongThreshold: settings.strong_score_threshold,
        }),
        scorePercent: inPeriod?.scorePercent ?? null,
        lastCompletedAt: inPeriod?.completed_at ?? null,
        operationalLastCompletedAt,
        neverInspectedForProgram,
        openDeficiencyCount,
        neverInspectedInPeriod: !inPeriod,
        inspectorName: inPeriod?.inspector_id
          ? memberNames.get(inPeriod.inspector_id) || null
          : null,
        associateName: inPeriod?.associate_id
          ? memberNames.get(inPeriod.associate_id) || null
          : null,
        inspectionType: inPeriod
          ? `${programLabel(inPeriod.inspection_program)} · ${inPeriod.template_name}`
          : null,
        _programSummary: programSummary,
      };
    });

  const priorityRows: SummaryRow[] = activeRooms.map((room) => {
    const summaries = summaryByArea.get(room.id) || [];
    const match = summaries.find((entry) =>
      programMatchesDashboard(String(entry.inspection_program) as never, program)
    );

    return {
      area_id: room.id,
      name: room.name,
      inspection_program: match
        ? String(match.inspection_program)
        : program,
      last_completed_at: match?.last_completed_at
        ? String(match.last_completed_at)
        : null,
      never_inspected: match ? Boolean(match.never_inspected) : true,
    };
  });

  const vrInspected = activeRooms.filter((room) => vrMap.has(room.id)).length;
  const rpmInspected = activeRooms.filter((room) => rpmMap.has(room.id)).length;

  return {
    period,
    program,
    periodBounds,
    metrics: {
      inspected: inspectedCount,
      total: activeRooms.length,
      remaining: activeRooms.length - inspectedCount,
      coveragePercent:
        activeRooms.length > 0
          ? Math.round((inspectedCount / activeRooms.length) * 1000) / 10
          : 0,
        averageScore:
        scores.length > 0
          ? Math.round(
              (scores.reduce((sum, score) => sum + score, 0) / scores.length) * 10
            ) / 10
          : null,
      lowScoreRooms,
      vrInspected,
      rpmInspected,
      vrTotal: activeRooms.length,
      rpmTotal: activeRooms.length,
      rpmCompliance: {
        ...rpmCycleComplianceResult,
        cycleLabel: formatRpmCycleLabel(rpmCycleBounds),
        cycleNumber: rpmCycleBounds.cycleNumber,
      },
    },
    rooms: gridRooms.map(({ _programSummary: _, ...tile }) => tile),
    priorityQueue:
      period === "mtd"
        ? buildMtdPriorityQueue(
            priorityRows,
            new Set(activeProgramMap.keys()),
            program,
            10,
            mtdReferenceDate
          )
        : buildPriorityQueue(priorityRows, program, 10),
    housekeeperRankings: buildHousekeeperRankings(
      completedSessions,
      program,
      periodBounds.start,
      periodBounds.end,
      activeRooms.length,
      memberNames
    ),
    topInspectors: buildTopInspectors(
      completedSessions,
      program,
      periodBounds.start,
      periodBounds.end,
      memberNames
    ),
    thresholds: {
      lowScore: settings.low_score_threshold,
      strongScore: settings.strong_score_threshold,
    },
  };
}

export const ROOM_HISTORY_LIMIT = 12;

export async function fetchRoomHistory(
  supabase: SupabaseClient,
  areaId: number
): Promise<{ history: RoomHistoryEntry[]; hasMore: boolean }> {
  const { data: sessions, error } = await supabase
    .from("inspection_sessions")
    .select(
      "id, inspection_program, completed_at, score_percent, earned_points, possible_points, failed_item_count, template_snapshot, inspector_id, associate_id"
    )
    .eq("area_id", areaId)
    .eq("status", "completed")
    .order("completed_at", { ascending: false })
    .limit(ROOM_HISTORY_LIMIT + 1);

  if (error) {
    throw new Error(error.message);
  }

  const sessionRows = sessions || [];
  const hasMore = sessionRows.length > ROOM_HISTORY_LIMIT;
  const limitedSessions = sessionRows.slice(0, ROOM_HISTORY_LIMIT);

  const inspectorIds = new Set<string>();
  const associateIds = new Set<string>();
  for (const row of limitedSessions) {
    if (row.inspector_id) inspectorIds.add(String(row.inspector_id));
    if (row.associate_id) associateIds.add(String(row.associate_id));
  }

  const memberIds = [...inspectorIds, ...associateIds];
  const members = await loadMemberNames(supabase, memberIds);

  const sessionIds = limitedSessions.map((row) => Number(row.id));
  const failedBySession = new Map<
    number,
    Array<{
      categoryKey: string;
      itemKey: string;
      label: string;
      itemNotes: string | null;
      photoUrl: string | null;
    }>
  >();

  if (sessionIds.length > 0) {
    const { data: failedRows } = await supabase
      .from("inspection_item_responses")
      .select(
        "inspection_id, category_key, item_key, label_snapshot, item_notes, photo_url"
      )
      .in("inspection_id", sessionIds)
      .eq("outcome", "fail")
      .order("sort_order");

    for (const row of failedRows || []) {
      const inspectionId = Number(row.inspection_id);
      const list = failedBySession.get(inspectionId) || [];
      const labelSnapshot = row.label_snapshot as { en?: string };
      list.push({
        categoryKey: String(row.category_key),
        itemKey: String(row.item_key),
        label: labelSnapshot?.en || String(row.item_key),
        itemNotes: row.item_notes ? String(row.item_notes) : null,
        photoUrl: row.photo_url ? String(row.photo_url) : null,
      });
      failedBySession.set(inspectionId, list);
    }
  }

  const history = limitedSessions.map((row) => {
    const snapshot = row.template_snapshot as { name?: string };
    return {
      id: Number(row.id),
      inspection_program: row.inspection_program as RoomHistoryEntry["inspection_program"],
      completed_at: String(row.completed_at),
      score_percent:
        row.score_percent === null ? null : deriveScorePercent(
          row.earned_points,
          row.possible_points,
          Number(row.score_percent)
        ),
      earned_points: Number(row.earned_points),
      possible_points: Number(row.possible_points),
      inspector_name: row.inspector_id
        ? members.get(String(row.inspector_id)) || null
        : null,
      associate_name: row.associate_id
        ? members.get(String(row.associate_id)) || null
        : null,
      failed_item_count: Number(row.failed_item_count),
      template_name: snapshot?.name || "Inspection",
      failedItems: failedBySession.get(Number(row.id)) || [],
    };
  });

  return { history, hasMore };
}

function buildTemplateSnapshot(template: PropertyInspectionTemplate) {
  return {
    id: template.id,
    name: template.name,
    template_type: template.template_type,
    standard_key: template.standard_key,
    property_version: template.property_version,
    content: template.content,
  };
}

export async function createInspectionSession(
  supabase: SupabaseClient,
  input: {
    areaId: number;
    templateId: number;
    inspectorId?: string | null;
    associateId?: string | null;
  }
) {
  const { data: templateRow, error: templateError } = await supabase
    .from("property_inspection_templates")
    .select("*")
    .eq("id", input.templateId)
    .single();

  if (templateError || !templateRow) {
    throw new Error("Template not found");
  }

  const template: PropertyInspectionTemplate = {
    id: Number(templateRow.id),
    standard_key: templateRow.standard_key ? String(templateRow.standard_key) : null,
    based_on_standard_version: templateRow.based_on_standard_version
      ? String(templateRow.based_on_standard_version)
      : null,
    name: String(templateRow.name),
    template_type: templateRow.template_type as PropertyInspectionTemplate["template_type"],
    status: templateRow.status as PropertyInspectionTemplate["status"],
    property_version: Number(templateRow.property_version),
    content: templateRow.content as PropertyTemplateContent,
    last_modified_at: String(templateRow.last_modified_at),
    created_at: String(templateRow.created_at),
  };

  const inspectionProgram = resolveInspectionProgram({
    standard_key: template.standard_key,
    template_type: template.template_type,
    name: template.name,
  });

  const { data, error } = await supabase
    .from("inspection_sessions")
    .insert([
      {
        area_id: input.areaId,
        template_id: input.templateId,
        inspection_program: inspectionProgram,
        status: "in_progress",
        inspector_id: input.inspectorId ?? null,
        associate_id: input.associateId ?? null,
        template_snapshot: buildTemplateSnapshot(template),
      },
    ])
    .select("*")
    .single();

  if (error || !data) {
    throw new Error(error?.message || "Unable to create inspection session");
  }

  return normalizeSession(data as SessionRow);
}

export async function fetchInspectionSession(
  supabase: SupabaseClient,
  id: number
) {
  const { data, error } = await supabase
    .from("inspection_sessions")
    .select("*")
    .eq("id", id)
    .single();

  if (error || !data) {
    throw new Error("Inspection session not found");
  }

  return normalizeSession(data as SessionRow);
}

export async function fetchInspectionResponses(
  supabase: SupabaseClient,
  inspectionId: number
): Promise<InspectionItemResponse[]> {
  const { data, error } = await supabase
    .from("inspection_item_responses")
    .select("*")
    .eq("inspection_id", inspectionId)
    .order("sort_order");

  if (error) {
    throw new Error(error.message);
  }

  return (data || []).map((row) => ({
    id: Number(row.id),
    inspection_id: Number(row.inspection_id),
    category_key: String(row.category_key),
    item_key: String(row.item_key),
    label_snapshot: row.label_snapshot as InspectionItemResponse["label_snapshot"],
    point_value: Number(row.point_value),
    required: Boolean(row.required),
    outcome: row.outcome as InspectionItemResponse["outcome"],
    points_earned: Number(row.points_earned),
    item_notes: row.item_notes ? String(row.item_notes) : null,
    photo_url: row.photo_url ? String(row.photo_url) : null,
    sort_order: Number(row.sort_order),
  }));
}

async function upsertAreaSummary(
  supabase: SupabaseClient,
  areaId: number,
  program: string,
  session: InspectionSession
) {
  const { data: openDefs } = await supabase
    .from("inspection_deficiencies")
    .select("id, occurrence_count")
    .eq("area_id", areaId)
    .eq("inspection_program", program)
    .eq("status", "open");

  const openCount = openDefs?.length || 0;
  const recurringCount =
    openDefs?.filter((row) => Number(row.occurrence_count) > 1).length || 0;

  await supabase.from("area_inspection_summary").upsert(
    {
      area_id: areaId,
      inspection_program: program,
      last_completed_at: session.completed_at,
      last_inspection_id: session.id,
      last_score_percent: deriveScorePercent(
        session.earned_points,
        session.possible_points,
        session.score_percent
      ),
      last_inspector_id: session.inspector_id,
      last_failed_item_count: session.failed_item_count,
      open_deficiency_count: openCount,
      recurring_deficiency_count: recurringCount,
      never_inspected: false,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "area_id,inspection_program" }
  );
}

async function createDeficiencyForFail(
  supabase: SupabaseClient,
  input: {
    inspectionId: number;
    itemResponseId: number;
    areaId: number;
    program: string;
    categoryKey: string;
    itemKey: string;
    label: string;
    notes?: string;
  }
) {
  const recurrenceGroupKey = `${input.areaId}:${input.program}:${input.categoryKey}:${input.itemKey}`;

  const { data: existing } = await supabase
    .from("inspection_deficiencies")
    .select("id, occurrence_count")
    .eq("recurrence_group_key", recurrenceGroupKey)
    .eq("status", "open")
    .maybeSingle();

  if (existing) {
    await supabase
      .from("inspection_deficiencies")
      .update({
        inspection_id: input.inspectionId,
        item_response_id: input.itemResponseId,
        item_label_snapshot: input.label,
        description: input.notes || null,
        occurrence_count: Number(existing.occurrence_count) + 1,
        last_seen_at: new Date().toISOString(),
      })
      .eq("id", existing.id);
    return;
  }

  await supabase.from("inspection_deficiencies").insert([
    {
      inspection_id: input.inspectionId,
      item_response_id: input.itemResponseId,
      area_id: input.areaId,
      inspection_program: input.program,
      category_key: input.categoryKey,
      item_key: input.itemKey,
      item_label_snapshot: input.label,
      description: input.notes || null,
      recurrence_group_key: recurrenceGroupKey,
      occurrence_count: 1,
    },
  ]);
}

export async function completeInspectionSession(
  supabase: SupabaseClient,
  id: number,
  input: {
    responses: ItemResponseInput[];
    sessionNotes?: string;
  }
) {
  const session = await fetchInspectionSession(supabase, id);
  if (session.status === "completed") {
    throw new Error("Inspection already completed");
  }

  const snapshot = session.template_snapshot as {
    content?: PropertyTemplateContent;
    name?: string;
  };
  const content = snapshot.content;
  if (!content?.categories?.length) {
    throw new Error("Template snapshot is missing checklist content");
  }

  const responseRows: Array<Record<string, unknown>> = [];
  let sortOrder = 0;
  const scoredItems: Array<{
    itemKey: string;
    pointValue: number;
    outcome: "pass" | "fail" | "na";
  }> = [];

  for (const category of content.categories) {
    for (const item of category.items) {
      const response = input.responses.find(
        (entry) =>
          entry.categoryKey === category.key && entry.itemKey === item.key
      );

      const outcome = response?.outcome;
      if (!outcome) {
        if (item.required) {
          throw new Error(`Missing required response for ${item.label.en}`);
        }
        continue;
      }

      const weight = Math.max(0, Number(item.pointValue) || 0);
      const pointsEarned = outcome === "pass" ? weight : 0;
      responseRows.push({
        inspection_id: id,
        category_key: category.key,
        item_key: item.key,
        label_snapshot: item.label,
        point_value: weight,
        required: item.required,
        outcome,
        points_earned: pointsEarned,
        item_notes: response.itemNotes || null,
        photo_url: response.photoUrl || null,
        sort_order: sortOrder++,
      });

      scoredItems.push({
        itemKey: item.key,
        pointValue: weight,
        outcome,
      });
    }
  }

  const score = calculateInspectionScore(scoredItems);
  const failedItemCount = scoredItems.filter((item) => item.outcome === "fail").length;
  const completedAt = new Date().toISOString();
  const scorePercent = deriveScorePercent(score.earnedPoints, score.possiblePoints);

  await supabase.from("inspection_item_responses").delete().eq("inspection_id", id);

  const { data: insertedResponses, error: responseError } = await supabase
    .from("inspection_item_responses")
    .insert(responseRows)
    .select("*");

  if (responseError) {
    throw new Error(responseError.message);
  }

  const { data: updatedSession, error: sessionError } = await supabase
    .from("inspection_sessions")
    .update({
      status: "completed",
      completed_at: completedAt,
      earned_points: score.earnedPoints,
      possible_points: score.possiblePoints,
      score_percent: scorePercent,
      failed_item_count: failedItemCount,
      session_notes: input.sessionNotes || null,
      updated_at: completedAt,
    })
    .eq("id", id)
    .select("*")
    .single();

  if (sessionError || !updatedSession) {
    throw new Error(sessionError?.message || "Unable to complete inspection");
  }

  const completed = normalizeSession(updatedSession as SessionRow);

  for (const row of insertedResponses || []) {
    if (row.outcome !== "fail") continue;
    const label =
      (row.label_snapshot as { en?: string })?.en || String(row.item_key);
    await createDeficiencyForFail(supabase, {
      inspectionId: id,
      itemResponseId: Number(row.id),
      areaId: session.area_id,
      program: session.inspection_program,
      categoryKey: String(row.category_key),
      itemKey: String(row.item_key),
      label,
      notes: row.item_notes ? String(row.item_notes) : undefined,
    });
  }

  await upsertAreaSummary(
    supabase,
    session.area_id,
    session.inspection_program,
    completed
  );

  return completed;
}

export async function saveInspectionProgress(
  supabase: SupabaseClient,
  id: number,
  input: {
    responses: ItemResponseInput[];
    sessionNotes?: string;
  }
) {
  const session = await fetchInspectionSession(supabase, id);
  if (session.status === "completed") {
    throw new Error("Inspection already completed");
  }

  const snapshot = session.template_snapshot as { content?: PropertyTemplateContent };
  const content = snapshot.content;
  if (!content) {
    throw new Error("Template snapshot is missing checklist content");
  }

  await supabase.from("inspection_item_responses").delete().eq("inspection_id", id);

  const responseRows: Array<Record<string, unknown>> = [];
  let sortOrder = 0;

  for (const category of content.categories) {
    for (const item of category.items) {
      const response = input.responses.find(
        (entry) =>
          entry.categoryKey === category.key && entry.itemKey === item.key
      );
      if (!response?.outcome) continue;

      responseRows.push({
        inspection_id: id,
        category_key: category.key,
        item_key: item.key,
        label_snapshot: item.label,
        point_value: Math.max(0, Number(item.pointValue) || 0),
        required: item.required,
        outcome: response.outcome,
        points_earned: response.outcome === "pass" ? item.pointValue : 0,
        item_notes: response.itemNotes || null,
        photo_url: response.photoUrl || null,
        sort_order: sortOrder++,
      });
    }
  }

  if (responseRows.length > 0) {
    const { error } = await supabase
      .from("inspection_item_responses")
      .insert(responseRows);
    if (error) throw new Error(error.message);
  }

  const { data, error } = await supabase
    .from("inspection_sessions")
    .update({
      session_notes: input.sessionNotes ?? session.session_notes,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select("*")
    .single();

  if (error || !data) {
    throw new Error(error?.message || "Unable to save progress");
  }

  return normalizeSession(data as SessionRow);
}

export async function fetchActiveTemplates(supabase: SupabaseClient) {
  const { data, error } = await supabase
    .from("property_inspection_templates")
    .select("id, name, template_type, standard_key, status")
    .eq("status", "Active")
    .order("name");

  if (error) {
    throw new Error(error.message);
  }

  return (data || []).map((row) => ({
    id: Number(row.id),
    name: String(row.name),
    template_type: String(row.template_type),
    standard_key: row.standard_key ? String(row.standard_key) : null,
    inspection_program: resolveInspectionProgram({
      standard_key: row.standard_key ? String(row.standard_key) : null,
      template_type: String(row.template_type),
      name: String(row.name),
    }),
  }));
}

export function getChecklistFromSnapshot(session: InspectionSession) {
  const snapshot = session.template_snapshot as {
    content?: PropertyTemplateContent;
    name?: string;
  };
  return {
    name: snapshot.name || "Inspection",
    content: snapshot.content || standardToPropertyContent({
      key: "custom",
      version: "1",
      name: "Custom",
      templateType: "Custom",
      description: "",
      categories: [],
    }),
  };
}
