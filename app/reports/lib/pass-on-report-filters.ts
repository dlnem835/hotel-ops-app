import { isPassOnReadByUser } from "@/app/pass-on-log/lib/pass-on-views";
import {
  buildKeywordSnippet,
  entryMatchesKeyword,
  formatPassOnReportDateTime,
  formatUnreadEntryAge,
  isEditedEntry,
  matchesPassOnDateRange,
  matchesPassOnShiftFilter,
  matchesStandardPassOnEntryFilters,
  matchesUnreadUserFilters,
  normalizePriority,
  PASS_ON_SHIFT_SORT_ORDER,
  unreadEntryAgeMs,
} from "@/app/reports/lib/pass-on-report-filter-utils";
import type {
  PassOnAssociateGroupRow,
  PassOnEditedEntryRow,
  PassOnKeywordSearchRow,
  PassOnReportDetailRow,
  PassOnReportSource,
  PassOnShiftGroupRow,
  PassOnStandardReportFilters,
  PassOnUnreadByUserRow,
  PassOnUnreadReportFiltersExtended,
} from "@/app/reports/lib/pass-on-report-types";

function toDetailRow(entry: PassOnReportSource["entries"][number]): PassOnReportDetailRow {
  return {
    entryId: entry.id,
    subject: entry.subject,
    shift: entry.shift,
    priority: entry.priority,
    createdAt: entry.createdAt,
    createdAtDisplay: formatPassOnReportDateTime(entry.createdAt),
    editedAt: entry.editedAt,
    editedAtDisplay: entry.editedAt ? formatPassOnReportDateTime(entry.editedAt) : "—",
    preview: entry.preview,
    readCount: entry.readCount,
    unreadCount: entry.unreadCount,
  };
}

function filterStandardEntries(
  source: PassOnReportSource,
  filters: PassOnStandardReportFilters
) {
  return source.entries.filter((entry) => matchesStandardPassOnEntryFilters(entry, filters));
}

export function buildEntriesByAssociateGroups(
  source: PassOnReportSource,
  filters: PassOnStandardReportFilters
): PassOnAssociateGroupRow[] {
  const filtered = filterStandardEntries(source, filters);
  const grouped = new Map<string, PassOnAssociateGroupRow>();

  for (const entry of filtered) {
    const key = entry.authorStored || entry.authorDisplay;
    const existing = grouped.get(key);
    const priority = normalizePriority(entry.priority);
    const detail = toDetailRow(entry);

    if (!existing) {
      grouped.set(key, {
        associateKey: key,
        associateName: entry.authorDisplay,
        totalPublished: 1,
        normalCount: priority === "Normal" ? 1 : 0,
        importantCount: priority === "Important" ? 1 : 0,
        urgentCount: priority === "Urgent" ? 1 : 0,
        editedCount: isEditedEntry(entry) ? 1 : 0,
        mostRecentAt: entry.createdAt,
        mostRecentAtDisplay: formatPassOnReportDateTime(entry.createdAt),
        entries: [detail],
      });
      continue;
    }

    existing.totalPublished += 1;
    if (priority === "Normal") existing.normalCount += 1;
    if (priority === "Important") existing.importantCount += 1;
    if (priority === "Urgent") existing.urgentCount += 1;
    if (isEditedEntry(entry)) existing.editedCount += 1;
    if (entry.createdAt > existing.mostRecentAt) {
      existing.mostRecentAt = entry.createdAt;
      existing.mostRecentAtDisplay = formatPassOnReportDateTime(entry.createdAt);
    }
    existing.entries.push(detail);
  }

  return [...grouped.values()].sort((left, right) => right.totalPublished - left.totalPublished);
}

export function buildEntriesByShiftGroups(
  source: PassOnReportSource,
  filters: PassOnStandardReportFilters
): PassOnShiftGroupRow[] {
  const filtered = filterStandardEntries(source, filters);
  const grouped = new Map<string, PassOnShiftGroupRow>();

  for (const entry of filtered) {
    const key = entry.shift;
    const existing = grouped.get(key);
    const priority = normalizePriority(entry.priority);
    const detail = {
      ...toDetailRow(entry),
      createdBy: entry.authorDisplay,
    };

    if (!existing) {
      grouped.set(key, {
        shiftKey: entry.shift,
        shiftName: entry.shift,
        totalPublished: 1,
        normalCount: priority === "Normal" ? 1 : 0,
        importantCount: priority === "Important" ? 1 : 0,
        urgentCount: priority === "Urgent" ? 1 : 0,
        editedCount: isEditedEntry(entry) ? 1 : 0,
        mostRecentAt: entry.createdAt,
        mostRecentAtDisplay: formatPassOnReportDateTime(entry.createdAt),
        entries: [detail],
      });
      continue;
    }

    existing.totalPublished += 1;
    if (priority === "Normal") existing.normalCount += 1;
    if (priority === "Important") existing.importantCount += 1;
    if (priority === "Urgent") existing.urgentCount += 1;
    if (isEditedEntry(entry)) existing.editedCount += 1;
    if (entry.createdAt > existing.mostRecentAt) {
      existing.mostRecentAt = entry.createdAt;
      existing.mostRecentAtDisplay = formatPassOnReportDateTime(entry.createdAt);
    }
    existing.entries.push(detail);
  }

  return [...grouped.values()].sort(
    (left, right) => PASS_ON_SHIFT_SORT_ORDER[left.shiftKey] - PASS_ON_SHIFT_SORT_ORDER[right.shiftKey]
  );
}

