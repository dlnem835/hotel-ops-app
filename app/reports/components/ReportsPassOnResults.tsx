"use client";

import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, ChevronRight, ChevronUp } from "lucide-react";
import ReportsPassOnEntryDetailModal from "@/app/reports/components/ReportsPassOnEntryDetailModal";
import { fetchPassOnReportSource } from "@/app/reports/lib/pass-on-report-data";
import {
  buildEditedEntryRows,
  buildEntriesByAssociateGroups,
  buildEntriesByShiftGroups,
  buildKeywordSearchRows,
  buildUnreadByUserRows,
} from "@/app/reports/lib/pass-on-report-filters";
import type { PassOnReportId, PassOnReportFilters, PassOnUnreadReportFilters } from "@/app/reports/lib/report-definitions";
import {
  ASSOCIATE_DETAIL_SORT_COLUMNS,
  ASSOCIATE_GROUP_SORT_COLUMNS,
  EDITED_ENTRY_SORT_COLUMNS,
  KEYWORD_SEARCH_SORT_COLUMNS,
  SHIFT_DETAIL_SORT_COLUMNS,
  SHIFT_GROUP_SORT_COLUMNS,
  sortAssociateDetailRows,
  sortAssociateGroups,
  sortEditedEntryRows,
  sortKeywordSearchRows,
  sortShiftDetailRows,
  sortShiftGroups,
  sortUnreadDetailRows,
  sortUnreadUserRows,
  UNREAD_DETAIL_SORT_COLUMNS,
  UNREAD_USER_SORT_COLUMNS,
  type AssociateDetailSortColumn,
  type AssociateGroupSortColumn,
  type EditedEntrySortColumn,
  type KeywordSearchSortColumn,
  type PassOnReportSortDirection,
  type ShiftDetailSortColumn,
  type ShiftGroupSortColumn,
  type UnreadDetailSortColumn,
  type UnreadUserSortColumn,
} from "@/app/reports/lib/pass-on-report-sort";

