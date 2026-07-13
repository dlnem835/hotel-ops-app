import { getClientSession } from "@/app/lib/auth";
import { buildMemberDisplayNameResolver } from "@/app/lib/member-display-name";
import {
  formatPassOnBusinessDateHeader,
  getHotelBusinessDateString,
  getHotelBusinessDateWindow,
  shiftHotelBusinessDateString,
} from "@/app/lib/hotel-business-date";
import { supabase } from "@/app/supabaseClient";
import { tenantFetch } from "@/app/lib/tenant/tenant-fetch";

export type PassOnReply = {
  id: number;
  entry_id: number;
  reply_author: string;
  reply_message: string;
  created_at: string;
};

export type PassOnView = {
  id: number;
  entry_id: number;
  auth_user_id: string;
  viewed_at: string;
};

export type PassOnEntry = {
  id: number;
  subject: string;
  author: string;
  priority: string;
  message: string;
  entry_date: string;
  created_at: string;
  edited_at?: string | null;
  pass_on_log_replies: PassOnReply[];
  pass_on_log_views: PassOnView[];
};

export type TeamMember = {
  auth_user_id: string;
  username: string | null;
  first_name: string | null;
  last_name: string | null;
};

export function getLocalDateString(date = new Date()): string {
  return getHotelBusinessDateString(date);
}

export function resolveEntryDate(entry: Pick<PassOnEntry, "entry_date" | "created_at">): string {
  if (entry.entry_date) return String(entry.entry_date);
  if (entry.created_at) return getHotelBusinessDateString(new Date(entry.created_at));
  return "";
}

export function formatDateTime(value: string): string {
  return new Date(value).toLocaleString([], {
    month: "numeric",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function dateHeader(dateString: string): string {
  return formatPassOnBusinessDateHeader(dateString);
}

export function isRecentPassOnEntry(entryDate: string, recentDays = 90): boolean {
  if (!entryDate) return true;

  const { today } = getHotelBusinessDateWindow();
  if (entryDate >= today) return true;

  const cutoff = getHotelBusinessDateString();
  const cutoffShifted = shiftHotelBusinessDateString(cutoff, -recentDays);
  return entryDate >= cutoffShifted;
}

export function filterRecentPassOnEntries(entries: PassOnEntry[], recentDays = 90): PassOnEntry[] {
  return entries.filter((entry) => isRecentPassOnEntry(resolveEntryDate(entry), recentDays));
}

export function filterPassOnEntriesBySearch(
  entries: PassOnEntry[],
  search: string
): PassOnEntry[] {
  const query = search.trim().toLowerCase();
  if (!query) return entries;

  return entries.filter((entry) =>
    `${entry.subject} ${entry.author} ${entry.message} ${entry.priority}`
      .toLowerCase()
      .includes(query)
  );
}

export function groupEntriesByDate(entries: PassOnEntry[]): [string, PassOnEntry[]][] {
  const grouped = entries.reduce<Record<string, PassOnEntry[]>>((acc, entry) => {
    const date = resolveEntryDate(entry);
    if (!date) return acc;
    if (!acc[date]) acc[date] = [];
    acc[date].push(entry);
    return acc;
  }, {});

  return Object.entries(grouped).sort(([a], [b]) => b.localeCompare(a));
}

export type PassOnListResult = {
  entries: PassOnEntry[];
  readBaseline: string | null;
};

export async function fetchPassOnEntries(): Promise<PassOnListResult> {
  const response = await tenantFetch("/api/pass-on");
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || "Unable to load pass-on log");
  return {
    entries: (result.entries || []) as PassOnEntry[],
    readBaseline: (result.readBaseline as string | null | undefined) ?? null,
  };
}

export async function fetchPassOnEntry(id: number): Promise<PassOnEntry | null> {
  const response = await tenantFetch(`/api/pass-on/${id}`);
  if (response.status === 404) return null;
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || "Unable to load pass-on entry");
  return (result.entry as PassOnEntry | null) ?? null;
}

export async function fetchTeamMembers(): Promise<TeamMember[]> {
  const { data, error } = await supabase
    .from("team_members")
    .select("auth_user_id, username, first_name, last_name");

  if (error) throw new Error(error.message);
  return (data || []) as TeamMember[];
}

export async function resolveCurrentUserName(): Promise<string | null> {
  const session = await getClientSession();

  if (!session) return null;

  const { data: teamMember } = await supabase
    .from("team_members")
    .select("username")
    .eq("auth_user_id", session.user.id)
    .maybeSingle();

  return teamMember?.username || "unknown";
}

export async function markPassOnAsViewed(entryId: number): Promise<void> {
  const session = await getClientSession();
  if (!session) return;

  await tenantFetch(`/api/pass-on/${entryId}/views`, { method: "POST" });
}

export async function createPassOnEntry(input: {
  subject: string;
  message: string;
  priority: string;
  entryDate: string;
  author: string;
}): Promise<void> {
  const now = new Date();
  const selectedDateTime = new Date(
    `${input.entryDate}T${String(now.getHours()).padStart(2, "0")}:${String(
      now.getMinutes()
    ).padStart(2, "0")}:00`
  ).toISOString();

  const response = await tenantFetch("/api/pass-on", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      subject: input.subject,
      author: input.author,
      priority: input.priority,
      message: input.message,
      created_at: selectedDateTime,
      entry_date: input.entryDate,
    }),
  });

  if (!response.ok) {
    const result = await response.json().catch(() => ({}));
    throw new Error(result.error || "Unable to save entry");
  }
}

export async function addPassOnReply(entryId: number, author: string, text: string): Promise<void> {
  const response = await tenantFetch(`/api/pass-on/${entryId}/replies`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ reply_author: author, reply_message: text }),
  });

  if (!response.ok) {
    const result = await response.json().catch(() => ({}));
    throw new Error(result.error || "Unable to send reply");
  }
}

export function memberDisplayName(
  members: TeamMember[],
  authUserId: string
): string {
  const member = members.find((row) => row.auth_user_id === authUserId);
  if (!member) return "Team member";
  return buildMemberDisplayNameResolver(members).displayForAuthUserId(authUserId) || "Team member";
}

export function resolvePassOnAuthorDisplay(
  members: TeamMember[],
  storedAuthor: string | null | undefined
): string {
  if (!storedAuthor) return "Unknown";
  return buildMemberDisplayNameResolver(members).resolveStoredValue(storedAuthor) || storedAuthor;
}

export { isPassOnReadByUser } from "@/app/pass-on-log/lib/pass-on-views";

