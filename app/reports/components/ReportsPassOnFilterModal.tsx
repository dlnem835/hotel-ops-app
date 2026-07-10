"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { X } from "lucide-react";
import {
  ONE_EYRIE_MODAL_BOX,
  ONE_EYRIE_MODAL_CLOSE_BUTTON,
  ONE_EYRIE_MODAL_FOOTER,
  ONE_EYRIE_MODAL_HEADER,
  ONE_EYRIE_MODAL_OVERLAY,
} from "@/app/lib/one-eyrie-modal-styles";
import { ONE_EYRIE } from "@/app/lib/oneEyrieColors";
import {
  GOLD_FILLED_BUTTON,
  goldFilledHoverHandlers,
  NEUTRAL_BUTTON,
  neutralHoverHandlers,
} from "@/app/lib/oneEyrieButtons";
import {
  DEFAULT_PASS_ON_REPORT_FILTERS,
  DEFAULT_PASS_ON_UNREAD_REPORT_FILTERS,
  getPassOnReportTitle,
  PASS_ON_PRIORITY_FILTER_OPTIONS,
  PASS_ON_SHIFT_FILTER_OPTIONS,
  type PassOnReportFilters,
  type PassOnReportId,
  type PassOnUnreadReportFilters,
} from "@/app/reports/lib/report-definitions";
import { fetchPassOnReportSource } from "@/app/reports/lib/pass-on-report-data";
import ReportsDateRangeField from "@/app/reports/components/ReportsDateRangeField";
import ReportsPassOnResults from "@/app/reports/components/ReportsPassOnResults";
import ReportsPrintableOutput from "@/app/reports/components/ReportsPrintableOutput";
import ReportsPropertyNameField from "@/app/reports/components/ReportsPropertyNameField";
import { useReportPropertyName, useSyncReportPropertyName } from "@/app/reports/hooks/useReportPropertyName";
import {
  applyDefaultReportDateRange,
  DEFAULT_REPORT_DATE_PRESET,
  type ReportDatePreset,
} from "@/app/reports/lib/report-date-presets";
import { formatReportDateRangeLabel } from "@/app/reports/lib/report-output-utils";

type ReportsPassOnFilterModalProps = {
  open: boolean;
  reportId: PassOnReportId | null;
  onClose: () => void;
};

const fieldLabel: React.CSSProperties = {
  display: "block",
  color: ONE_EYRIE.textSubtle,
  fontSize: "12px",
  fontWeight: 700,
  marginBottom: "6px",
};

