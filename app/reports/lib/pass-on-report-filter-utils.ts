import { isPassOnReadByUser } from "@/app/pass-on-log/lib/pass-on-views";
import { buildMemberDisplayNameResolver } from "@/app/lib/member-display-name";
import { resolveEntryDate } from "@/app/mobile/pass-on-log/lib/pass-on-shared";
import type {
  PassOnReportSourceEntry,
  PassOnReportTeamMember,
  PassOnShiftName,
  PassOnStandardReportFilters,
  PassOnUnreadReportFiltersExtended,
} from "@/app/reports/lib/pass-on-report-types";

const PREVIEW_MAX_LENGTH = 120;
const SNIPPET_RADIUS = 48;

export const PASS_ON_SHIFT_SORT_ORDER: Record<PassOnShiftName, number> = {
  "AM Shift": 1,
  "PM Shift": 2,
  "Night Audit": 3,
  Other: 4,
};

export function formatPassOnReportDateTime(iso: string | null | undefined): string {
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

export function toPassOnEntryDate(iso: string | null | undefined): string {
  if (!iso) return "";
  return iso.slice(0, 10);
}

export function matchesPassOnDateRange(
  entry: Pick<PassOnReportSourceEntry, "entryDate" | "createdAt">,
  filters: Pick<PassOnStandardReportFilters, "dateStart" | "dateEnd">
): boolean {
  if (!filters.dateStart && !filters.dateEnd) return true;
  const dateOnly = entry.entryDate || toPassOnEntryDate(entry.createdAt);
  if (!dateOnly) return false;
  if (filters.dateStart && dateOnly < filters.dateStart) return false;
  if (filters.dateEnd && dateOnly > filters.dateEnd) return false;
  return true;
}

export function derivePassOnShift(createdAtIso: string | null | undefined): PassOnShiftName {
  if (!createdAtIso) return "Other";
  const date = new Date(createdAtIso);
  if (Number.isNaN(date.getTime())) return "Other";
  const hour = date.getHours();
  if (hour >= 6 && hour < 14) return "AM Shift";
  if (hour >= 14 && hour < 22) return "PM Shift";
  return "Night Audit";
}

export function matchesPassOnShiftFilter(
  shift: PassOnShiftName,
  filterShift: PassOnStandardReportFilters["shift"]
): boolean {
  if (filterShift === "All") return true;
  return shift === filterShift;
}

export function matchesPassOnPriorityFilter(
  priority: string,
  filterPriority: PassOnStandardReportFilters["priority"]
): boolean {
  if (filterPriority === "All") return true;
  return (priority || "Normal").trim() === filterPriority;
}

export function matchesPassOnCreatedByFilter(
  authorDisplay: string,
  filterCreatedBy: string
): boolean {
  if (filterCreatedBy === "All") return true;
  return authorDisplay === filterCreatedBy;
}

export function buildEntryPreview(message: string): string {
  const normalized = message.replace(/\s+/g, " ").trim();
  if (!normalized) return "—";
  if (normalized.length <= PREVIEW_MAX_LENGTH) return normalized;
  return `${normalized.slice(0, PREVIEW_MAX_LENGTH).trimEnd()}…`;
}

export function countEntryReads(
  entry: Pick<PassOnReportSourceEntry, "views" | "replies">,
  teamMembers: PassOnReportTeamMember[]
): { readCount: number; unreadCount: number } {
  const eligibleMembers = teamMembers.filter((member) => member.authUserId);
  let readCount = 0;
  for (const member of eligibleMembers) {
    if (
      isPassOnReadByUser(
        {
          pass_on_log_views: entry.views,
          pass_on_log_replies: entry.replies,
        },
        member.authUserId
      )
    ) {
      readCount += 1;
    }
  }
  return {
    readCount,
    unreadCount: Math.max(eligibleMembers.length - readCount, 0),
  };
}

export function resolveAuthorAuthUserId(
  members: PassOnReportTeamMember[],
  storedAuthor: string
): string | null {
  const resolver = buildMemberDisplayNameResolver(
    members.map((member) => ({
      auth_user_id: member.authUserId,
      username: member.username,
      first_name: member.firstName,
      last_name: member.lastName,
    }))
  );
  const match = members.find(
    (member) =>
      member.username === storedAuthor ||
      resolver.displayForAuthUserId(member.authUserId) === storedAuthor ||
      resolver.resolveStoredValue(storedAuthor) ===
        resolver.displayForAuthUserId(member.authUserId)
  );
  return match?.authUserId ?? null;
}

export function resolveAuthorDisplay(
  members: PassOnReportTeamMember[],
  storedAuthor: string | null | undefined
): string {
  if (!storedAuthor) return "Unknown";
  const resolver = buildMemberDisplayNameResolver(
    members.map((member) => ({
      auth_user_id: member.authUserId,
      username: member.username,
      first_name: member.firstName,
      last_name: member.lastName,
    }))
  );
  return resolver.resolveStoredValue(storedAuthor) || storedAuthor;
}

export function matchesStandardPassOnEntryFilters(
  entry: PassOnReportSourceEntry,
  filters: PassOnStandardReportFilters
): boolean {
  if (!matchesPassOnDateRange(entry, filters)) return false;
  if (!matchesPassOnCreatedByFilter(entry.authorDisplay, filters.associate)) return false;
  if (!matchesPassOnShiftFilter(entry.shift, filters.shift)) return false;
  if (!matchesPassOnPriorityFilter(entry.priority, filters.priority)) return false;
  return true;
}

export function buildKeywordSnippet(
  subject: string,
  message: string,
  keyword: string
): { before: string; match: string; after: string } | null {
  const query = keyword.trim();
  if (!query) return null;

  const haystack = `${subject}\n${message}`;
  const lowerHaystack = haystack.toLowerCase();
  const lowerQuery = query.toLowerCase();
  const index = lowerHaystack.indexOf(lowerQuery);
  if (index < 0) return null;

  const match = haystack.slice(index, index + query.length);
  const start = Math.max(0, index - SNIPPET_RADIUS);
  const end = Math.min(haystack.length, index + query.length + SNIPPET_RADIUS);
  const before = `${start > 0 ? "…" : ""}${haystack.slice(start, index).replace(/\s+/g, " ").trimStart()}`;
  const after = `${haystack.slice(index + query.length, end).replace(/\s+/g, " ").trimEnd()}${end < haystack.length ? "…" : ""}`;

  return { before, match, after };
}

export function entryMatchesKeyword(
  entry: Pick<PassOnReportSourceEntry, "subject" | "message">,
  keyword: string
): boolean {
  const query = keyword.trim().toLowerCase();
  if (!query) return false;
  return `${entry.subject} ${entry.message}`.toLowerCase().includes(query);
}

export function formatUnreadEntryAge(createdAtIso: string, now = new Date()): string {
  const createdAt = new Date(createdAtIso);
  if (Number.isNaN(createdAt.getTime())) return "—";
  const diffMs = Math.max(now.getTime() - createdAt.getTime(), 0);
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 60) return `${Math.max(minutes, 1)} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 48) return `${hours} hr${hours === 1 ? "" : "s"}`;
  const days = Math.floor(hours / 24);
  return `${days} day${days === 1 ? "" : "s"}`;
}

export function unreadEntryAgeMs(createdAtIso: string, now = new Date()): number {
  const createdAt = new Date(createdAtIso);
  if (Number.isNaN(createdAt.getTime())) return 0;
  return Math.max(now.getTime() - createdAt.getTime(), 0);
}

export function matchesUnreadUserFilters(
  row: { userAuthUserId: string; userName: string; department: string },
  filters: PassOnUnreadReportFiltersExtended
): boolean {
  if (filters.department !== "All" && row.department !== filters.department) return false;
  if (filters.user !== "All" && row.userName !== filters.user) return false;
  return true;
}

export function resolveEntryDateFromSource(entry: PassOnReportSourceEntry): string {
  return entry.entryDate || resolveEntryDate({ entry_date: entry.entryDate, created_at: entry.createdAt });
}

export function normalizePriority(priority: string | null | undefined): string {
  const value = (priority || "Normal").trim();
  if (value === "Important" || value === "Urgent") return value;
  return "Normal";
}

export function isEditedEntry(entry: Pick<PassOnReportSourceEntry, "editedAt" | "isEdited">): boolean {
  return Boolean(entry.isEdited && entry.editedAt);
}
