import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { normalizeLostItemStatus } from "@/app/lib/lost-found-shipping/status";
import type {
  LostFoundFilterOptions,
  LostFoundFoundByRow,
  LostFoundReportItem,
} from "@/app/reports/lib/lost-found-report-types";

export type LostItemRow = {
  id: number | string;
  item_name: string | null;
  room_number: string | null;
  guest_last_name: string | null;
  found_by: string | null;
  status: string | null;
  created_by: string | null;
  comments: string | null;
  created_at: string | null;
  label_url: string | null;
  label_requested_at: string | null;
  label_sent_at: string | null;
};

export type TeamMemberRow = {
  auth_user_id: string;
  first_name: string | null;
  last_name: string | null;
  username: string | null;
  department: string | null;
};

const AGING_RETENTION_MONTHS = 6;

export const LOST_FOUND_AGING_ELIGIBLE_STATUSES = [
  "Stored",
  "Awaiting Guest Action",
  "Ready to Ship",
] as const;

export type LostFoundAgingEligibleStatus = (typeof LOST_FOUND_AGING_ELIGIBLE_STATUSES)[number];

export function createReportsSupabaseClient(): SupabaseClient {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

export function getLostFoundAgingCutoffDate(now = new Date()): Date {
  const cutoff = new Date(now);
  cutoff.setMonth(cutoff.getMonth() - AGING_RETENTION_MONTHS);
  return cutoff;
}

export function isLostFoundItemAging(
  item: Pick<LostFoundReportItem, "status" | "createdAtSource">,
  cutoff = getLostFoundAgingCutoffDate()
): boolean {
  const normalized =
    normalizeLostItemStatus(item.status) || String(item.status || "");
  if (
    !LOST_FOUND_AGING_ELIGIBLE_STATUSES.includes(
      normalized as LostFoundAgingEligibleStatus
    )
  ) {
    return false;
  }
  if (!item.createdAtSource) return false;
  const createdAt = new Date(item.createdAtSource);
  if (Number.isNaN(createdAt.getTime())) return false;
  return createdAt <= cutoff;
}

function formatDisplayDateTime(iso: string | null | undefined): string {
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

function formatDisplayDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function toDateOnly(iso: string | null | undefined): string {
  if (!iso) return "";
  return iso.slice(0, 10);
}

function computeDaysStored(createdAt: string | null | undefined, now = new Date()): number | null {
  if (!createdAt) return null;
  const created = new Date(createdAt);
  if (Number.isNaN(created.getTime())) return null;
  const diffMs = now.getTime() - created.getTime();
  return Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));
}

export function resolveTeamMemberName(member: TeamMemberRow): string {
  return (
    member.username?.trim() ||
    `${member.first_name || ""} ${member.last_name || ""}`.trim() ||
    "Unknown"
  );
}

function resolveCreatedByName(
  createdById: string | null | undefined,
  teamMembers: TeamMemberRow[]
): string {
  if (!createdById) return "—";
  const member = teamMembers.find(
    (person) => String(person.auth_user_id).trim() === String(createdById).trim()
  );
  return member ? resolveTeamMemberName(member) : "—";
}

function resolveDepartmentForFoundBy(
  foundBy: string,
  teamMembers: TeamMemberRow[]
): string {
  const normalized = foundBy.trim().toLowerCase();
  if (!normalized) return "—";

  const member = teamMembers.find((person) => {
    const displayName = resolveTeamMemberName(person).toLowerCase();
    return displayName === normalized;
  });

  // Future: join lost_items.found_by to team_members via associate_id when available.
  return member?.department?.trim() || "—";
}

