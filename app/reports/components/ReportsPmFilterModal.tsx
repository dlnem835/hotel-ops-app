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
  DEFAULT_PM_REPORT_FILTERS,
  getPmReportTitle,
  PM_TYPE_FILTER_OPTIONS,
  REPORT_PROPERTY_OPTIONS,
  type PmReportFilters,
  type PmReportId,
} from "@/app/reports/lib/report-definitions";
import ReportsDateRangeField from "@/app/reports/components/ReportsDateRangeField";
import ReportsPmPlaceholderResults from "@/app/reports/components/ReportsPmPlaceholderResults";
import {
  applyDefaultReportDateRange,
  DEFAULT_REPORT_DATE_PRESET,
  type ReportDatePreset,
} from "@/app/reports/lib/report-date-presets";

type ReportsPmFilterModalProps = {
  open: boolean;
  reportId: PmReportId | null;
  onClose: () => void;
};

const fieldLabel: React.CSSProperties = {
  display: "block",
  color: ONE_EYRIE.textSubtle,
  fontSize: "12px",
  fontWeight: 700,
  marginBottom: "6px",
};

export default function ReportsPmFilterModal({
  open,
  reportId,
  onClose,
}: ReportsPmFilterModalProps) {
  const [filters, setFilters] = useState<PmReportFilters>(() =>
    applyDefaultReportDateRange(DEFAULT_PM_REPORT_FILTERS)
  );
  const [datePreset, setDatePreset] = useState<ReportDatePreset>(DEFAULT_REPORT_DATE_PRESET);
  const [showResults, setShowResults] = useState(false);

  useEffect(() => {
    if (!open) {
      setFilters(applyDefaultReportDateRange(DEFAULT_PM_REPORT_FILTERS));
      setDatePreset(DEFAULT_REPORT_DATE_PRESET);
      setShowResults(false);
    }
  }, [open, reportId]);

  if (!open || !reportId) return null;

  function updateFilter<K extends keyof PmReportFilters>(key: K, value: PmReportFilters[K]) {
    setFilters((prev) => ({ ...prev, [key]: value }));
    setShowResults(false);
  }

  function updateDateRange(value: {
    preset: ReportDatePreset;
    dateStart: string;
    dateEnd: string;
  }) {
    setDatePreset(value.preset);
    setFilters((prev) => ({
      ...prev,
      dateStart: value.dateStart,
      dateEnd: value.dateEnd,
    }));
    setShowResults(false);
  }

  function handleRunReport() {
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
          width: showResults ? "860px" : "560px",
          maxHeight: "92vh",
          overflow: "auto",
        }}
        role="dialog"
        aria-modal="true"
        aria-labelledby="reports-pm-modal-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div style={ONE_EYRIE_MODAL_HEADER}>
          <div>
            <h2
              id="reports-pm-modal-title"
              style={{ margin: 0, color: ONE_EYRIE.gold, fontSize: "20px", fontWeight: 800 }}
            >
              {getPmReportTitle(reportId)}
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
              value={filters.propertyName}
              onChange={(event) => updateFilter("propertyName", event.target.value)}
            >
              {REPORT_PROPERTY_OPTIONS.map((property) => (
                <option key={property} value={property}>
                  {property}
                </option>
              ))}
            </select>
          </label>

          <label className="reports-pm-modal__field">
            <span style={fieldLabel}>PM Type</span>
            <select
              className="one-eyrie-field"
              value={filters.pmType}
              onChange={(event) => updateFilter("pmType", event.target.value)}
            >
              {PM_TYPE_FILTER_OPTIONS.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
          </label>

          <ReportsDateRangeField
            preset={datePreset}
            dateStart={filters.dateStart}
            dateEnd={filters.dateEnd}
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
            <ReportsPmPlaceholderResults reportId={reportId} />
          </div>
        ) : null}
      </div>
    </div>
  );
}
