import type { SupabaseClient } from "@supabase/supabase-js";
import { buildMemberDisplayNameResolver } from "@/app/lib/member-display-name";
import { createReportsSupabaseClient } from "@/app/reports/lib/lost-found-report-data";
import {
  buildEntryPreview,
  countEntryReads,
  derivePassOnShift,
  resolveAuthorAuthUserId,
  resolveAuthorDisplay,
} from "@/app/reports/lib/pass-on-report-filter-utils";
import type {
  PassOnReportSource,
  PassOnReportSourceEntry,
  PassOnReportTeamMember,
} from "@/app/reports/lib/pass-on-report-types";

type PassOnLogRow = {
  id: number;
  subject: string;
  author: string | null;
  priority: string | null;
  message: string | null;
  entry_date: string | null;
  created_at: string | null;
  edited_at?: string | null;
  pass_on_log_replies?: Array<{ created_at: string | null }> | null;
  pass_on_log_views?: Array<{ auth_user_id: string; viewed_at: string | null }> | null;
};

type TeamMemberRow = {
  auth_user_id: string;
  username: string | null;
  first_name: string | null;
  last_name: string | null;
  department: string | null;
};

function uniqueSorted(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))].sort((left, right) =>
    left.localeCompare(right, undefined, { sensitivity: "base" })
  );
}

function mapTeamMembers(rows: TeamMemberRow[]): PassOnReportTeamMember[] {
  const resolver = buildMemberDisplayNameResolver(rows);
  return rows
    .filter((row) => row.auth_user_id)
    .map((row) => ({
      authUserId: row.auth_user_id,
      username: row.username,
      firstName: row.first_name,
      lastName: row.last_name,
      department: row.department,
      displayName: resolver.displayForAuthUserId(row.auth_user_id) || row.username || "Team member",
    }));
}

function mapEntryRow(
  row: PassOnLogRow,
  members: PassOnReportTeamMember[]
): PassOnReportSourceEntry {
  const authorStored = row.author?.trim() || "";
  const authorDisplay = resolveAuthorDisplay(members, authorStored);
  const createdAt = row.created_at || "";
  const views = row.pass_on_log_views || [];
  const replies = row.pass_on_log_replies || [];
  const readCounts = countEntryReads({ views, replies }, members);

  return {
    id: row.id,
    subject: row.subject?.trim() || "(No subject)",
    message: row.message?.trim() || "",
    authorStored,
    authorDisplay,
    authorAuthUserId: resolveAuthorAuthUserId(members, authorStored),
    priority: row.priority?.trim() || "Normal",
    shift: derivePassOnShift(createdAt),
    entryDate: row.entry_date || "",
    createdAt,
    editedAt: row.edited_at ?? null,
    isEdited: Boolean(row.edited_at),
    preview: buildEntryPreview(row.message?.trim() || ""),
    views,
    replies,
    readCount: readCounts.readCount,
    unreadCount: readCounts.unreadCount,
  };
}

export async function fetchPassOnReportSource(
  supabase: SupabaseClient = createReportsSupabaseClient()
): Promise<PassOnReportSource> {

  const [entriesResult, membersResult] = await Promise.all([
    supabase
      .from("pass_on_log")
      .select("*, pass_on_log_replies(created_at), pass_on_log_views(auth_user_id, viewed_at)")
      .order("entry_date", { ascending: false })
      .order("created_at", { ascending: false }),
    supabase
      .from("team_members")
      .select("auth_user_id, username, first_name, last_name, department"),
  ]);

  if (entriesResult.error) {
    throw new Error(entriesResult.error.message);
  }
  if (membersResult.error) {
    throw new Error(membersResult.error.message);
  }

  const teamMembers = mapTeamMembers((membersResult.data || []) as TeamMemberRow[]);
  const entries = ((entriesResult.data || []) as PassOnLogRow[]).map((row) =>
    mapEntryRow(row, teamMembers)
  );

  // Property filter is UI-only until pass_on_log gains property_id.
  const createdByOptions = ["All", ...uniqueSorted(entries.map((entry) => entry.authorDisplay))];
  const departmentOptions = [
    "All",
    ...uniqueSorted(
      teamMembers.map((member) => member.department?.trim() || "").filter(Boolean)
    ),
  ];
  const userOptions = teamMembers
    .map((member) => ({
      authUserId: member.authUserId,
      displayName: member.displayName,
      department: member.department?.trim() || "—",
    }))
    .sort((left, right) =>
      left.displayName.localeCompare(right.displayName, undefined, { sensitivity: "base" })
    );

  return {
    entries,
    teamMembers,
    filterOptions: {
      createdByOptions,
      departmentOptions,
      userOptions,
    },
  };
}

export async function fetchPassOnReportEntryById(
  entryId: number
): Promise<PassOnReportSourceEntry | null> {
  const supabase = createReportsSupabaseClient();
  const [entryResult, membersResult] = await Promise.all([
    supabase
      .from("pass_on_log")
      .select("*, pass_on_log_replies(created_at), pass_on_log_views(auth_user_id, viewed_at)")
      .eq("id", entryId)
      .maybeSingle(),
    supabase
      .from("team_members")
      .select("auth_user_id, username, first_name, last_name, department"),
  ]);

  if (entryResult.error) throw new Error(entryResult.error.message);
  if (membersResult.error) throw new Error(membersResult.error.message);
  if (!entryResult.data) return null;

  const teamMembers = mapTeamMembers((membersResult.data || []) as TeamMemberRow[]);
  return mapEntryRow(entryResult.data as PassOnLogRow, teamMembers);
}