export default function ReportsPassOnFilterModal({
  open,
  reportId,
  onClose,
}: ReportsPassOnFilterModalProps) {
  const [filters, setFilters] = useState<PassOnReportFilters>(() =>
    applyDefaultReportDateRange(DEFAULT_PASS_ON_REPORT_FILTERS)
  );
  const [unreadFilters, setUnreadFilters] = useState<PassOnUnreadReportFilters>(() =>
    applyDefaultReportDateRange(DEFAULT_PASS_ON_UNREAD_REPORT_FILTERS)
  );
  const [datePreset, setDatePreset] = useState<ReportDatePreset>(DEFAULT_REPORT_DATE_PRESET);
  const [showResults, setShowResults] = useState(false);
  const [filterOptionsLoading, setFilterOptionsLoading] = useState(false);
  const [createdByOptions, setCreatedByOptions] = useState<string[]>(["All"]);
  const [departmentOptions, setDepartmentOptions] = useState<string[]>(["All"]);
  const [userOptions, setUserOptions] = useState<string[]>(["All"]);
  const { propertyName, loading: propertyLoading } = useReportPropertyName();

  const syncPropertyName = useCallback((name: string) => {
    setFilters((prev) => ({ ...prev, propertyName: name }));
    setUnreadFilters((prev) => ({ ...prev, propertyName: name }));
  }, []);

  useSyncReportPropertyName(open, propertyName, syncPropertyName);

  useEffect(() => {
    if (!open) {
      setFilters(applyDefaultReportDateRange(DEFAULT_PASS_ON_REPORT_FILTERS));
      setUnreadFilters(applyDefaultReportDateRange(DEFAULT_PASS_ON_UNREAD_REPORT_FILTERS));
      setDatePreset(DEFAULT_REPORT_DATE_PRESET);
      setShowResults(false);
    }
  }, [open, reportId]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;

    async function loadFilterOptions() {
      setFilterOptionsLoading(true);
      try {
        const source = await fetchPassOnReportSource();
        if (cancelled) return;
        setCreatedByOptions(source.filterOptions.createdByOptions);
        setDepartmentOptions(source.filterOptions.departmentOptions);
        setUserOptions(["All", ...source.filterOptions.userOptions.map((user) => user.displayName)]);
      } catch {
        if (!cancelled) {
          setCreatedByOptions(["All"]);
          setDepartmentOptions(["All"]);
          setUserOptions(["All"]);
        }
      } finally {
        if (!cancelled) setFilterOptionsLoading(false);
      }
    }

    void loadFilterOptions();
    return () => {
      cancelled = true;
    };
  }, [open, reportId]);

  if (!open || !reportId) return null;

  const isUnreadReport = reportId === "unread-entries-by-user";
  const isKeywordReport = reportId === "keyword-search";
  const activePropertyName =
    propertyName || (isUnreadReport ? unreadFilters.propertyName : filters.propertyName);

  function updateFilter<K extends keyof PassOnReportFilters>(
    key: K,
    value: PassOnReportFilters[K]
  ) {
    setFilters((prev) => ({ ...prev, [key]: value }));
    setShowResults(false);
  }

  function updateUnreadFilter<K extends keyof PassOnUnreadReportFilters>(
    key: K,
    value: PassOnUnreadReportFilters[K]
  ) {
    setUnreadFilters((prev) => ({ ...prev, [key]: value }));
    setShowResults(false);
  }

  function updateDateRange(value: {
    preset: ReportDatePreset;
    dateStart: string;
    dateEnd: string;
  }) {
    setDatePreset(value.preset);
    if (isUnreadReport) {
      setUnreadFilters((prev) => ({
        ...prev,
        dateStart: value.dateStart,
        dateEnd: value.dateEnd,
      }));
    } else {
      setFilters((prev) => ({
        ...prev,
        dateStart: value.dateStart,
        dateEnd: value.dateEnd,
      }));
    }
    setShowResults(false);
  }

  const activeDateStart = isUnreadReport ? unreadFilters.dateStart : filters.dateStart;
  const activeDateEnd = isUnreadReport ? unreadFilters.dateEnd : filters.dateEnd;

  const passOnFilterLines = useMemo(() => {
    if (isUnreadReport) {
      return [
        `Department: ${unreadFilters.department}`,
        `User: ${unreadFilters.user}`,
        `Shift: ${unreadFilters.shift}`,
      ];
    }

    const lines = [
      `Created By: ${filters.associate}`,
      `Shift: ${filters.shift}`,
      `Priority: ${filters.priority}`,
    ];
    if (isKeywordReport && filters.keyword.trim()) {
      lines.push(`Keyword: ${filters.keyword.trim()}`);
    }
    return lines;
  }, [filters, isKeywordReport, isUnreadReport, unreadFilters]);

  const canRunKeywordReport = !isKeywordReport || filters.keyword.trim().length > 0;

  function handleRunReport() {
    if (isKeywordReport && !filters.keyword.trim()) {
      setShowResults(true);
      return;
    }
    setShowResults(true);
  }

  return (
    <div
      className="reports-pm-modal-overlay"
      style={ONE_EYRIE_MODAL_OVERLAY}
      role="presentation"
      onClick={onClose}
    >
      <div
        className="reports-pm-modal"
        style={{
          ...ONE_EYRIE_MODAL_BOX,
          width: showResults ? "min(1100px, 96vw)" : "560px",
          maxHeight: "92vh",
          overflow: "auto",
        }}
        role="dialog"
        aria-modal="true"
        aria-labelledby="reports-pass-on-modal-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div style={ONE_EYRIE_MODAL_HEADER}>
          <div>
            <h2
              id="reports-pass-on-modal-title"
              style={{ margin: 0, color: ONE_EYRIE.gold, fontSize: "20px", fontWeight: 800 }}
            >
              {getPassOnReportTitle(reportId)}
            </h2>
            <p style={{ margin: "6px 0 0", color: ONE_EYRIE.textSubtle, fontSize: "13px" }}>
              Configure filters, then run the report.
            </p>
          </div>
          <button
            type="button"
            style={ONE_EYRIE_MODAL_CLOSE_BUTTON}
            onClick={onClose}
            aria-label="Close report filters"
          >
            <X size={22} />
          </button>
        </div>

        <div className="reports-pm-modal__form">
          <ReportsPropertyNameField
            propertyName={activePropertyName}
            loading={propertyLoading}
          />

          {isUnreadReport ? (
            <>
              <label className="reports-pm-modal__field">
                <span style={fieldLabel}>Department</span>
                <select
                  className="one-eyrie-field"
                  value={unreadFilters.department}
                  disabled={filterOptionsLoading}
                  onChange={(event) => updateUnreadFilter("department", event.target.value)}
                >
                  {departmentOptions.map((department) => (
                    <option key={department} value={department}>
                      {department}
                    </option>
                  ))}
                </select>
              </label>

              <label className="reports-pm-modal__field">
                <span style={fieldLabel}>User</span>
                <select
                  className="one-eyrie-field"
                  value={unreadFilters.user}
                  disabled={filterOptionsLoading}
                  onChange={(event) => updateUnreadFilter("user", event.target.value)}
                >
                  {userOptions.map((user) => (
                    <option key={user} value={user}>
                      {user}
                    </option>
                  ))}
                </select>
              </label>

              <label className="reports-pm-modal__field">
                <span style={fieldLabel}>Shift</span>
                <select
                  className="one-eyrie-field"
                  value={unreadFilters.shift}
                  onChange={(event) =>
                    updateUnreadFilter(
                      "shift",
                      event.target.value as PassOnUnreadReportFilters["shift"]
                    )
                  }
                >
                  {PASS_ON_SHIFT_FILTER_OPTIONS.map((shift) => (
                    <option key={shift} value={shift}>
                      {shift}
                    </option>
                  ))}
                </select>
              </label>
            </>
          ) : (
            <>
              {isKeywordReport ? (
                <label className="reports-pm-modal__field">
                  <span style={fieldLabel}>Keyword / Search Phrase</span>
                  <input
                    className="one-eyrie-field"
                    type="text"
                    value={filters.keyword}
                    onChange={(event) => updateFilter("keyword", event.target.value)}
                    placeholder="Search subject and entry body"
                  />
                </label>
              ) : null}

              <label className="reports-pm-modal__field">
                <span style={fieldLabel}>Created By</span>
                <select
                  className="one-eyrie-field"
                  value={filters.associate}
                  disabled={filterOptionsLoading}
                  onChange={(event) => updateFilter("associate", event.target.value)}
                >
                  {createdByOptions.map((associate) => (
                    <option key={associate} value={associate}>
                      {associate}
                    </option>
                  ))}
                </select>
              </label>

              <label className="reports-pm-modal__field">
                <span style={fieldLabel}>Shift</span>
                <select
                  className="one-eyrie-field"
                  value={filters.shift}
                  onChange={(event) =>
                    updateFilter("shift", event.target.value as PassOnReportFilters["shift"])
                  }
                >
                  {PASS_ON_SHIFT_FILTER_OPTIONS.map((shift) => (
                    <option key={shift} value={shift}>
                      {shift}
                    </option>
                  ))}
                </select>
              </label>

              <label className="reports-pm-modal__field">
                <span style={fieldLabel}>Priority</span>
                <select
                  className="one-eyrie-field"
                  value={filters.priority}
                  onChange={(event) =>
                    updateFilter(
                      "priority",
                      event.target.value as PassOnReportFilters["priority"]
                    )
                  }
                >
                  {PASS_ON_PRIORITY_FILTER_OPTIONS.map((priority) => (
                    <option key={priority} value={priority}>
                      {priority}
                    </option>
                  ))}
                </select>
              </label>
            </>
          )}

          <ReportsDateRangeField
            preset={datePreset}
            dateStart={activeDateStart}
            dateEnd={activeDateEnd}
            onChange={updateDateRange}
            fieldLabelStyle={fieldLabel}
          />
        </div>

        <div style={ONE_EYRIE_MODAL_FOOTER}>
          <button
            type="button"
            style={NEUTRAL_BUTTON}
            {...neutralHoverHandlers}
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            type="button"
            style={GOLD_FILLED_BUTTON}
            {...goldFilledHoverHandlers}
            onClick={handleRunReport}
          >
            Run Report
          </button>
        </div>

        {showResults ? (
          <div className="reports-pm-modal__results">
            <ReportsPrintableOutput
              reportName={getPassOnReportTitle(reportId)}
              propertyName={activePropertyName}
              dateRangeLabel={formatReportDateRangeLabel(
                datePreset,
                activeDateStart,
                activeDateEnd
              )}
              filterLines={passOnFilterLines}
              scheduleContext={{
                reportModule: "pass-on",
                reportId,
                reportName: getPassOnReportTitle(reportId),
                propertyName: activePropertyName,
                dateRangeLabel: formatReportDateRangeLabel(
                  datePreset,
                  activeDateStart,
                  activeDateEnd
                ),
                datePreset,
                dateStart: activeDateStart,
                dateEnd: activeDateEnd,
                filterLines: passOnFilterLines,
                filterSnapshot: isUnreadReport
                  ? {
                      reportVariant: "unread-entries-by-user",
                      propertyName: activePropertyName,
                      department: unreadFilters.department,
                      user: unreadFilters.user,
                      shift: unreadFilters.shift,
                    }
                  : {
                      reportVariant: reportId,
                      propertyName: activePropertyName,
                      associate: filters.associate,
                      shift: filters.shift,
                      priority: filters.priority,
                      keyword: filters.keyword,
                    },
              }}
            >
              {isKeywordReport && !canRunKeywordReport ? (
                <p className="reports-pm-results__lead">
                  Enter a keyword or phrase to search Pass-On entries.
                </p>
              ) : (
                <ReportsPassOnResults
                  reportId={reportId}
                  filters={filters}
                  unreadFilters={isUnreadReport ? unreadFilters : undefined}
                />
              )}
            </ReportsPrintableOutput>
          </div>
        ) : null}
      </div>
    </div>
  );
}
