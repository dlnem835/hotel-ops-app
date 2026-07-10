"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, ChevronRight, ChevronUp } from "lucide-react";
import ReportsInspectionFailedDetailTable from "@/app/reports/components/ReportsInspectionFailedDetailTable";
import ReportsInspectionSessionDetailModal from "@/app/reports/components/ReportsInspectionSessionDetailModal";
import type { InspectionReportModalTarget } from "@/app/reports/lib/report-definitions";
import { fetchInspectionReportSource } from "@/app/reports/lib/inspection-report-data";
import {
  buildAssociateRankingRows,
  buildAverageTimeGroups,
  buildFailedItemGroups,
  buildFailedSectionGroups,
  buildInspectorRoomShareRows,
  buildRoomsDoneRows,
  buildRoomsNotDoneRows,
  buildScoresByRoomGroups,
} from "@/app/reports/lib/inspection-report-filters";
import { getInspectionReportLabels } from "@/app/reports/lib/inspection-report-sample-data";
import type { InspectionReportFilters } from "@/app/reports/lib/inspection-report-types";
import {
  ASSOCIATE_RANKING_SORT_COLUMNS,
  INSPECTOR_SHARE_SORT_COLUMNS,
  ROOMS_DONE_SORT_COLUMNS,
  ROOMS_NOT_DONE_SORT_COLUMNS,
  sortAssociateRankingRows,
  sortFailedAreasDetailRows,
  sortFailedItemsDetailRows,
  sortInspectorShareRows,
  sortRoomsDoneRows,
  sortRoomsNotDoneRows,
  type AssociateRankingSortColumn,
  type FailedAreasDetailSortColumn,
  type FailedItemsDetailSortColumn,
  type InspectorShareSortColumn,
  type InspectionReportSortDirection,
  type RoomsDoneSortColumn,
  type RoomsNotDoneSortColumn,
} from "@/app/reports/lib/inspection-report-sort";

type ReportsInspectionResultsProps = {
  target: InspectionReportModalTarget;
  filters: InspectionReportFilters;
};

function getScrollContainer(element: HTMLElement | null): HTMLElement | null {
  let node = element?.parentElement ?? null;
  while (node) {
    const style = window.getComputedStyle(node);
    if (/(auto|scroll|overlay)/.test(style.overflowY)) {
      return node;
    }
    node = node.parentElement;
  }
  return null;
}

function formatScore(score: number | null): string {
  if (score === null) return "—";
  return `${score}%`;
}

type SortableHeaderProps<T extends string> = {
  column: { key: T; label: string };
  sortColumn: T;
  sortDirection: InspectionReportSortDirection;
  onSort: (column: T) => void;
};

function SortableHeader<T extends string>({
  column,
  sortColumn,
  sortDirection,
  onSort,
}: SortableHeaderProps<T>) {
  const isActive = sortColumn === column.key;
  return (
    <th scope="col">
      <button
        type="button"
        className="reports-all-work-orders__sort-btn"
        onClick={() => onSort(column.key)}
        aria-sort={
          isActive ? (sortDirection === "asc" ? "ascending" : "descending") : "none"
        }
      >
        <span>{column.label}</span>
        {isActive ? (
          sortDirection === "asc" ? (
            <ChevronUp size={14} className="reports-all-work-orders__sort-icon" aria-hidden />
          ) : (
            <ChevronDown size={14} className="reports-all-work-orders__sort-icon" aria-hidden />
          )
        ) : null}
      </button>
    </th>
  );
}

