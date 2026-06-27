import { getSupabaseAdmin } from "@/app/maintenance/lib/pm-db";
import {
  filterRecentPassOnEntries,
  groupEntriesByDate,
  PassOnEntry,
  TeamMember,
} from "./pass-on-shared";

async function queryPassOnEntries(): Promise<PassOnEntry[]> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("pass_on_log")
    .select("*, pass_on_log_replies(*), pass_on_log_views(*)")
    .order("entry_date", { ascending: false })
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);
  return (data || []) as PassOnEntry[];
}

export async function loadPassOnListForMobile(): Promise<PassOnEntry[]> {
  const entries = await queryPassOnEntries();
  return filterRecentPassOnEntries(entries);
}

export async function loadPassOnEntryForMobile(id: number): Promise<PassOnEntry | null> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("pass_on_log")
    .select("*, pass_on_log_replies(*), pass_on_log_views(*)")
    .eq("id", id)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return (data as PassOnEntry | null) ?? null;
}

export async function fetchTeamMembers(): Promise<TeamMember[]> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("team_members")
    .select("auth_user_id, username, first_name, last_name");

  if (error) throw new Error(error.message);
  return (data || []) as TeamMember[];
}

export { groupEntriesByDate };
