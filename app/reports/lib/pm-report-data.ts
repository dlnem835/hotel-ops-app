import type { SupabaseClient } from "@supabase/supabase-js";
import {
  fetchMemberDisplayNameResolver,
  formatMemberDisplayName,
} from "@/app/lib/member-display-name";
import type { PmChecklist, PmFrequency } from "@/app/maintenance/lib/pm-types";
import { PM_FREQUENCY_LABELS } from "@/app/maintenance/lib/pm-types";
import { createReportsSupabaseClient } from "@/app/reports/lib/lost-found-report-data";
import { PM_COMPLETED_BY_ELIGIBLE_JOB_TITLES } from "@/app/reports/lib/pm-report-sample-data";
import type {
  PmReportSource,
  PmReportSourceOccurrence,
  PmReportSourceSchedule,
} from "@/app/reports/lib/pm-report-types";

type TemplateRow = {
  id: number;
  name: string;
  frequency: string;
  checklist: PmChecklist;
  status: string;
  pm_schedule_assignments: AssignmentRow[];
};

type AssignmentRow = {
  id: number;
  template_id: number;
  area_id: number | null;
  asset_label: string | null;
  start_date: string;
  end_date: string | null;
  status: string;
};

type OccurrenceRow = {
  id: number;
  template_id: number;
  assignment_id: number;
  due_date: string;
  status: string;
  responses: PmReportSourceOccurrence["responses"];
  completed_at: string | null;
  completed_by: string | null;
};

type TeamMemberRow = {
  id: number;
  auth_user_id: string | null;
  username: string | null;
  first_name: string | null;
  last_name: string | null;
  job_title: string | null;
  role: string | null;
};

function buildStepLabelMap(
  templates: TemplateRow[]
): Map<number, Map<string, string>> {
  const map = new Map<number, Map<string, string>>();

  for (const template of templates) {
    const stepMap = new Map<string, string>();
    for (const category of template.checklist?.categories ?? []) {
      for (const step of category.steps ?? []) {
        stepMap.set(step.key, step.label);
      }
    }
    map.set(Number(template.id), stepMap);
  }

  return map;
}

function isEligibleCompletedByMember(member: TeamMemberRow): boolean {
  const jobTitle = (member.job_title || "").trim();
  if (
    PM_COMPLETED_BY_ELIGIBLE_JOB_TITLES.some(
      (title) => title.toLowerCase() === jobTitle.toLowerCase()
    )
  ) {
    return true;
  }

  const role = (member.role || "").trim().toLowerCase();
  return role === "maintenance" || role === "management";
}

function buildCompletedByOptions(members: TeamMemberRow[]): string[] {
  const labels = members
    .filter(isEligibleCompletedByMember)
    .map((member) => formatMemberDisplayName(member))
    .filter(Boolean);

  return ["All", ...Array.from(new Set(labels)).sort((a, b) => a.localeCompare(b))];
}

function resolveAreaLabel(
  assignment: AssignmentRow,
  areaNameById: Map<number, string>
): string {
  if (assignment.area_id != null) {
    const areaName = areaNameById.get(Number(assignment.area_id)) || "—";
    return assignment.asset_label?.trim()
      ? `${assignment.asset_label.trim()} — ${areaName}`
      : areaName;
  }

  return assignment.asset_label?.trim() || "—";
}

export async function fetchPmReportSource(
  supabase: SupabaseClient = createReportsSupabaseClient()
): Promise<PmReportSource> {

  const [templatesResult, areasResult, occurrencesResult, membersResult, memberResolver] =
    await Promise.all([
      supabase.from("pm_templates").select("*, pm_schedule_assignments(*)"),
      supabase
        .from("buildings_and_areas")
        .select("id, name")
        .order("name"),
      supabase
        .from("pm_occurrences")
        .select(
          "id, template_id, assignment_id, due_date, status, responses, completed_at, completed_by"
        ),
      supabase
        .from("team_members")
        .select("id, auth_user_id, username, first_name, last_name, job_title, role"),
      fetchMemberDisplayNameResolver(supabase),
    ]);

  if (templatesResult.error) {
    throw new Error(templatesResult.error.message);
  }
  if (areasResult.error) {
    throw new Error(areasResult.error.message);
  }
  if (occurrencesResult.error) {
    throw new Error(occurrencesResult.error.message);
  }
  if (membersResult.error) {
    throw new Error(membersResult.error.message);
  }

  const templates = (templatesResult.data ?? []) as TemplateRow[];
  const areaNameById = new Map<number, string>();
  for (const area of areasResult.data ?? []) {
    areaNameById.set(Number(area.id), String(area.name));
  }

  const schedules: PmReportSourceSchedule[] = [];
  for (const template of templates) {
    const frequency = template.frequency as PmFrequency;
    for (const assignment of template.pm_schedule_assignments ?? []) {
      schedules.push({
        assignmentId: Number(assignment.id),
        templateId: Number(template.id),
        templateName: String(template.name),
        frequency,
        areaLabel: resolveAreaLabel(assignment, areaNameById),
        startDate: String(assignment.start_date),
        endDate: assignment.end_date ? String(assignment.end_date) : null,
        templateStatus: String(template.status),
        assignmentStatus: String(assignment.status),
      });
    }
  }

  const occurrences: PmReportSourceOccurrence[] = (
    (occurrencesResult.data ?? []) as OccurrenceRow[]
  ).map((row) => ({
    id: Number(row.id),
    templateId: Number(row.template_id),
    assignmentId: Number(row.assignment_id),
    dueDate: String(row.due_date),
    status: row.status as PmReportSourceOccurrence["status"],
    responses: row.responses,
    completedAt: row.completed_at ? String(row.completed_at) : null,
    completedBy: row.completed_by ? String(row.completed_by) : null,
  }));

  const members = (membersResult.data ?? []) as TeamMemberRow[];

  return {
    schedules,
    occurrences,
    completedByOptions: buildCompletedByOptions(members),
    stepLabelsByTemplateId: buildStepLabelMap(templates),
    resolveCompletedBy: (stored) => memberResolver.resolveStoredValue(stored),
  };
}

export function getPmFrequencyLabel(frequency: PmFrequency): string {
  return PM_FREQUENCY_LABELS[frequency];
}