export default function ReportsInspectionResults({
  target,
  filters,
}: ReportsInspectionResultsProps) {
  const { reportId, variant } = target;
  const labels = getInspectionReportLabels(variant);
  const rootRef = useRef<HTMLDivElement>(null);
  const savedScrollTopRef = useRef(0);
  const scrollContainerRef = useRef<HTMLElement | null>(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [source, setSource] = useState<Awaited<ReturnType<typeof fetchInspectionReportSource>> | null>(
    null
  );

  const [selectedSessionId, setSelectedSessionId] = useState<number | null>(null);
  const [highlightItemKey, setHighlightItemKey] = useState<string | null>(null);
  const [openingSessionId, setOpeningSessionId] = useState<number | null>(null);
  const [openError, setOpenError] = useState<string | null>(null);
  const [expandedGroupKey, setExpandedGroupKey] = useState<string | null>(null);
  const [expandedRoomKey, setExpandedRoomKey] = useState<number | null>(null);
  const [expandedInspectorKey, setExpandedInspectorKey] = useState<string | null>(null);

  const [rankingSortColumn, setRankingSortColumn] =
    useState<AssociateRankingSortColumn>("completedCount");
  const [rankingSortDirection, setRankingSortDirection] =
    useState<InspectionReportSortDirection>("desc");
  const [roomsDoneSortColumn, setRoomsDoneSortColumn] =
    useState<RoomsDoneSortColumn>("completedAt");
  const [roomsDoneSortDirection, setRoomsDoneSortDirection] =
    useState<InspectionReportSortDirection>("desc");
  const [roomsNotDoneSortColumn, setRoomsNotDoneSortColumn] =
    useState<RoomsNotDoneSortColumn>("roomNumber");
  const [roomsNotDoneSortDirection, setRoomsNotDoneSortDirection] =
    useState<InspectionReportSortDirection>("asc");
  const [failedAreasDetailSortColumn, setFailedAreasDetailSortColumn] =
    useState<FailedAreasDetailSortColumn>("completedAt");
  const [failedAreasDetailSortDirection, setFailedAreasDetailSortDirection] =
    useState<InspectionReportSortDirection>("desc");
  const [failedItemsDetailSortColumn, setFailedItemsDetailSortColumn] =
    useState<FailedItemsDetailSortColumn>("completedAt");
  const [failedItemsDetailSortDirection, setFailedItemsDetailSortDirection] =
    useState<InspectionReportSortDirection>("desc");
  const [inspectorShareSortColumn, setInspectorShareSortColumn] =
    useState<InspectorShareSortColumn>("percent");
  const [inspectorShareSortDirection, setInspectorShareSortDirection] =
    useState<InspectionReportSortDirection>("desc");

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const data = await fetchInspectionReportSource(variant);
        if (!cancelled) setSource(data);
      } catch (loadError) {
        if (!cancelled) {
          setError(
            loadError instanceof Error ? loadError.message : "Unable to load inspection report data."
          );
          setSource(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [variant, filters, reportId, reloadKey]);

  useEffect(() => {
    if (selectedSessionId) return;
    const container = scrollContainerRef.current;
    if (!container) return;
    window.requestAnimationFrame(() => {
      container.scrollTop = savedScrollTopRef.current;
    });
  }, [selectedSessionId]);

  const associateRows = useMemo(
    () => (source ? buildAssociateRankingRows(source, filters) : []),
    [source, filters]
  );
  const averageTime = useMemo(
    () => (source ? buildAverageTimeGroups(source, filters) : null),
    [source, filters]
  );
  const roomsDoneRows = useMemo(
    () => (source ? buildRoomsDoneRows(source, filters) : []),
    [source, filters]
  );
  const roomsNotDoneRows = useMemo(
    () => (source ? buildRoomsNotDoneRows(source, filters) : []),
    [source, filters]
  );
  const failedSectionGroups = useMemo(
    () => (source ? buildFailedSectionGroups(source, filters) : []),
    [source, filters]
  );
  const failedItemGroups = useMemo(
    () => (source ? buildFailedItemGroups(source, filters) : []),
    [source, filters]
  );
  const inspectorShare = useMemo(
    () => (source ? buildInspectorRoomShareRows(source, filters) : { rows: [], totalCompleted: 0 }),
    [source, filters]
  );
  const scoresByRoomGroups = useMemo(
    () => (source ? buildScoresByRoomGroups(source, filters) : []),
    [source, filters]
  );

  const sortedAssociateRows = useMemo(
    () => sortAssociateRankingRows(associateRows, rankingSortColumn, rankingSortDirection),
    [associateRows, rankingSortColumn, rankingSortDirection]
  );
  const sortedRoomsDoneRows = useMemo(
    () => sortRoomsDoneRows(roomsDoneRows, roomsDoneSortColumn, roomsDoneSortDirection),
    [roomsDoneRows, roomsDoneSortColumn, roomsDoneSortDirection]
  );
  const sortedRoomsNotDoneRows = useMemo(
    () =>
      sortRoomsNotDoneRows(roomsNotDoneRows, roomsNotDoneSortColumn, roomsNotDoneSortDirection),
    [roomsNotDoneRows, roomsNotDoneSortColumn, roomsNotDoneSortDirection]
  );
  function sortFailedSectionGroupItems(groupKey: string) {
    const group = failedSectionGroups.find((entry) => entry.sectionKey === groupKey);
    if (!group) return [];
    return sortFailedAreasDetailRows(
      group.items,
      failedAreasDetailSortColumn,
      failedAreasDetailSortDirection
    );
  }

  function sortFailedItemGroupItems(groupKey: string) {
    const group = failedItemGroups.find((entry) => entry.groupKey === groupKey);
    if (!group) return [];
    return sortFailedItemsDetailRows(
      group.items,
      failedItemsDetailSortColumn,
      failedItemsDetailSortDirection
    );
  }
  const sortedInspectorShareRows = useMemo(
    () =>
      sortInspectorShareRows(
        inspectorShare.rows,
        inspectorShareSortColumn,
        inspectorShareSortDirection
      ),
    [inspectorShare.rows, inspectorShareSortColumn, inspectorShareSortDirection]
  );

  const roomsDoneColumns = useMemo(
    () =>
      ROOMS_DONE_SORT_COLUMNS.filter(
        (column) => variant === "room" || column.key !== "inspectionType"
      ),
    [variant]
  );
  const inspectorShareColumns = useMemo(
    () =>
      INSPECTOR_SHARE_SORT_COLUMNS.map((column) => {
        if (column.key === "roomCount") {
          return {
            ...column,
            label: variant === "rpm" ? "Rooms Completed" : "Rooms Inspected",
          };
        }
        if (column.key === "percent") {
          return {
            ...column,
            label:
              variant === "rpm"
                ? "% of Total Rooms Completed"
                : "% of Total Rooms Inspected",
          };
        }
        return column;
      }),
    [variant]
  );

  const openSession = useCallback(async (sessionId: number, itemHighlightKey?: string | null) => {
    if (openingSessionId) return;
    scrollContainerRef.current = getScrollContainer(rootRef.current);
    savedScrollTopRef.current = scrollContainerRef.current?.scrollTop ?? 0;
    setOpenError(null);
    setOpeningSessionId(sessionId);
    try {
      const response = await fetch(`/api/inspections/sessions/${sessionId}`);
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Unable to open inspection session.");
      setSelectedSessionId(sessionId);
      setHighlightItemKey(itemHighlightKey ?? null);
    } catch (openErr) {
      setOpenError(openErr instanceof Error ? openErr.message : "Unable to open inspection session.");
    } finally {
      setOpeningSessionId(null);
    }
  }, [openingSessionId]);

  function toggleRankingSort(column: AssociateRankingSortColumn) {
    if (rankingSortColumn === column) {
      setRankingSortDirection((current) => (current === "asc" ? "desc" : "asc"));
      return;
    }
    setRankingSortColumn(column);
    setRankingSortDirection("asc");
  }

  function toggleRoomsDoneSort(column: RoomsDoneSortColumn) {
    if (roomsDoneSortColumn === column) {
      setRoomsDoneSortDirection((current) => (current === "asc" ? "desc" : "asc"));
      return;
    }
    setRoomsDoneSortColumn(column);
    setRoomsDoneSortDirection("asc");
  }

  function toggleRoomsNotDoneSort(column: RoomsNotDoneSortColumn) {
    if (roomsNotDoneSortColumn === column) {
      setRoomsNotDoneSortDirection((current) => (current === "asc" ? "desc" : "asc"));
      return;
    }
    setRoomsNotDoneSortColumn(column);
    setRoomsNotDoneSortDirection("asc");
  }

  function toggleFailedAreasDetailSort(column: FailedAreasDetailSortColumn) {
    if (failedAreasDetailSortColumn === column) {
      setFailedAreasDetailSortDirection((current) => (current === "asc" ? "desc" : "asc"));
      return;
    }
    setFailedAreasDetailSortColumn(column);
    setFailedAreasDetailSortDirection("asc");
  }

  function toggleFailedItemsDetailSort(column: FailedItemsDetailSortColumn) {
    if (failedItemsDetailSortColumn === column) {
      setFailedItemsDetailSortDirection((current) => (current === "asc" ? "desc" : "asc"));
      return;
    }
    setFailedItemsDetailSortColumn(column);
    setFailedItemsDetailSortDirection("asc");
  }

  function toggleInspectorShareSort(column: InspectorShareSortColumn) {
    if (inspectorShareSortColumn === column) {
      setInspectorShareSortDirection((current) => (current === "asc" ? "desc" : "asc"));
      return;
    }
    setInspectorShareSortColumn(column);
    setInspectorShareSortDirection(column === "percent" ? "desc" : "asc");
  }

  if (loading) {
    return (
      <div className="reports-wo-results">
        <p className="reports-pm-results__lead">Loading inspection report data…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="reports-wo-results">
        <p className="reports-pm-results__lead">{error}</p>
        <button
          type="button"
          className="reports-pm-results__source-link"
          onClick={() => setReloadKey((value) => value + 1)}
        >
          Retry
        </button>
      </div>
    );
  }

  const modal =
    selectedSessionId !== null ? (
      <ReportsInspectionSessionDetailModal
        sessionId={selectedSessionId}
        highlightItemKey={highlightItemKey}
        onClose={() => {
          setSelectedSessionId(null);
          setHighlightItemKey(null);
        }}
      />
    ) : null;

  if (reportId === "associate-ranking") {
    return (
      <>
        <div ref={rootRef} className="reports-wo-results">
          <p className="reports-pm-results__lead">
            {variant === "rpm"
              ? "Associates ranked by completed RPMs in the selected range."
              : "Associates ranked by completed inspections in the selected range."}
          </p>
          {openError ? <p className="reports-all-work-orders__error" role="alert">{openError}</p> : null}
          <div className="reports-pm-results__table-wrap">
            <table className="reports-pm-results__table">
              <thead>
                <tr>
                  {ASSOCIATE_RANKING_SORT_COLUMNS.map((column) => (
                    <SortableHeader
                      key={column.key}
                      column={column}
                      sortColumn={rankingSortColumn}
                      sortDirection={rankingSortDirection}
                      onSort={toggleRankingSort}
                    />
                  ))}
                </tr>
              </thead>
              <tbody>
                {sortedAssociateRows.length > 0 ? (
                  sortedAssociateRows.map((row) => (
                    <tr key={row.associateId}>
                      <td>{row.rank}</td>
                      <td>{row.associateName}</td>
                      <td>{row.completedCount}</td>
                      <td>{row.completedPercent}%</td>
                      <td>{formatScore(row.averageScore)}</td>
                      <td>{row.failedItemCount}</td>
                      <td>{row.averageTimeLabel ?? "—"}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={7}>No records match the selected filters.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
        {modal}
      </>
    );
  }

  if (reportId === "average-time") {
    const groups = averageTime?.groups ?? [];
    const timeLabel = variant === "rpm" ? "RPM" : "inspection";
    return (
      <>
        <div ref={rootRef} className="reports-wo-results">
          <p className="reports-pm-results__lead">
            Average {timeLabel} time grouped by inspector from completed_at minus started_at.
          </p>
          {openError ? <p className="reports-all-work-orders__error" role="alert">{openError}</p> : null}
          {groups.length > 0 ? (
            <div className="reports-wo-top-categories__list">
              {groups.map((group) => {
                const isExpanded = expandedInspectorKey === group.inspectorId;
                return (
                  <div
                    key={group.inspectorId}
                    className={`reports-wo-top-categories__group${isExpanded ? " reports-wo-top-categories__group--expanded" : ""}`}
                  >
                    <button
                      type="button"
                      className="reports-wo-top-categories__row"
                      onClick={() =>
                        setExpandedInspectorKey(isExpanded ? null : group.inspectorId)
                      }
                      aria-expanded={isExpanded}
                    >
                      {isExpanded ? (
                        <ChevronDown size={16} className="reports-wo-top-categories__chevron" />
                      ) : (
                        <ChevronRight size={16} className="reports-wo-top-categories__chevron" />
                      )}
                      <span className="reports-wo-top-categories__label">{group.inspectorName}</span>
                      <span className="reports-wo-top-categories__count">
                        {group.completedCount} completed · Avg {group.averageTimeLabel ?? "—"}
                      </span>
                    </button>
                    {isExpanded ? (
                      <div className="reports-wo-top-categories__details">
                        <div className="reports-pm-results__table-wrap">
                          <table className="reports-pm-results__table reports-wo-top-categories__table">
                            <thead>
                              <tr>
                                <th>Room</th>
                                <th>Started</th>
                                <th>Completed</th>
                                <th>Duration</th>
                                <th>Score</th>
                              </tr>
                            </thead>
                            <tbody>
                              {group.sessions.map((session) => (
                                <tr key={session.sessionId}>
                                  <td>
                                    <button
                                      type="button"
                                      className="reports-pm-results__source-link"
                                      onClick={() => void openSession(session.sessionId)}
                                      disabled={Boolean(openingSessionId)}
                                    >
                                      {session.roomNumber}
                                    </button>
                                  </td>
                                  <td>{session.startedAt}</td>
                                  <td>{session.completedAt}</td>
                                  <td>{session.durationLabel ?? "—"}</td>
                                  <td>{formatScore(session.scorePercent)}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="reports-pm-results__lead">No records match the selected filters.</p>
          )}
          <p className="reports-pm-results__lead" style={{ marginTop: "14px" }}>
            Overall average {timeLabel} time:{" "}
            <strong>{averageTime?.overallAverageLabel ?? "—"}</strong>
          </p>
        </div>
        {modal}
      </>
    );
  }

  if (reportId === "rooms-done") {
    return (
      <>
        <div ref={rootRef} className="reports-wo-results">
          <p className="reports-pm-results__lead">{labels.roomsDoneLead}</p>
          {openError ? <p className="reports-all-work-orders__error" role="alert">{openError}</p> : null}
          <div className="reports-pm-results__table-wrap">
            <table className="reports-pm-results__table">
              <thead>
                <tr>
                  {roomsDoneColumns.map((column) => (
                    <SortableHeader
                      key={column.key}
                      column={column}
                      sortColumn={roomsDoneSortColumn}
                      sortDirection={roomsDoneSortDirection}
                      onSort={toggleRoomsDoneSort}
                    />
                  ))}
                </tr>
              </thead>
              <tbody>
                {sortedRoomsDoneRows.length > 0 ? (
                  sortedRoomsDoneRows.map((row) => (
                    <tr key={row.sessionId}>
                      <td>
                        <button
                          type="button"
                          className="reports-pm-results__source-link"
                          onClick={() => void openSession(row.sessionId)}
                          disabled={Boolean(openingSessionId)}
                        >
                          {row.roomNumber}
                        </button>
                      </td>
                      {variant === "room" ? <td>{row.inspectionType}</td> : null}
                      <td>{row.inspectorName}</td>
                      <td>{row.associateName}</td>
                      <td>{formatScore(row.scorePercent)}</td>
                      <td>{row.failedItemCount}</td>
                      <td>{row.completedAt}</td>
                      <td>{row.durationLabel ?? "—"}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={variant === "room" ? 8 : 7}>No records match the selected filters.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
        {modal}
      </>
    );
  }

  if (reportId === "rooms-not-done") {
    const lastLabel = variant === "rpm" ? "Last RPM date" : "Last inspection date";
    const daysLabel =
      variant === "rpm" ? "Days since last RPM" : "Days since last inspection";
    const notDoneColumns = ROOMS_NOT_DONE_SORT_COLUMNS.map((column) => {
      if (column.key === "lastDate") return { ...column, label: lastLabel };
      if (column.key === "daysSinceLast") return { ...column, label: daysLabel };
      return column;
    });
    return (
      <div ref={rootRef} className="reports-wo-results">
        <p className="reports-pm-results__lead">{labels.roomsNotDoneLead}</p>
        <div className="reports-pm-results__table-wrap">
          <table className="reports-pm-results__table">
            <thead>
              <tr>
                {notDoneColumns.map((column) => (
                  <SortableHeader
                    key={column.key}
                    column={column}
                    sortColumn={roomsNotDoneSortColumn}
                    sortDirection={roomsNotDoneSortDirection}
                    onSort={toggleRoomsNotDoneSort}
                  />
                ))}
              </tr>
            </thead>
            <tbody>
              {sortedRoomsNotDoneRows.length > 0 ? (
                sortedRoomsNotDoneRows.map((row) => (
                  <tr key={row.areaId}>
                    <td>{row.roomNumber}</td>
                    <td>{row.lastDate ?? "—"}</td>
                    <td>{row.lastInspectorName ?? "—"}</td>
                    <td>{row.daysSinceLast ?? "—"}</td>
                    <td>{row.statusLabel}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5}>No records match the selected filters.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  if (reportId === "top-failed-sections") {
    return (
      <>
        <div ref={rootRef} className="reports-wo-results">
          <p className="reports-pm-results__lead">Failed responses grouped by section.</p>
          {openError ? <p className="reports-all-work-orders__error" role="alert">{openError}</p> : null}
          {failedSectionGroups.length > 0 ? (
            <div className="reports-wo-top-categories__list">
              {failedSectionGroups.map((group) => {
                const isExpanded = expandedGroupKey === group.sectionKey;
                return (
                  <div
                    key={group.sectionKey}
                    className={`reports-wo-top-categories__group${isExpanded ? " reports-wo-top-categories__group--expanded" : ""}`}
                  >
                    <button
                      type="button"
                      className="reports-wo-top-categories__row"
                      onClick={() =>
                        setExpandedGroupKey(isExpanded ? null : group.sectionKey)
                      }
                      aria-expanded={isExpanded}
                    >
                      {isExpanded ? (
                        <ChevronDown size={16} className="reports-wo-top-categories__chevron" />
                      ) : (
                        <ChevronRight size={16} className="reports-wo-top-categories__chevron" />
                      )}
                      <span className="reports-wo-top-categories__label">{group.sectionLabel}</span>
                      <span className="reports-wo-top-categories__count">
                        {group.totalFailures}
                      </span>
                    </button>
                    {isExpanded ? (
                      <div className="reports-wo-top-categories__details">
                        <ReportsInspectionFailedDetailTable
                          variant="areas"
                          rows={sortFailedSectionGroupItems(group.sectionKey)}
                          sortColumn={failedAreasDetailSortColumn}
                          sortDirection={failedAreasDetailSortDirection}
                          onSort={toggleFailedAreasDetailSort}
                          openingSessionId={openingSessionId}
                          onOpenSession={(sessionId, highlightKey) =>
                            void openSession(sessionId, highlightKey)
                          }
                        />
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="reports-pm-results__lead">No records match the selected filters.</p>
          )}
        </div>
        {modal}
      </>
    );
  }

  if (reportId === "top-failed-items") {
    return (
      <>
        <div ref={rootRef} className="reports-wo-results">
          <p className="reports-pm-results__lead">
            Failed checklist items grouped by question for the selected filters.
          </p>
          {openError ? <p className="reports-all-work-orders__error" role="alert">{openError}</p> : null}
          {failedItemGroups.length > 0 ? (
            <div className="reports-wo-top-categories__list">
              {failedItemGroups.map((group) => {
                const isExpanded = expandedGroupKey === group.groupKey;
                return (
                  <div
                    key={group.groupKey}
                    className={`reports-wo-top-categories__group${isExpanded ? " reports-wo-top-categories__group--expanded" : ""}`}
                  >
                    <button
                      type="button"
                      className="reports-wo-top-categories__row"
                      onClick={() =>
                        setExpandedGroupKey(isExpanded ? null : group.groupKey)
                      }
                      aria-expanded={isExpanded}
                    >
                      {isExpanded ? (
                        <ChevronDown size={16} className="reports-wo-top-categories__chevron" />
                      ) : (
                        <ChevronRight size={16} className="reports-wo-top-categories__chevron" />
                      )}
                      <span className="reports-wo-top-categories__label">{group.displayLabel}</span>
                      <span className="reports-wo-top-categories__count">
                        {group.totalFailures}
                      </span>
                    </button>
                    {isExpanded ? (
                      <div className="reports-wo-top-categories__details">
                        <ReportsInspectionFailedDetailTable
                          variant="items"
                          rows={sortFailedItemGroupItems(group.groupKey)}
                          sortColumn={failedItemsDetailSortColumn}
                          sortDirection={failedItemsDetailSortDirection}
                          onSort={toggleFailedItemsDetailSort}
                          openingSessionId={openingSessionId}
                          onOpenSession={(sessionId, highlightKey) =>
                            void openSession(sessionId, highlightKey)
                          }
                        />
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="reports-pm-results__lead">No records match the selected filters.</p>
          )}
        </div>
        {modal}
      </>
    );
  }

  if (reportId === "rooms-by-inspector") {
    const totalLabel =
      variant === "rpm" ? "Total Rooms Completed" : "Total Rooms Inspected";
    return (
      <div ref={rootRef} className="reports-wo-results">
        <p className="reports-pm-results__lead">
          {variant === "rpm"
            ? "RPM completion coverage by inspector for the selected period."
            : "Inspection coverage by inspector for the selected period."}
        </p>
        <p className="reports-pm-results__lead">
          <strong>
            {totalLabel}: {inspectorShare.totalCompleted}
          </strong>
        </p>
        <div className="reports-pm-results__table-wrap">
          <table className="reports-pm-results__table">
            <thead>
              <tr>
                {inspectorShareColumns.map((column) => (
                  <SortableHeader
                    key={column.key}
                    column={column}
                    sortColumn={inspectorShareSortColumn}
                    sortDirection={inspectorShareSortDirection}
                    onSort={toggleInspectorShareSort}
                  />
                ))}
              </tr>
            </thead>
            <tbody>
              {sortedInspectorShareRows.length > 0 ? (
                sortedInspectorShareRows.map((row) => (
                  <tr key={row.inspectorId}>
                    <td>{row.inspectorName}</td>
                    <td>{row.roomCount}</td>
                    <td>{row.percent}%</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={3}>No records match the selected filters.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  return (
    <>
      <div ref={rootRef} className="reports-wo-results">
        <p className="reports-pm-results__lead">Scores grouped by room for the selected period.</p>
        {openError ? <p className="reports-all-work-orders__error" role="alert">{openError}</p> : null}
        {scoresByRoomGroups.length > 0 ? (
          <div className="reports-wo-top-categories__list">
            {scoresByRoomGroups.map((group) => {
              const isExpanded = expandedRoomKey === group.areaId;
              return (
                <div
                  key={group.areaId}
                  className={`reports-wo-top-categories__group${isExpanded ? " reports-wo-top-categories__group--expanded" : ""}`}
                >
                  <button
                    type="button"
                    className="reports-wo-top-categories__row"
                    onClick={() => setExpandedRoomKey(isExpanded ? null : group.areaId)}
                    aria-expanded={isExpanded}
                  >
                    {isExpanded ? (
                      <ChevronDown size={16} className="reports-wo-top-categories__chevron" />
                    ) : (
                      <ChevronRight size={16} className="reports-wo-top-categories__chevron" />
                    )}
                    <span className="reports-wo-top-categories__label">{group.roomNumber}</span>
                    <span className="reports-wo-top-categories__count">
                      {group.inspectionCount} inspections · Latest {formatScore(group.latestScore)} ·
                      Avg {formatScore(group.averageScore)} · Failed {group.failedItemTotal}
                    </span>
                  </button>
                  {isExpanded ? (
                    <div className="reports-wo-top-categories__details">
                      <p className="reports-pm-results__lead">
                        Last inspection: {group.lastInspectionDate ?? "—"}
                      </p>
                      <div className="reports-pm-results__table-wrap">
                        <table className="reports-pm-results__table reports-wo-top-categories__table">
                          <thead>
                            <tr>
                              <th>Type</th>
                              <th>Inspector</th>
                              <th>Score</th>
                              <th>Failed items</th>
                              <th>Completed</th>
                              <th>Duration</th>
                              <th>Session</th>
                            </tr>
                          </thead>
                          <tbody>
                            {group.sessions.map((session) => (
                              <tr key={session.sessionId}>
                                <td>{session.inspectionType}</td>
                                <td>{session.inspectorName}</td>
                                <td>{formatScore(session.scorePercent)}</td>
                                <td>{session.failedItemCount}</td>
                                <td>{session.completedAt}</td>
                                <td>{session.durationLabel ?? "—"}</td>
                                <td>
                                  <button
                                    type="button"
                                    className="reports-pm-results__source-link"
                                    onClick={() => void openSession(session.sessionId)}
                                    disabled={Boolean(openingSessionId)}
                                  >
                                    Open
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        ) : (
          <p className="reports-pm-results__lead">No records match the selected filters.</p>
        )}
      </div>
      {modal}
    </>
  );
}