export function buildEditedEntryRows(
  source: PassOnReportSource,
  filters: PassOnStandardReportFilters
): PassOnEditedEntryRow[] {
  return filterStandardEntries(source, filters)
    .filter((entry) => isEditedEntry(entry))
    .map((entry) => ({
      entryId: entry.id,
      subject: entry.subject,
      shift: entry.shift,
      priority: entry.priority,
      createdBy: entry.authorDisplay,
      createdAt: entry.createdAt,
      createdAtDisplay: formatPassOnReportDateTime(entry.createdAt),
      editedAt: entry.editedAt || entry.createdAt,
      editedAtDisplay: formatPassOnReportDateTime(entry.editedAt),
      editedBy: null,
      preview: entry.preview,
    }));
}

export function buildKeywordSearchRows(
  source: PassOnReportSource,
  filters: PassOnStandardReportFilters
): PassOnKeywordSearchRow[] {
  const keyword = filters.keyword.trim();
  if (!keyword) return [];

  return filterStandardEntries(source, filters)
    .filter((entry) => entryMatchesKeyword(entry, keyword))
    .map((entry) => {
      const snippet = buildKeywordSnippet(entry.subject, entry.message, keyword);
      return {
        entryId: entry.id,
        subject: entry.subject,
        snippet: snippet || { before: "", match: keyword, after: "" },
        shift: entry.shift,
        priority: entry.priority,
        createdBy: entry.authorDisplay,
        createdAt: entry.createdAt,
        createdAtDisplay: formatPassOnReportDateTime(entry.createdAt),
        editedAt: entry.editedAt,
        editedAtDisplay: entry.editedAt ? formatPassOnReportDateTime(entry.editedAt) : "—",
      };
    });
}

export function buildUnreadByUserRows(
  source: PassOnReportSource,
  filters: PassOnUnreadReportFiltersExtended
): PassOnUnreadByUserRow[] {
  const entriesInRange = source.entries.filter((entry) =>
    matchesPassOnDateRange(entry, filters)
  );

  const rows = source.teamMembers
    .map((member) => {
      const availableEntries = entriesInRange.filter((entry) => {
        if (!matchesPassOnShiftFilter(entry.shift, filters.shift)) return false;
        return true;
      });

      let entriesRead = 0;
      let lastEntryReadAt: string | null = null;
      const unreadEntries = [];

      for (const entry of availableEntries) {
        const isRead = isPassOnReadByUser(
          {
            pass_on_log_views: entry.views,
            pass_on_log_replies: entry.replies,
          },
          member.authUserId
        );

        if (isRead) {
          entriesRead += 1;
          const view = entry.views.find(
            (row) => String(row.auth_user_id).trim() === String(member.authUserId).trim()
          );
          if (view?.viewed_at) {
            if (!lastEntryReadAt || view.viewed_at > lastEntryReadAt) {
              lastEntryReadAt = view.viewed_at;
            }
          }
        } else {
          unreadEntries.push({
            entryId: entry.id,
            subject: entry.subject,
            shift: entry.shift,
            priority: entry.priority,
            createdBy: entry.authorDisplay,
            createdAt: entry.createdAt,
            createdAtDisplay: formatPassOnReportDateTime(entry.createdAt),
            ageLabel: formatUnreadEntryAge(entry.createdAt),
            ageMs: unreadEntryAgeMs(entry.createdAt),
          });
        }
      }

      const totalAvailable = availableEntries.length;
      const entriesUnread = totalAvailable - entriesRead;
      const readPercent =
        totalAvailable > 0 ? Math.round((entriesRead / totalAvailable) * 100) : 0;

      return {
        userAuthUserId: member.authUserId,
        userName: member.displayName,
        department: member.department?.trim() || "—",
        totalAvailable,
        entriesRead,
        entriesUnread,
        readPercent,
        lastEntryReadAt,
        lastEntryReadAtDisplay: lastEntryReadAt
          ? formatPassOnReportDateTime(lastEntryReadAt)
          : "—",
        unreadEntries: unreadEntries.sort((left, right) => right.ageMs - left.ageMs),
      };
    })
    .filter((row) => matchesUnreadUserFilters(row, filters))
    .sort((left, right) => {
      if (right.entriesUnread !== left.entriesUnread) {
        return right.entriesUnread - left.entriesUnread;
      }
      return left.readPercent - right.readPercent;
    });

  return rows;
}
