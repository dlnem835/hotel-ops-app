import {
  filterSourceSessions,
  getInspectionTypeLabel,
} from "@/app/reports/lib/inspection-report-data";
import {
  averageDurationMs,
  calculateDaysSince,
  formatAverageDurationLabel,
  formatInspectionReportDate,
  formatInspectionReportDateTime,
  getActiveGuestRooms,
  sessionMatchesVariantProgram,
} from "@/app/reports/lib/inspection-report-filter-utils";
import type { InspectionReportVariant } from "@/app/reports/lib/inspection-report-sample-data";
import type {
  InspectionAssociateRankingRow,
  InspectionAverageTimeGroupRow,
  InspectionAverageTimeSessionRow,
  InspectionFailedItemRow,
  InspectionFailedSectionDetailRow,
  InspectionFailedSectionGroupRow,
  InspectionReportFilters,
  InspectionReportSource,
  InspectionReportSourceSession,
  InspectionRoomsDoneRow,
  InspectionRoomsNotDoneRow,
  InspectionScoresByRoomGroupRow,
  InspectionScoresByRoomSessionRow,
} from "@/app/reports/lib/inspection-report-types";

function getPersonName(session: InspectionReportSourceSession, variant: InspectionReportVariant) {
  return variant === "rpm" ? session.associateName : session.inspectorName;
}

function getFilteredSessions(source: InspectionReportSource, filters: InspectionReportFilters) {
  return filterSourceSessions(source, filters);
}

function getFilteredFailedItems(source: InspectionReportSource, filters: InspectionReportFilters) {
  const sessionIds = new Set(getFilteredSessions(source, filters).map((session) => session.id));
  return source.failedItems.filter((item) => {
    if (!sessionIds.has(item.sessionId)) return false;
    if (filters.associate !== "All" && item.associateName !== filters.associate) return false;
    if (filters.inspector !== "All" && item.inspectorName !== filters.inspector) return false;
    return true;
  });
}

export function buildAssociateRankingRows(
  source: InspectionReportSource,
  filters: InspectionReportFilters
): InspectionAssociateRankingRow[] {
  const sessions = getFilteredSessions(source, filters);
  const totalCompleted = sessions.length;
  const byAssociate = new Map<
    string,
    {
      name: string;
      sessions: InspectionReportSourceSession[];
    }
  >();

  for (const session of sessions) {
    const associateId = session.associateId || session.inspectorId || `unknown-${session.id}`;
    const associateName =
      session.associateName !== "—" ? session.associateName : session.inspectorName;
    const existing = byAssociate.get(associateId) || { name: associateName, sessions: [] };
    existing.sessions.push(session);
    byAssociate.set(associateId, existing);
  }

  const rows = [...byAssociate.values()]
    .map((entry) => {
      const scores = entry.sessions
        .map((session) => session.scorePercent)
        .filter((score): score is number => score !== null);
      const averageScore =
        scores.length > 0
          ? Math.round((scores.reduce((sum, score) => sum + score, 0) / scores.length) * 10) / 10
          : null;
      const failedItemCount = entry.sessions.reduce(
        (sum, session) => sum + session.failedItemCount,
        0
      );
      const averageTimeMs = averageDurationMs(
        entry.sessions.map((session) => session.durationMs)
      );

      return {
        associateId: entry.sessions[0]?.associateId || entry.sessions[0]?.inspectorId || entry.name,
        associateName: entry.name,
        completedCount: entry.sessions.length,
        completedPercent:
          totalCompleted === 0
            ? 0
            : Math.round((entry.sessions.length / totalCompleted) * 1000) / 10,
        averageScore,
        failedItemCount,
        averageTimeLabel: formatAverageDurationLabel(averageTimeMs),
        averageTimeMs,
      };
    })
    .sort((left, right) => {
      if (right.completedCount !== left.completedCount) {
        return right.completedCount - left.completedCount;
      }
      return left.associateName.localeCompare(right.associateName);
    });

  return rows.map((row, index) => ({
    ...row,
    rank: index + 1,
  }));
}

