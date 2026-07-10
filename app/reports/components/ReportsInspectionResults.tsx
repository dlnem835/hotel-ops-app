"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, ChevronRight, ChevronUp } from "lucide-react";
import ReportsInspectionSessionDetailModal from "@/app/reports/components/ReportsInspectionSessionDetailModal";
import type { InspectionReportModalTarget } from "@/app/reports/lib/report-definitions";
import { fetchInspectionReportSource } from "@/app/reports/lib/inspection-report-data";
import {
  buildAssociateRankingRows,
  buildAverageTimeGroups,
  buildFailedItemRows,
  buildFailedSectionGroups,
  buildRoomsDoneRows,
  buildRoomsNotDoneRows,
  buildScoresByRoomGroups,
} from "@/app/reports/lib/inspection-report-filters";
import { getInspectionReportLabels } from "@/app/reports/lib/inspection-report-sample-data";
import type { InspectionReportFilters } from "@/app/reports/lib/inspection-report-types";
import {
  ASSOCIATE_RANKING_SORT_COLUMNS,
  FAILED_ITEMS_SORT_COLUMNS,
  ROOMS_DONE_SORT_COLUMNS,
  ROOMS_NOT_DONE_SORT_COLUMNS,
  sortAssociateRankingRows,
  sortFailedItemRows,
  sortRoomsDoneRows,
  sortRoomsNotDoneRows,
  type AssociateRankingSortColumn,
  type FailedItemsSortColumn,
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
  const [expandedPersonKey, setExpandedPersonKey] = useState<string | null>(null);

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
  const [failedItemsSortColumn, setFailedItemsSortColumn] =
    useState<FailedItemsSortColumn>("completedAt");
  const [failedItemsSortDirection, setFailedItemsSortDirection] =
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
  const failedItemRows = useMemo(
    () => (source ? buildFailedItemRows(source, filters) : []),
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
  const sortedFailedItemRows = useMemo(
    () => sortFailedItemRows(failedItemRows, failedItemsSortColumn, failedItemsSortDirection),
    [failedItemRows, failedItemsSortColumn, failedItemsSortDirection]
  );

  const personColumnLabel = variant === "rpm" ? "Associate" : "Inspector";
  const roomsDoneColumns = useMemo(
    () =>
      ROOMS_DONE_SORT_COLUMNS.map((column) =>
        column.key === "personName" ? { ...column, label: personColumnLabel } : column
      ),
    [personColumnLabel]
  );
  const failedItemsColumns = useMemo(
    () =>
      FAILED_ITEMS_SORT_COLUMNS.map((column) =>
        column.key === "personName" ? { ...column, label: personColumnLabel } : column
      ),
    [personColumnLabel]
  );

  const openSession = useCallback(async (sessionId: number, itemKey?: string | null) => {
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
      setHighlightItemKey(itemKey ?? null);
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

  function toggleFailedItemsSort(column: FailedItemsSortColumn) {
    if (failedItemsSortColumn === column) {
      setFailedItemsSortDirection((current) => (current === "asc" ? "desc" : "asc"));
      return;
    }
    setFailedItemsSortColumn(column);
    setFailedItemsSortDirection("asc");
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
            Average {timeLabel} time from completed_at minus started_at.
          </p>
          {openError ? <p className="reports-all-work-orders__error" role="alert">{openError}</p> : null}
          {groups.length > 0 ? (
            <div className="reports-wo-top-categories__list">
              {groups.map((group) => {
                const isExpanded = expandedPersonKey === group.personId;
                return (
                  <div
                    key={group.personId}
                    className={`reports-wo-top-categories__group${isExpanded ? " reports-wo-top-categories__group--expanded" : ""}`}
                  >
                    <button
                      type="button"
                      className="reports-wo-top-categories__row"
                      onClick={() =>
                        setExpandedPersonKey(isExpanded ? null : group.personId)
                      }
                      aria-expanded={isExpanded}
                    >
                      {isExpanded ? (
                        <ChevronDown size={16} className="reports-wo-top-categories__chevron" />
                      ) : (
                        <ChevronRight size={16} className="reports-wo-top-categories__chevron" />
                      )}
                      <span className="reports-wo-top-categories__label">{group.personName}</span>
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
                                <th>Type</th>
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
                                  <td>{session.inspectionType}</td>
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
                      <td>{row.inspectionType}</td>
                      <td>{row.personName}</td>
                      <td>{formatScore(row.scorePercent)}</td>
                      <td>{row.failedItemCount}</td>
                      <td>{row.completedAt}</td>
                      <td>{row.durationLabel ?? "—"}</td>
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

  if (reportId === "rooms-not-done") {
    const lastLabel = variant === "rpm" ? "Last RPM" : "Last inspection";
    const lastPersonLabel = variant === "rpm" ? "Last associate" : "Last inspector";
    const notDoneColumns = ROOMS_NOT_DONE_SORT_COLUMNS.map((column) => {
      if (column.key === "lastDate") return { ...column, label: lastLabel };
      if (column.key === "lastPersonName") return { ...column, label: lastPersonLabel };
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
                    <td>{row.lastType ?? "—"}</td>
                    <td>{row.lastPersonName ?? "—"}</td>
                    <td>{row.daysSinceLast ?? "—"}</td>
                    <td>{row.statusLabel}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6}>No records match the selected filters.</td>
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
          <p className="reports-pm-results__lead">Failed items grouped by section/area.</p>
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
                        <div className="reports-pm-results__table-wrap">
                          <table className="reports-pm-results__table reports-wo-top-categories__table">
                            <thead>
                              <tr>
                                <th>Room</th>
                                <th>Failed item</th>
                                <th>{personColumnLabel}</th>
                                <th>Score</th>
                                <th>Completed</th>
                              </tr>
                            </thead>
                            <tbody>
                              {group.items.map((item) => (
                                <tr key={`${item.sessionId}-${item.failedItemLabel}`}>
                                  <td>
                                    <button
                                      type="button"
                                      className="reports-pm-results__source-link"
                                      onClick={() => void openSession(item.sessionId)}
                                      disabled={Boolean(openingSessionId)}
                                    >
                                      {item.roomNumber}
                                    </button>
                                  </td>
                                  <td>{item.failedItemLabel}</td>
                                  <td>{item.personName}</td>
                                  <td>{formatScore(item.scorePercent)}</td>
                                  <td>{item.completedAt}</td>
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

  if (reportId === "top-failed-items") {
    return (
      <>
        <div ref={rootRef} className="reports-wo-results">
          <p className="reports-pm-results__lead">Failed checklist items from completed sessions.</p>
          {openError ? <p className="reports-all-work-orders__error" role="alert">{openError}</p> : null}
          <div className="reports-pm-results__table-wrap">
            <table className="reports-pm-results__table">
              <thead>
                <tr>
                  {failedItemsColumns.map((column) => (
                    <SortableHeader
                      key={column.key}
                      column={column}
                      sortColumn={failedItemsSortColumn}
                      sortDirection={failedItemsSortDirection}
                      onSort={toggleFailedItemsSort}
                    />
                  ))}
                </tr>
              </thead>
              <tbody>
                {sortedFailedItemRows.length > 0 ? (
                  sortedFailedItemRows.map((row) => (
                    <tr key={row.id}>
                      <td>{row.itemLabel}</td>
                      <td>{row.sectionLabel}</td>
                      <td>
                        <button
                          type="button"
                          className="reports-pm-results__source-link"
                          onClick={() => void openSession(row.sessionId, row.id.split("::")[1] ?? null)}
                          disabled={Boolean(openingSessionId)}
                        >
                          {row.roomNumber}
                        </button>
                      </td>
                      <td>{row.personName}</td>
                      <td>{formatScore(row.scorePercent)}</td>
                      <td>{row.completedAt}</td>
                      <td>{row.notes}</td>
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
                              <th>{personColumnLabel}</th>
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
                                <td>{session.personName}</td>
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