type ReportsPassOnResultsProps = {
  reportId: PassOnReportId;
  filters: PassOnReportFilters;
  unreadFilters?: PassOnUnreadReportFilters;
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

type SortableHeaderProps<T extends string> = {
  column: { key: T; label: string };
  sortColumn: T;
  sortDirection: PassOnReportSortDirection;
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

function SubjectLink({
  subject,
  entryId,
  openingEntryId,
  onOpen,
}: {
  subject: string;
  entryId: number;
  openingEntryId: number | null;
  onOpen: (entryId: number) => void;
}) {
  return (
    <button
      type="button"
      className="reports-pm-results__source-link"
      disabled={openingEntryId === entryId}
      onClick={() => onOpen(entryId)}
    >
      {subject}
    </button>
  );
}

export default function ReportsPassOnResults({
  reportId,
  filters,
  unreadFilters,
}: ReportsPassOnResultsProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const savedScrollTopRef = useRef(0);
  const scrollContainerRef = useRef<HTMLElement | null>(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [source, setSource] = useState<Awaited<ReturnType<typeof fetchPassOnReportSource>> | null>(
    null
  );

  const [selectedEntryId, setSelectedEntryId] = useState<number | null>(null);
  const [openingEntryId, setOpeningEntryId] = useState<number | null>(null);
  const [openError, setOpenError] = useState<string | null>(null);
  const [expandedGroupKeys, setExpandedGroupKeys] = useState<Set<string>>(new Set());

  const [associateGroupSortColumn, setAssociateGroupSortColumn] =
    useState<AssociateGroupSortColumn>("totalPublished");
  const [associateGroupSortDirection, setAssociateGroupSortDirection] =
    useState<PassOnReportSortDirection>("desc");
  const [associateDetailSortColumn, setAssociateDetailSortColumn] =
    useState<AssociateDetailSortColumn>("createdAt");
  const [associateDetailSortDirection, setAssociateDetailSortDirection] =
    useState<PassOnReportSortDirection>("desc");

  const [shiftGroupSortColumn, setShiftGroupSortColumn] =
    useState<ShiftGroupSortColumn>("shiftName");
  const [shiftGroupSortDirection, setShiftGroupSortDirection] =
    useState<PassOnReportSortDirection>("asc");
  const [shiftDetailSortColumn, setShiftDetailSortColumn] =
    useState<ShiftDetailSortColumn>("createdAt");
  const [shiftDetailSortDirection, setShiftDetailSortDirection] =
    useState<PassOnReportSortDirection>("desc");

  const [editedSortColumn, setEditedSortColumn] = useState<EditedEntrySortColumn>("editedAt");
  const [editedSortDirection, setEditedSortDirection] =
    useState<PassOnReportSortDirection>("desc");

  const [keywordSortColumn, setKeywordSortColumn] = useState<KeywordSearchSortColumn>("createdAt");
  const [keywordSortDirection, setKeywordSortDirection] =
    useState<PassOnReportSortDirection>("desc");

  const [unreadUserSortColumn, setUnreadUserSortColumn] =
    useState<UnreadUserSortColumn>("entriesUnread");
  const [unreadUserSortDirection, setUnreadUserSortDirection] =
    useState<PassOnReportSortDirection>("desc");
  const [unreadDetailSortColumn, setUnreadDetailSortColumn] =
    useState<UnreadDetailSortColumn>("ageMs");
  const [unreadDetailSortDirection, setUnreadDetailSortDirection] =
    useState<PassOnReportSortDirection>("desc");

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const data = await fetchPassOnReportSource();
        if (!cancelled) setSource(data);
      } catch (loadError) {
        if (!cancelled) {
          setError(
            loadError instanceof Error ? loadError.message : "Unable to load Pass-On report data."
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
  }, [reportId, filters, unreadFilters]);

  useEffect(() => {
    if (selectedEntryId) return;
    const container = scrollContainerRef.current;
    if (!container) return;
    window.requestAnimationFrame(() => {
      container.scrollTop = savedScrollTopRef.current;
    });
  }, [selectedEntryId]);

  const associateGroups = useMemo(
    () => (source ? buildEntriesByAssociateGroups(source, filters) : []),
    [source, filters]
  );
  const shiftGroups = useMemo(
    () => (source ? buildEntriesByShiftGroups(source, filters) : []),
    [source, filters]
  );
  const editedRows = useMemo(
    () => (source ? buildEditedEntryRows(source, filters) : []),
    [source, filters]
  );
  const keywordRows = useMemo(
    () => (source ? buildKeywordSearchRows(source, filters) : []),
    [source, filters]
  );
  const unreadRows = useMemo(
    () =>
      source && unreadFilters ? buildUnreadByUserRows(source, unreadFilters) : [],
    [source, unreadFilters]
  );

  const sortedAssociateGroups = useMemo(
    () => sortAssociateGroups(associateGroups, associateGroupSortColumn, associateGroupSortDirection),
    [associateGroups, associateGroupSortColumn, associateGroupSortDirection]
  );
  const sortedShiftGroups = useMemo(
    () => sortShiftGroups(shiftGroups, shiftGroupSortColumn, shiftGroupSortDirection),
    [shiftGroups, shiftGroupSortColumn, shiftGroupSortDirection]
  );
  const sortedEditedRows = useMemo(
    () => sortEditedEntryRows(editedRows, editedSortColumn, editedSortDirection),
    [editedRows, editedSortColumn, editedSortDirection]
  );
  const sortedKeywordRows = useMemo(
    () => sortKeywordSearchRows(keywordRows, keywordSortColumn, keywordSortDirection),
    [keywordRows, keywordSortColumn, keywordSortDirection]
  );
  const sortedUnreadRows = useMemo(
    () => sortUnreadUserRows(unreadRows, unreadUserSortColumn, unreadUserSortDirection),
    [unreadRows, unreadUserSortColumn, unreadUserSortDirection]
  );

  const openEntry = useCallback((entryId: number) => {
    scrollContainerRef.current = getScrollContainer(rootRef.current);
    savedScrollTopRef.current = scrollContainerRef.current?.scrollTop ?? 0;
    setOpenError(null);
    setOpeningEntryId(entryId);
    setSelectedEntryId(entryId);
    setOpeningEntryId(null);
  }, []);

  function toggleExpandedGroup(key: string) {
    setExpandedGroupKeys((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function toggleAssociateGroupSort(column: AssociateGroupSortColumn) {
    if (associateGroupSortColumn === column) {
      setAssociateGroupSortDirection((current) => (current === "asc" ? "desc" : "asc"));
      return;
    }
    setAssociateGroupSortColumn(column);
    setAssociateGroupSortDirection(column === "associateName" ? "asc" : "desc");
  }

  function toggleAssociateDetailSort(column: AssociateDetailSortColumn) {
    if (associateDetailSortColumn === column) {
      setAssociateDetailSortDirection((current) => (current === "asc" ? "desc" : "asc"));
      return;
    }
    setAssociateDetailSortColumn(column);
    setAssociateDetailSortDirection("asc");
  }

  function toggleShiftGroupSort(column: ShiftGroupSortColumn) {
    if (shiftGroupSortColumn === column) {
      setShiftGroupSortDirection((current) => (current === "asc" ? "desc" : "asc"));
      return;
    }
    setShiftGroupSortColumn(column);
    setShiftGroupSortDirection(column === "shiftName" ? "asc" : "desc");
  }

  function toggleShiftDetailSort(column: ShiftDetailSortColumn) {
    if (shiftDetailSortColumn === column) {
      setShiftDetailSortDirection((current) => (current === "asc" ? "desc" : "asc"));
      return;
    }
    setShiftDetailSortColumn(column);
    setShiftDetailSortDirection("asc");
  }

  function toggleEditedSort(column: EditedEntrySortColumn) {
    if (editedSortColumn === column) {
      setEditedSortDirection((current) => (current === "asc" ? "desc" : "asc"));
      return;
    }
    setEditedSortColumn(column);
    setEditedSortDirection("asc");
  }

  function toggleKeywordSort(column: KeywordSearchSortColumn) {
    if (keywordSortColumn === column) {
      setKeywordSortDirection((current) => (current === "asc" ? "desc" : "asc"));
      return;
    }
    setKeywordSortColumn(column);
    setKeywordSortDirection("asc");
  }

  function toggleUnreadUserSort(column: UnreadUserSortColumn) {
    if (unreadUserSortColumn === column) {
      setUnreadUserSortDirection((current) => (current === "asc" ? "desc" : "asc"));
      return;
    }
    setUnreadUserSortColumn(column);
    setUnreadUserSortDirection(column === "userName" ? "asc" : "desc");
  }

  function toggleUnreadDetailSort(column: UnreadDetailSortColumn) {
    if (unreadDetailSortColumn === column) {
      setUnreadDetailSortDirection((current) => (current === "asc" ? "desc" : "asc"));
      return;
    }
    setUnreadDetailSortColumn(column);
    setUnreadDetailSortDirection("desc");
  }

  const modal =
    selectedEntryId != null ? (
      <ReportsPassOnEntryDetailModal
        entryId={selectedEntryId}
        onClose={() => setSelectedEntryId(null)}
      />
    ) : null;

  if (loading) {
    return <p className="reports-pm-results__lead">Loading Pass-On report data…</p>;
  }

  if (error) {
    return (
      <p className="reports-all-work-orders__error" role="alert">
        {error}
      </p>
    );
  }

  if (reportId === "keyword-search" && !filters.keyword.trim()) {
    return (
      <p className="reports-pm-results__lead">
        Enter a keyword or phrase to search Pass-On entries.
      </p>
    );
  }

  if (reportId === "entries-by-associate") {
    return (
      <>
        <div ref={rootRef} className="reports-wo-results">
          {openError ? (
            <p className="reports-all-work-orders__error" role="alert">
              {openError}
            </p>
          ) : null}
          {sortedAssociateGroups.length > 0 ? (
            <div className="reports-pm-results__table-wrap">
              <table className="reports-pm-results__table">
                <thead>
                  <tr>
                    <th scope="col" aria-label="Expand" />
                    {ASSOCIATE_GROUP_SORT_COLUMNS.map((column) => (
                      <SortableHeader
                        key={column.key}
                        column={column}
                        sortColumn={associateGroupSortColumn}
                        sortDirection={associateGroupSortDirection}
                        onSort={toggleAssociateGroupSort}
                      />
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {sortedAssociateGroups.map((group) => {
                    const isExpanded = expandedGroupKeys.has(group.associateKey);
                    const detailRows = sortAssociateDetailRows(
                      group.entries,
                      associateDetailSortColumn,
                      associateDetailSortDirection
                    );
                    return (
                      <Fragment key={group.associateKey}>
                        <tr>
                          <td>
                            <button
                              type="button"
                              className="reports-pm-results__source-link"
                              onClick={() => toggleExpandedGroup(group.associateKey)}
                              aria-expanded={isExpanded}
                              aria-label={`${isExpanded ? "Collapse" : "Expand"} entries for ${group.associateName}`}
                            >
                              {isExpanded ? "−" : "+"}
                            </button>
                          </td>
                          <td>{group.associateName}</td>
                          <td>{group.totalPublished}</td>
                          <td>{group.normalCount}</td>
                          <td>{group.importantCount}</td>
                          <td>{group.urgentCount}</td>
                          <td>{group.editedCount}</td>
                          <td>{group.mostRecentAtDisplay}</td>
                        </tr>
                        {isExpanded ? (
                          <tr key={`${group.associateKey}-details`}>
                            <td colSpan={ASSOCIATE_GROUP_SORT_COLUMNS.length + 1}>
                              <table className="reports-pm-results__table" style={{ marginTop: "8px" }}>
                                <thead>
                                  <tr>
                                    {ASSOCIATE_DETAIL_SORT_COLUMNS.map((column) => (
                                      <SortableHeader
                                        key={column.key}
                                        column={column}
                                        sortColumn={associateDetailSortColumn}
                                        sortDirection={associateDetailSortDirection}
                                        onSort={toggleAssociateDetailSort}
                                      />
                                    ))}
                                    <th scope="col">Preview</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {detailRows.map((row) => (
                                    <tr key={row.entryId}>
                                      <td>
                                        <SubjectLink
                                          subject={row.subject}
                                          entryId={row.entryId}
                                          openingEntryId={openingEntryId}
                                          onOpen={openEntry}
                                        />
                                      </td>
                                      <td>{row.shift}</td>
                                      <td>{row.priority}</td>
                                      <td>{row.createdAtDisplay}</td>
                                      <td>{row.editedAtDisplay}</td>
                                      <td>{row.readCount}</td>
                                      <td>{row.unreadCount}</td>
                                      <td>{row.preview}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </td>
                          </tr>
                        ) : null}
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="reports-pm-results__lead">No records match the selected filters.</p>
          )}
        </div>
        {modal}
      </>
    );
  }

  if (reportId === "entries-by-shift") {
    return (
      <>
        <div ref={rootRef} className="reports-wo-results">
          {openError ? (
            <p className="reports-all-work-orders__error" role="alert">
              {openError}
            </p>
          ) : null}
          {sortedShiftGroups.length > 0 ? (
            <div className="reports-wo-top-categories__list">
              {sortedShiftGroups.map((group) => {
                const isExpanded = expandedGroupKeys.has(group.shiftKey);
                const detailRows = sortShiftDetailRows(
                  group.entries,
                  shiftDetailSortColumn,
                  shiftDetailSortDirection
                );
                return (
                  <div
                    key={group.shiftKey}
                    className={`reports-wo-top-categories__group${isExpanded ? " reports-wo-top-categories__group--expanded" : ""}`}
                  >
                    <button
                      type="button"
                      className="reports-wo-top-categories__row"
                      onClick={() => toggleExpandedGroup(group.shiftKey)}
                      aria-expanded={isExpanded}
                    >
                      {isExpanded ? (
                        <ChevronDown size={16} className="reports-wo-top-categories__chevron" />
                      ) : (
                        <ChevronRight size={16} className="reports-wo-top-categories__chevron" />
                      )}
                      <span className="reports-wo-top-categories__label">{group.shiftName}</span>
                      <span className="reports-wo-top-categories__count">
                        {group.totalPublished} total · {group.normalCount} normal ·{" "}
                        {group.importantCount} important · {group.urgentCount} urgent ·{" "}
                        {group.editedCount} edited · {group.mostRecentAtDisplay}
                      </span>
                    </button>
                    {isExpanded ? (
                      <div className="reports-wo-top-categories__details">
                        <table className="reports-pm-results__table">
                          <thead>
                            <tr>
                              {SHIFT_DETAIL_SORT_COLUMNS.map((column) => (
                                <SortableHeader
                                  key={column.key}
                                  column={column}
                                  sortColumn={shiftDetailSortColumn}
                                  sortDirection={shiftDetailSortDirection}
                                  onSort={toggleShiftDetailSort}
                                />
                              ))}
                              <th scope="col">Preview</th>
                            </tr>
                          </thead>
                          <tbody>
                            {detailRows.map((row) => (
                              <tr key={row.entryId}>
                                <td>
                                  <SubjectLink
                                    subject={row.subject}
                                    entryId={row.entryId}
                                    openingEntryId={openingEntryId}
                                    onOpen={openEntry}
                                  />
                                </td>
                                <td>{row.createdBy}</td>
                                <td>{row.priority}</td>
                                <td>{row.createdAtDisplay}</td>
                                <td>{row.editedAtDisplay}</td>
                                <td>{row.readCount}</td>
                                <td>{row.unreadCount}</td>
                                <td>{row.preview}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
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

  if (reportId === "edited-entries") {
    return (
      <>
        <div ref={rootRef} className="reports-wo-results">
          {openError ? (
            <p className="reports-all-work-orders__error" role="alert">
              {openError}
            </p>
          ) : null}
          <div className="reports-pm-results__table-wrap">
            <table className="reports-pm-results__table">
              <thead>
                <tr>
                  {EDITED_ENTRY_SORT_COLUMNS.map((column) => (
                    <SortableHeader
                      key={column.key}
                      column={column}
                      sortColumn={editedSortColumn}
                      sortDirection={editedSortDirection}
                      onSort={toggleEditedSort}
                    />
                  ))}
                </tr>
              </thead>
              <tbody>
                {sortedEditedRows.length > 0 ? (
                  sortedEditedRows.map((row) => (
                    <tr key={row.entryId}>
                      <td>
                        <SubjectLink
                          subject={row.subject}
                          entryId={row.entryId}
                          openingEntryId={openingEntryId}
                          onOpen={openEntry}
                        />
                      </td>
                      <td>{row.shift}</td>
                      <td>{row.priority}</td>
                      <td>{row.createdBy}</td>
                      <td>{row.createdAtDisplay}</td>
                      <td>{row.editedAtDisplay}</td>
                      <td>{row.preview}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={EDITED_ENTRY_SORT_COLUMNS.length}>
                      No edited entries match the selected filters.
                    </td>
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

  if (reportId === "keyword-search") {
    return (
      <>
        <div ref={rootRef} className="reports-wo-results">
          {openError ? (
            <p className="reports-all-work-orders__error" role="alert">
              {openError}
            </p>
          ) : null}
          <div className="reports-pm-results__table-wrap">
            <table className="reports-pm-results__table">
              <thead>
                <tr>
                  {KEYWORD_SEARCH_SORT_COLUMNS.map((column) => (
                    <SortableHeader
                      key={column.key}
                      column={column}
                      sortColumn={keywordSortColumn}
                      sortDirection={keywordSortDirection}
                      onSort={toggleKeywordSort}
                    />
                  ))}
                  <th scope="col">Matching Text</th>
                </tr>
              </thead>
              <tbody>
                {sortedKeywordRows.length > 0 ? (
                  sortedKeywordRows.map((row) => (
                    <tr key={row.entryId}>
                      <td>
                        <SubjectLink
                          subject={row.subject}
                          entryId={row.entryId}
                          openingEntryId={openingEntryId}
                          onOpen={openEntry}
                        />
                      </td>
                      <td>{row.shift}</td>
                      <td>{row.priority}</td>
                      <td>{row.createdBy}</td>
                      <td>{row.createdAtDisplay}</td>
                      <td>{row.editedAtDisplay}</td>
                      <td>
                        {row.snippet.before}
                        <mark>{row.snippet.match}</mark>
                        {row.snippet.after}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={KEYWORD_SEARCH_SORT_COLUMNS.length + 1}>
                      No Pass-On entries match the keyword and selected filters.
                    </td>
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

  if (reportId === "unread-entries-by-user") {
    return (
      <>
        <div ref={rootRef} className="reports-wo-results">
          {openError ? (
            <p className="reports-all-work-orders__error" role="alert">
              {openError}
            </p>
          ) : null}
          {sortedUnreadRows.length > 0 ? (
            <div className="reports-pm-results__table-wrap">
              <table className="reports-pm-results__table">
                <thead>
                  <tr>
                    <th scope="col" aria-label="Expand" />
                    {UNREAD_USER_SORT_COLUMNS.map((column) => (
                      <SortableHeader
                        key={column.key}
                        column={column}
                        sortColumn={unreadUserSortColumn}
                        sortDirection={unreadUserSortDirection}
                        onSort={toggleUnreadUserSort}
                      />
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {sortedUnreadRows.map((row) => {
                    const isExpanded = expandedGroupKeys.has(row.userAuthUserId);
                    const detailRows = sortUnreadDetailRows(
                      row.unreadEntries,
                      unreadDetailSortColumn,
                      unreadDetailSortDirection
                    );
                    return (
                      <Fragment key={row.userAuthUserId}>
                        <tr>
                          <td>
                            <button
                              type="button"
                              className="reports-pm-results__source-link"
                              onClick={() => toggleExpandedGroup(row.userAuthUserId)}
                              aria-expanded={isExpanded}
                              aria-label={`${isExpanded ? "Collapse" : "Expand"} unread entries for ${row.userName}`}
                            >
                              {isExpanded ? "−" : "+"}
                            </button>
                          </td>
                          <td>{row.userName}</td>
                          <td>{row.department}</td>
                          <td>{row.totalAvailable}</td>
                          <td>{row.entriesRead}</td>
                          <td>{row.entriesUnread}</td>
                          <td>{row.readPercent}%</td>
                          <td>{row.lastEntryReadAtDisplay}</td>
                        </tr>
                        {isExpanded ? (
                          <tr key={`${row.userAuthUserId}-details`}>
                            <td colSpan={UNREAD_USER_SORT_COLUMNS.length + 1}>
                              <table className="reports-pm-results__table" style={{ marginTop: "8px" }}>
                                <thead>
                                  <tr>
                                    {UNREAD_DETAIL_SORT_COLUMNS.map((column) => (
                                      <SortableHeader
                                        key={column.key}
                                        column={column}
                                        sortColumn={unreadDetailSortColumn}
                                        sortDirection={unreadDetailSortDirection}
                                        onSort={toggleUnreadDetailSort}
                                      />
                                    ))}
                                  </tr>
                                </thead>
                                <tbody>
                                  {detailRows.length > 0 ? (
                                    detailRows.map((entry) => (
                                      <tr key={entry.entryId}>
                                        <td>
                                          <SubjectLink
                                            subject={entry.subject}
                                            entryId={entry.entryId}
                                            openingEntryId={openingEntryId}
                                            onOpen={openEntry}
                                          />
                                        </td>
                                        <td>{entry.shift}</td>
                                        <td>{entry.priority}</td>
                                        <td>{entry.createdBy}</td>
                                        <td>{entry.createdAtDisplay}</td>
                                        <td>{entry.ageLabel}</td>
                                      </tr>
                                    ))
                                  ) : (
                                    <tr>
                                      <td colSpan={UNREAD_DETAIL_SORT_COLUMNS.length}>
                                        No unread entries for this user in the selected date range.
                                      </td>
                                    </tr>
                                  )}
                                </tbody>
                              </table>
                            </td>
                          </tr>
                        ) : null}
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="reports-pm-results__lead">No users match the selected filters.</p>
          )}
        </div>
        {modal}
      </>
    );
  }

  return null;
}
