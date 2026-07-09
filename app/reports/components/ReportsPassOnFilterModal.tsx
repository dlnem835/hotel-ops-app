"use client";

import { useEffect, useState } from "react";
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
  PASS_ON_DEPARTMENT_FILTER_OPTIONS,
  PASS_ON_SHIFT_FILTER_OPTIONS,
  REPORT_PROPERTY_OPTIONS,
  type PassOnReportFilters,
  type PassOnReportId,
  type PassOnUnreadReportFilters,
} from "@/app/reports/lib/report-definitions";
import { PASS_ON_USER_FILTER_OPTIONS } from "@/app/reports/lib/pass-on-report-sample-data";
import ReportsDateRangeField from "@/app/reports/components/ReportsDateRangeField";
import ReportsPassOnPlaceholderResults from "@/app/reports/components/ReportsPassOnPlaceholderResults";
import { SAMPLE_INSPECTION_ASSOCIATES } from "@/app/reports/lib/inspection-report-sample-data";
import {
  applyDefaultReportDateRange,
  DEFAULT_REPORT_DATE_PRESET,
  type ReportDatePreset,
} from "@/app/reports/lib/report-date-presets";

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

  useEffect(() => {
    if (!open) {
      setFilters(applyDefaultReportDateRange(DEFAULT_PASS_ON_REPORT_FILTERS));
      setUnreadFilters(applyDefaultReportDateRange(DEFAULT_PASS_ON_UNREAD_REPORT_FILTERS));
      setDatePreset(DEFAULT_REPORT_DATE_PRESET);
      setShowResults(false);
    }
  }, [open, reportId]);

  if (!open || !reportId) return null;

  const isUnreadReport = reportId === "unread-entries-by-user";

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
          <label className="reports-pm-modal__field">
            <span style={fieldLabel}>Property Name</span>
            <select
              className="one-eyrie-field"
              value={isUnreadReport ? unreadFilters.propertyName : filters.propertyName}
              onChange={(event) =>
                isUnreadReport
                  ? updateUnreadFilter("propertyName", event.target.value)
                  : updateFilter("propertyName", event.target.value)
              }
            >
              {REPORT_PROPERTY_OPTIONS.map((property) => (
                <option key={property} value={property}>
                  {property}
                </option>
              ))}
            </select>
          </label>

          {isUnreadReport ? (
            <>
              <label className="reports-pm-modal__field">
                <span style={fieldLabel}>Department</span>
                <select
                  className="one-eyrie-field"
                  value={unreadFilters.department}
                  onChange={(event) =>
                    updateUnreadFilter(
                      "department",
                      event.target.value as PassOnUnreadReportFilters["department"]
                    )
                  }
                >
                  {PASS_ON_DEPARTMENT_FILTER_OPTIONS.map((department) => (
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
                  onChange={(event) => updateUnreadFilter("user", event.target.value)}
                >
                  {PASS_ON_USER_FILTER_OPTIONS.map((user) => (
                    <option key={user} value={user}>
                      {user}
                    </option>
                  ))}
                </select>
              </label>
            </>
          ) : (
            <>
              <label className="reports-pm-modal__field">
                <span style={fieldLabel}>Associate</span>
                <select
                  className="one-eyrie-field"
                  value={filters.associate}
                  onChange={(event) => updateFilter("associate", event.target.value)}
                >
                  {SAMPLE_INSPECTION_ASSOCIATES.map((associate) => (
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
                <span style={fieldLabel}>Keyword</span>
                <input
                  type="search"
                  className="one-eyrie-field"
                  value={filters.keyword}
                  onChange={(event) => updateFilter("keyword", event.target.value)}
                  placeholder="Search pass-on content…"
                />
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
            onClick={() => setShowResults(true)}
          >
            Run Report
          </button>
        </div>

        {showResults ? (
          <div className="reports-pm-modal__results">
            <ReportsPassOnPlaceholderResults
              reportId={reportId}
              unreadFilters={isUnreadReport ? unreadFilters : undefined}
            />
          </div>
        ) : null}
      </div>
    </div>
  );
}