function mapLostItemRowToReportItem(
  row: LostItemRow,
  teamMembers: TeamMemberRow[]
): LostFoundReportItem {
  const createdAt = row.created_at ?? "";
  const status = row.status?.trim() || "Stored";

  // Future: use dedicated shipped_at when the column is added to lost_items.
  const shippedAt =
    status === "Shipped"
      ? formatDisplayDateTime(row.label_sent_at ?? row.created_at)
      : null;

  return {
    id: String(row.id),
    guestLastName: row.guest_last_name?.trim() || "—",
    roomNumber: row.room_number?.trim() || "—",
    itemName: row.item_name?.trim() || "—",
    status,
    foundBy: row.found_by?.trim() || "—",
    createdBy: resolveCreatedByName(row.created_by, teamMembers),
    comments: row.comments?.trim() || "",
    createdAt: formatDisplayDateTime(createdAt),
    createdAtIso: toDateOnly(createdAt),
    createdAtSource: createdAt,
    labelUrl: row.label_url ?? null,
    labelSentAt: row.label_sent_at ? formatDisplayDateTime(row.label_sent_at) : null,
    shippedAt,
    daysStored: computeDaysStored(createdAt),
  };
}

export async function fetchLostFoundReportSource(
  supabase: SupabaseClient = createReportsSupabaseClient()
): Promise<{ items: LostFoundReportItem[]; teamMembers: TeamMemberRow[] }> {
  const [itemsResult, teamResult] = await Promise.all([
    supabase.from("lost_items").select("*").order("created_at", { ascending: false }),
    supabase
      .from("team_members")
      .select("auth_user_id, first_name, last_name, username, department"),
  ]);

  if (itemsResult.error) {
    throw new Error(itemsResult.error.message);
  }

  if (teamResult.error) {
    throw new Error(teamResult.error.message);
  }

  const teamMembers = (teamResult.data ?? []) as TeamMemberRow[];
  const items = ((itemsResult.data ?? []) as LostItemRow[]).map((row) =>
    mapLostItemRowToReportItem(row, teamMembers)
  );

  // Property filter is UI-only until lost_items gains property_id.
  return { items, teamMembers };
}

export function buildLostFoundFilterOptions(
  items: LostFoundReportItem[]
): LostFoundFilterOptions {
  const foundBy = new Set<string>(["All"]);
  const createdBy = new Set<string>(["All"]);

  for (const item of items) {
    if (item.foundBy && item.foundBy !== "—") {
      foundBy.add(item.foundBy);
    }
    if (item.createdBy && item.createdBy !== "—") {
      createdBy.add(item.createdBy);
    }
  }

  return {
    foundBy: [...foundBy].sort((a, b) => {
      if (a === "All") return -1;
      if (b === "All") return 1;
      return a.localeCompare(b);
    }),
    createdBy: [...createdBy].sort((a, b) => {
      if (a === "All") return -1;
      if (b === "All") return 1;
      return a.localeCompare(b);
    }),
  };
}

export function buildLostFoundFoundByRows(
  items: LostFoundReportItem[],
  teamMembers: TeamMemberRow[]
): LostFoundFoundByRow[] {
  const grouped = new Map<
    string,
    {
      items: LostFoundReportItem[];
      lastItem: LostFoundReportItem;
    }
  >();

  for (const item of items) {
    if (!item.foundBy || item.foundBy === "—") continue;

    const existing = grouped.get(item.foundBy);
    if (!existing) {
      grouped.set(item.foundBy, { items: [item], lastItem: item });
      continue;
    }

    existing.items.push(item);
    if (item.createdAtIso > existing.lastItem.createdAtIso) {
      existing.lastItem = item;
    }
  }

  return [...grouped.entries()]
    .map(([associateName, group]) => ({
      associateName,
      department: resolveDepartmentForFoundBy(associateName, teamMembers),
      itemsFound: group.items.length,
      lastItemFoundDate: formatDisplayDate(group.lastItem.createdAtIso),
      lastItemFoundDateIso: group.lastItem.createdAtIso,
      mostRecentItem: group.lastItem.itemName,
      lastFoundLocation:
        group.lastItem.roomNumber === "—"
          ? "—"
          : group.lastItem.roomNumber.toLowerCase().startsWith("room")
            ? group.lastItem.roomNumber
            : `Room ${group.lastItem.roomNumber}`,
    }))
    .sort((a, b) => b.lastItemFoundDateIso.localeCompare(a.lastItemFoundDateIso));
}