export function buildAverageTimeGroups(
  source: InspectionReportSource,
  filters: InspectionReportFilters
): { groups: InspectionAverageTimeGroupRow[]; overallAverageLabel: string | null } {
  const sessions = getFilteredSessions(source, filters);
  const byPerson = new Map<string, { name: string; sessions: InspectionReportSourceSession[] }>();

  for (const session of sessions) {
    const personId =
      source.variant === "rpm"
        ? session.associateId || session.inspectorId || `unknown-${session.id}`
        : session.inspectorId || session.associateId || `unknown-${session.id}`;
    const personName = getPersonName(session, source.variant);
    const existing = byPerson.get(personId) || { name: personName, sessions: [] };
    existing.sessions.push(session);
    byPerson.set(personId, existing);
  }

  const groups = [...byPerson.entries()]
    .map(([personId, entry]) => {
      const averageTimeMs = averageDurationMs(
        entry.sessions.map((session) => session.durationMs)
      );
      const detailSessions: InspectionAverageTimeSessionRow[] = [...entry.sessions]
        .sort((left, right) => right.completedAt.localeCompare(left.completedAt))
        .map((session) => ({
          sessionId: session.id,
          roomNumber: session.areaName,
          inspectionType: getInspectionTypeLabel(session),
          startedAt: formatInspectionReportDateTime(session.startedAt),
          startedAtSortIso: session.startedAt,
          completedAt: formatInspectionReportDateTime(session.completedAt),
          completedAtSortIso: session.completedAt,
          durationLabel: session.durationLabel,
          durationMs: session.durationMs,
          scorePercent: session.scorePercent,
        }));

      return {
        personId,
        personName: entry.name,
        completedCount: entry.sessions.length,
        averageTimeLabel: formatAverageDurationLabel(averageTimeMs),
        averageTimeMs,
        sessions: detailSessions,
      };
    })
    .sort((left, right) => left.personName.localeCompare(right.personName));

  const overallAverageMs = averageDurationMs(
    sessions.map((session) => session.durationMs)
  );

  return {
    groups,
    overallAverageLabel: formatAverageDurationLabel(overallAverageMs),
  };
}

export function buildRoomsDoneRows(
  source: InspectionReportSource,
  filters: InspectionReportFilters
): InspectionRoomsDoneRow[] {
  return getFilteredSessions(source, filters)
    .map((session) => ({
      sessionId: session.id,
      roomNumber: session.areaName,
      inspectionType: getInspectionTypeLabel(session),
      personName: getPersonName(session, source.variant),
      scorePercent: session.scorePercent,
      failedItemCount: session.failedItemCount,
      completedAt: formatInspectionReportDateTime(session.completedAt),
      completedAtSortIso: session.completedAt,
      durationLabel: session.durationLabel,
      durationMs: session.durationMs,
    }))
    .sort((left, right) => right.completedAtSortIso.localeCompare(left.completedAtSortIso));
}

export function buildRoomsNotDoneRows(
  source: InspectionReportSource,
  filters: InspectionReportFilters
): InspectionRoomsNotDoneRow[] {
  const activeRooms = getActiveGuestRooms(source.guestRooms);
  const completedInRange = new Set(
    getFilteredSessions(source, filters).map((session) => session.areaId)
  );

  const latestByArea = new Map<number, InspectionReportSourceSession>();
  for (const session of source.sessions) {
    if (!sessionMatchesVariantProgram(session.inspectionProgram, source.variant, filters.type)) {
      continue;
    }
    const existing = latestByArea.get(session.areaId);
    if (!existing || session.completedAt > existing.completedAt) {
      latestByArea.set(session.areaId, session);
    }
  }

  const neverLabel = source.variant === "rpm" ? "Never Completed" : "Never Inspected";
  const notInRangeLabel =
    source.variant === "rpm"
      ? "Not Completed in Selected Range"
      : "Not Inspected in Selected Range";

  return activeRooms
    .filter((room) => !completedInRange.has(room.id))
    .map((room) => {
      const latest = latestByArea.get(room.id);
      return {
        areaId: room.id,
        roomNumber: room.name,
        lastDate: latest ? formatInspectionReportDate(latest.completedAt) : null,
        lastDateSortIso: latest?.completedAt ?? null,
        lastType: latest ? getInspectionTypeLabel(latest) : null,
        lastPersonName: latest ? getPersonName(latest, source.variant) : null,
        daysSinceLast: latest ? calculateDaysSince(latest.completedAt) : null,
        statusLabel: latest ? notInRangeLabel : neverLabel,
      };
    })
    .sort((left, right) => left.roomNumber.localeCompare(right.roomNumber, undefined, { numeric: true }));
}

