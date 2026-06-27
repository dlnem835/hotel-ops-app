import { supabase } from "@/app/supabaseClient";

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
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function resolveEntryDate(entry: Pick<PassOnEntry, "entry_date" | "created_at">): string {
  if (entry.entry_date) return String(entry.entry_date);
  if (entry.created_at) return getLocalDateString(new Date(entry.created_at));
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
  const today = getLocalDateString();

  const yesterdayDate = new Date();
  yesterdayDate.setDate(yesterdayDate.getDate() - 1);
  const yesterday = getLocalDateString(yesterdayDate);

  const tomorrowDate = new Date();
  tomorrowDate.setDate(tomorrowDate.getDate() + 1);
  const tomorrow = getLocalDateString(tomorrowDate);

  if (dateString === today) return "Today";
  if (dateString === tomorrow) return "Tomorrow";
  if (dateString === yesterday) return "Yesterday";

  if (dateString > tomorrow) {
    return `Scheduled · ${new Date(`${dateString}T00:00:00`).toLocaleDateString([], {
      weekday: "long",
      month: "long",
      day: "numeric",
      year: "numeric",
    })}`;
  }

  return new Date(`${dateString}T00:00:00`).toLocaleDateString([], {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

export function isRecentPassOnEntry(entryDate: string, recentDays = 90): boolean {
  if (!entryDate) return true;

  const today = getLocalDateString();
  if (entryDate >= today) return true;

  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - recentDays);
  return new Date(`${entryDate}T12:00:00`) >= cutoff;
}

export function filterRecentPassOnEntries(entries: PassOnEntry[], recentDays = 90): PassOnEntry[] {
  return entries.filter((entry) => isRecentPassOnEntry(resolveEntryDate(entry), recentDays));
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

export async function fetchPassOnEntries(): Promise<PassOnEntry[]> {
  const { data, error } = await supabase
    .from("pass_on_log")
    .select("*, pass_on_log_replies(*), pass_on_log_views(*)")
    .order("entry_date", { ascending: false })
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);
  return (data || []) as PassOnEntry[];
}

export async function fetchPassOnEntry(id: number): Promise<PassOnEntry | null> {
  const { data, error } = await supabase
    .from("pass_on_log")
    .select("*, pass_on_log_replies(*), pass_on_log_views(*)")
    .eq("id", id)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return (data as PassOnEntry | null) ?? null;
}

export async function fetchTeamMembers(): Promise<TeamMember[]> {
  const { data, error } = await supabase
    .from("team_members")
    .select("auth_user_id, username, first_name, last_name");

  if (error) throw new Error(error.message);
  return (data || []) as TeamMember[];
}

export async function resolveCurrentUserName(): Promise<string | null> {
  const session = await getPassOnSession();

  if (!session) return null;

  const { data: teamMember } = await supabase
    .from("team_members")
    .select("username")
    .eq("auth_user_id", session.user.id)
    .maybeSingle();

  return teamMember?.username || "unknown";
}

export async function markPassOnAsViewed(entryId: number): Promise<void> {
  const session = await getPassOnSession();

  if (!session) return;

  await supabase.from("pass_on_log_views").upsert(
    {
      entry_id: entryId,
      auth_user_id: session.user.id,
      viewed_at: new Date().toISOString(),
    },
    { onConflict: "entry_id,auth_user_id" }
  );
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

  const { error } = await supabase.from("pass_on_log").insert([
    {
      subject: input.subject,
      author: input.author,
      priority: input.priority,
      message: input.message,
      created_at: selectedDateTime,
      entry_date: input.entryDate,
    },
  ]);

  if (error) throw new Error(error.message);
}

export async function addPassOnReply(entryId: number, author: string, text: string): Promise<void> {
  const { error } = await supabase.from("pass_on_log_replies").insert([
    {
      entry_id: entryId,
      reply_author: author,
      reply_message: text,
    },
  ]);

  if (error) throw new Error(error.message);
}

export function memberDisplayName(
  members: TeamMember[],
  authUserId: string
): string {
  const member = members.find((row) => row.auth_user_id === authUserId);
  if (!member) return "Team member";
  return (
    member.username ||
    `${member.first_name || ""} ${member.last_name || ""}`.trim() ||
    "Team member"
  );
}

const SESSION_TIMEOUT_MS = 8000;

export async function getPassOnSession() {
  try {
    const result = await Promise.race([
      supabase.auth.getSession(),
      new Promise<null>((resolve) => window.setTimeout(() => resolve(null), SESSION_TIMEOUT_MS)),
    ]);

    if (!result || !("data" in result)) return null;
    return result.data.session;
  } catch {
    return null;
  }
}
