import {
  fetchMemberDisplayNameResolver,
  formatMemberDisplayName,
} from "@/app/lib/member-display-name";
import { deriveScorePercent } from "@/app/inspections/lib/scoring";
import {
  formatInspectionDuration,
  getInspectionDurationMs,
} from "@/app/inspections/lib/inspection-duration";
import type { InspectionProgram } from "@/app/inspections/lib/inspection-types";
import { createReportsSupabaseClient } from "@/app/reports/lib/lost-found-report-data";
import type { InspectionReportVariant } from "@/app/reports/lib/inspection-report-sample-data";
import {
  formatInspectionProgramLabel,
  matchesInspectionReportFilters,
  programInVariantScope,
  sessionMatchesVariantProgram,
} from "@/app/reports/lib/inspection-report-filter-utils";
import type {
  InspectionReportFilters,
  InspectionReportSource,
  InspectionReportSourceFailedItem,
  InspectionReportSourceRoom,
  InspectionReportSourceSession,
} from "@/app/reports/lib/inspection-report-types";

type SessionRow = {
  id: number;
  area_id: number;
  inspection_program: string;
  inspector_id: string | null;
  associate_id: string | null;
  started_at: string;
  completed_at: string | null;
  completed_by: string | null;
  score_percent: number | null;
  earned_points: number | null;
  possible_points: number | null;
  failed_item_count: number | null;
  template_snapshot: Record<string, unknown> | null;
  status: string;
};

type FailedResponseRow = {
  id: number;
  inspection_id: number;
  category_key: string;
  item_key: string;
  label_snapshot: { en?: string; es?: string } | null;
  item_notes: string | null;
  outcome: string;
};

type AreaRow = {
  id: number;
  name: string;
  status: string;
  inspection_enabled: boolean | null;
};

type TeamMemberRow = {
  id: number;
  auth_user_id: string | null;
  username: string | null;
  first_name: string | null;
  last_name: string | null;
};

function templateNameFromSnapshot(snapshot: Record<string, unknown> | null | undefined): string {
  if (!snapshot || typeof snapshot !== "object") return "Inspection";
  const name = (snapshot as { name?: string }).name;
  return name?.trim() || "Inspection";
}

function categoryLabelFromSnapshot(
  snapshot: Record<string, unknown> | null | undefined,
  categoryKey: string
): string {
  if (!snapshot || typeof snapshot !== "object") return categoryKey;
  const categories = (snapshot as { categories?: Array<{ key?: string; label?: string }> })
    .categories;
  const match = categories?.find((category) => category.key === categoryKey);
  return match?.label?.trim() || categoryKey;
}

function itemLabelFromSnapshot(labelSnapshot: FailedResponseRow["label_snapshot"]): string {
  return labelSnapshot?.en?.trim() || labelSnapshot?.es?.trim() || "Failed item";
}

function resolveSessionScore(row: SessionRow): number | null {
  return deriveScorePercent(
    row.earned_points,
    row.possible_points,
    row.score_percent === null || row.score_percent === undefined
      ? null
      : Number(row.score_percent)
  );
}

function buildFilterOptions(
  sessions: InspectionReportSourceSession[],
  members: TeamMemberRow[]
): { associates: string[]; inspectors: string[] } {
  const associateNames = new Set<string>();
  const inspectorNames = new Set<string>();

  for (const session of sessions) {
    if (session.associateName && session.associateName !== "—") {
      associateNames.add(session.associateName);
    }
    if (session.inspectorName && session.inspectorName !== "—") {
      inspectorNames.add(session.inspectorName);
    }
  }

  for (const member of members) {
    const label = formatMemberDisplayName(member);
    if (label) {
      associateNames.add(label);
      inspectorNames.add(label);
    }
  }

  return {
    associates: ["All", ...Array.from(associateNames).sort((a, b) => a.localeCompare(b))],
    inspectors: ["All", ...Array.from(inspectorNames).sort((a, b) => a.localeCompare(b))],
  };
}