export function buildFailedSectionGroups(
  source: InspectionReportSource,
  filters: InspectionReportFilters
): InspectionFailedSectionGroupRow[] {
  const failedItems = getFilteredFailedItems(source, filters);
  const grouped = new Map<string, InspectionFailedSectionGroupRow>();

  for (const item of failedItems) {
    const existing = grouped.get(item.categoryKey) || {
      sectionKey: item.categoryKey,
      sectionLabel: item.categoryLabel,
      totalFailures: 0,
      items: [],
    };

    const detail: InspectionFailedSectionDetailRow = {
      sessionId: item.sessionId,
      roomNumber: item.areaName,
      failedItemLabel: item.itemLabel,
      personName:
        source.variant === "rpm" ? item.associateName : item.inspectorName,
      scorePercent: item.scorePercent,
      completedAt: formatInspectionReportDateTime(item.completedAt),
      completedAtSortIso: item.completedAt,
    };

    existing.totalFailures += 1;
    existing.items.push(detail);
    grouped.set(item.categoryKey, existing);
  }

  return [...grouped.values()]
    .map((group) => ({
      ...group,
      items: group.items.sort((left, right) =>
        right.completedAtSortIso.localeCompare(left.completedAtSortIso)
      ),
    }))
    .sort((left, right) => {
      if (right.totalFailures !== left.totalFailures) {
        return right.totalFailures - left.totalFailures;
      }
      return left.sectionLabel.localeCompare(right.sectionLabel);
    });
}

export function buildFailedItemRows(
  source: InspectionReportSource,
  filters: InspectionReportFilters
): InspectionFailedItemRow[] {
  return getFilteredFailedItems(source, filters)
    .map((item) => ({
      id: `${item.sessionId}::${item.itemKey}`,
      sessionId: item.sessionId,
      itemLabel: item.itemLabel,
      sectionLabel: item.categoryLabel,
      roomNumber: item.areaName,
      personName: source.variant === "rpm" ? item.associateName : item.inspectorName,
      scorePercent: item.scorePercent,
      completedAt: formatInspectionReportDateTime(item.completedAt),
      completedAtSortIso: item.completedAt,
      notes: item.itemNotes?.trim() || "—",
    }))
    .sort((left, right) => right.completedAtSortIso.localeCompare(left.completedAtSortIso));
}

export function buildScoresByRoomGroups(
  source: InspectionReportSource,
  filters: InspectionReportFilters
): InspectionScoresByRoomGroupRow[] {
  const sessions = getFilteredSessions(source, filters);
  const grouped = new Map<number, InspectionReportSourceSession[]>();

  for (const session of sessions) {
    const existing = grouped.get(session.areaId) ?? [];
    existing.push(session);
    grouped.set(session.areaId, existing);
  }

  return [...grouped.entries()]
    .map(([areaId, roomSessions]) => {
      const sorted = [...roomSessions].sort((left, right) =>
        right.completedAt.localeCompare(left.completedAt)
      );
      const scores = sorted
        .map((session) => session.scorePercent)
        .filter((score): score is number => score !== null);
      const latest = sorted[0];
      const detailSessions: InspectionScoresByRoomSessionRow[] = sorted.map((session) => ({
        sessionId: session.id,
        inspectionType: getInspectionTypeLabel(session),
        personName: getPersonName(session, source.variant),
        scorePercent: session.scorePercent,
        failedItemCount: session.failedItemCount,
        completedAt: formatInspectionReportDateTime(session.completedAt),
        completedAtSortIso: session.completedAt,
        durationLabel: session.durationLabel,
        durationMs: session.durationMs,
      }));

      return {
        areaId,
        roomNumber: latest.areaName,
        inspectionCount: sorted.length,
        latestScore: latest.scorePercent,
        averageScore:
          scores.length > 0
            ? Math.round((scores.reduce((sum, score) => sum + score, 0) / scores.length) * 10) / 10
            : null,
        lowestScore: scores.length > 0 ? Math.min(...scores) : null,
        failedItemTotal: sorted.reduce((sum, session) => sum + session.failedItemCount, 0),
        lastInspectionDate: formatInspectionReportDate(latest.completedAt),
        lastInspectionDateSortIso: latest.completedAt,
        sessions: detailSessions,
      };
    })
    .sort((left, right) =>
      left.roomNumber.localeCompare(right.roomNumber, undefined, { numeric: true })
    );
}
