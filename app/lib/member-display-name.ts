import { SupabaseClient } from "@supabase/supabase-js";

export type MemberNameRecord = {
  id?: string | number | null;
  auth_user_id?: string | null;
  username?: string | null;
  first_name?: string | null;
  last_name?: string | null;
};

export function findDuplicateFirstNameKeys(members: MemberNameRecord[]): Set<string> {
  const counts = new Map<string, number>();

  for (const member of members) {
    const key = (member.first_name || "").trim().toLowerCase();
    if (!key) continue;
    counts.set(key, (counts.get(key) || 0) + 1);
  }

  return new Set(
    [...counts.entries()].filter(([, count]) => count > 1).map(([key]) => key)
  );
}

export function formatMemberDisplayName(
  member: MemberNameRecord,
  duplicateFirstNames?: Set<string>
): string {
  const duplicates = duplicateFirstNames ?? findDuplicateFirstNameKeys([member]);
  const first = (member.first_name || "").trim();
  const last = (member.last_name || "").trim();
  const lastInitial = last ? `${last.charAt(0).toUpperCase()}.` : "";

  if (first) {
    if (duplicates.has(first.toLowerCase()) && lastInitial) {
      return `${first} ${lastInitial}`;
    }
    return first;
  }

  const fullName = `${first} ${last}`.trim();
  if (fullName) return fullName;

  return (member.username || "").trim() || "Unknown";
}

export type MemberDisplayNameResolver = {
  displayForMemberId: (id: string | number | null | undefined) => string | null;
  displayForAuthUserId: (id: string | null | undefined) => string | null;
  displayForUsername: (username: string | null | undefined) => string | null;
  resolveStoredValue: (stored: string | null | undefined) => string;
};

export function buildMemberDisplayNameResolver(
  members: MemberNameRecord[]
): MemberDisplayNameResolver {
  const duplicateFirstNames = findDuplicateFirstNameKeys(members);
  const byId = new Map<string, string>();
  const byAuthUserId = new Map<string, string>();
  const byUsername = new Map<string, string>();
  const byFullName = new Map<string, string>();

  for (const member of members) {
    const label = formatMemberDisplayName(member, duplicateFirstNames);

    if (member.id != null) byId.set(String(member.id), label);
    if (member.auth_user_id) {
      byAuthUserId.set(String(member.auth_user_id).trim(), label);
    }
    if (member.username) {
      byUsername.set(member.username.trim().toLowerCase(), label);
    }

    const full = `${member.first_name || ""} ${member.last_name || ""}`.trim();
    if (full) byFullName.set(full.toLowerCase(), label);
  }

  function resolveStoredValue(stored: string | null | undefined): string {
    if (!stored) return "";
    const trimmed = stored.trim();
    if (!trimmed) return "";

    return (
      byId.get(trimmed) ||
      byAuthUserId.get(trimmed) ||
      byUsername.get(trimmed.toLowerCase()) ||
      byFullName.get(trimmed.toLowerCase()) ||
      trimmed
    );
  }

  return {
    displayForMemberId: (id) => (id == null ? null : byId.get(String(id)) ?? null),
    displayForAuthUserId: (id) =>
      !id ? null : byAuthUserId.get(String(id).trim()) ?? null,
    displayForUsername: (username) =>
      !username ? null : byUsername.get(username.trim().toLowerCase()) ?? null,
    resolveStoredValue,
  };
}

export async function fetchMemberDisplayNameResolver(
  supabase: SupabaseClient
): Promise<MemberDisplayNameResolver> {
  const { data, error } = await supabase
    .from("team_members")
    .select("id, auth_user_id, username, first_name, last_name");

  if (error) throw new Error(error.message);
  return buildMemberDisplayNameResolver(data || []);
}

export function memberRecordToAssociateOption(member: MemberNameRecord & { id: number | string }) {
  const resolver = buildMemberDisplayNameResolver([member]);
  return {
    id: String(member.id),
    name: resolver.displayForMemberId(member.id) || "Unknown",
  };
}

export function mapMembersToAssociateOptions(members: Array<MemberNameRecord & { id: number | string }>) {
  const resolver = buildMemberDisplayNameResolver(members);
  return members.map((member) => ({
    id: String(member.id),
    name: resolver.displayForMemberId(member.id) || "Unknown",
  }));
}