export async function fetchInspectionReportSource(
  variant: InspectionReportVariant
): Promise<InspectionReportSource> {
  const supabase = createReportsSupabaseClient();

  const [sessionsResult, failedResponsesResult, areasResult, membersResult, memberResolver] =
    await Promise.all([
      supabase
        .from("inspection_sessions")
        .select(
          "id, area_id, inspection_program, inspector_id, associate_id, started_at, completed_at, completed_by, score_percent, earned_points, possible_points, failed_item_count, template_snapshot, status"
        )
        .eq("status", "completed")
        .not("completed_at", "is", null),
      supabase
        .from("inspection_item_responses")
        .select("id, inspection_id, category_key, item_key, label_snapshot, item_notes, outcome")
        .eq("outcome", "fail"),
      supabase
        .from("buildings_and_areas")
        .select("id, name, status, inspection_enabled")
        .eq("area_type", "Guest Room")
        .order("name"),
      supabase
        .from("team_members")
        .select("id, auth_user_id, username, first_name, last_name"),
      fetchMemberDisplayNameResolver(supabase),
    ]);

  if (sessionsResult.error) throw new Error(sessionsResult.error.message);
  if (failedResponsesResult.error) throw new Error(failedResponsesResult.error.message);
  if (areasResult.error) throw new Error(areasResult.error.message);
  if (membersResult.error) throw new Error(membersResult.error.message);

  const areaNameById = new Map<number, string>();
  const guestRooms: InspectionReportSourceRoom[] = [];
  for (const area of (areasResult.data ?? []) as AreaRow[]) {
    const id = Number(area.id);
    areaNameById.set(id, String(area.name));
    guestRooms.push({
      id,
      name: String(area.name),
      status: String(area.status),
      inspectionEnabled: Boolean(area.inspection_enabled),
    });
  }

  const sessions: InspectionReportSourceSession[] = [];
  const sessionById = new Map<number, InspectionReportSourceSession>();
  const sessionSnapshotById = new Map<number, Record<string, unknown> | null>();

  for (const row of (sessionsResult.data ?? []) as SessionRow[]) {
    const program = row.inspection_program as InspectionProgram;
    if (!programInVariantScope(program, variant)) continue;

    const completedAt = String(row.completed_at);
    const durationMs = getInspectionDurationMs(row.started_at, completedAt);

    const session: InspectionReportSourceSession = {
      id: Number(row.id),
      areaId: Number(row.area_id),
      areaName: areaNameById.get(Number(row.area_id)) || "—",
      inspectionProgram: program,
      templateName: templateNameFromSnapshot(row.template_snapshot),
      inspectorId: row.inspector_id ? String(row.inspector_id) : null,
      associateId: row.associate_id ? String(row.associate_id) : null,
      inspectorName: row.inspector_id
        ? memberResolver.displayForMemberId(String(row.inspector_id)) || "—"
        : row.completed_by?.trim() || "—",
      associateName: row.associate_id
        ? memberResolver.displayForMemberId(String(row.associate_id)) || "—"
        : "—",
      startedAt: String(row.started_at),
      completedAt,
      completedBy: row.completed_by ? String(row.completed_by) : null,
      scorePercent: resolveSessionScore(row),
      failedItemCount: Number(row.failed_item_count ?? 0),
      durationMs,
      durationLabel: formatInspectionDuration(row.started_at, completedAt),
    };

    sessions.push(session);
    sessionById.set(session.id, session);
    sessionSnapshotById.set(session.id, row.template_snapshot);
  }

  const failedItems: InspectionReportSourceFailedItem[] = [];
  for (const row of (failedResponsesResult.data ?? []) as FailedResponseRow[]) {
    const session = sessionById.get(Number(row.inspection_id));
    if (!session) continue;

    failedItems.push({
      id: Number(row.id),
      sessionId: session.id,
      areaId: session.areaId,
      areaName: session.areaName,
      categoryKey: String(row.category_key),
      categoryLabel: categoryLabelFromSnapshot(
        sessionSnapshotById.get(session.id) ?? null,
        String(row.category_key)
      ),
      itemKey: String(row.item_key),
      itemLabel: itemLabelFromSnapshot(row.label_snapshot),
      itemNotes: row.item_notes ? String(row.item_notes) : null,
      inspectorName: session.inspectorName,
      associateName: session.associateName,
      completedAt: session.completedAt,
      scorePercent: session.scorePercent,
      inspectionProgram: session.inspectionProgram,
      templateName: session.templateName,
    });
  }

  const filterOptions = buildFilterOptions(
    sessions,
    (membersResult.data ?? []) as TeamMemberRow[]
  );

  return {
    variant,
    sessions,
    failedItems,
    guestRooms,
    associateOptions: filterOptions.associates,
    inspectorOptions: filterOptions.inspectors,
  };
}

export function filterSourceSessions(
  source: InspectionReportSource,
  filters: InspectionReportFilters
): InspectionReportSourceSession[] {
  return source.sessions.filter((session) =>
    matchesInspectionReportFilters(session, filters, source.variant)
  );
}

export function getInspectionTypeLabel(session: InspectionReportSourceSession): string {
  return session.templateName || formatInspectionProgramLabel(session.inspectionProgram);
}
