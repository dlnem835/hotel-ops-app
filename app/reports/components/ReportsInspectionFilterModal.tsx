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
  DEFAULT_INSPECTION_REPORT_FILTERS,
  getRoomInspectionReportTitle,
  getRpmInspectionReportTitle,
  REPORT_PROPERTY_OPTIONS,
  type InspectionReportModalTarget,
} from "@/app/reports/lib/report-definitions";
import {
  getInspectionReportLabels,
  ROOM_INSPECTION_TYPE_FILTER_OPTIONS,
  RPM_TYPE_FILTER_OPTIONS,
  SAMPLE_INSPECTION_ASSOCIATES,
  type InspectionReportFilters,
} from "@/app/reports/lib/inspection-report-sample-data";
import ReportsInspectionPlaceholderResults from "@/app/reports/components/ReportsInspectionPlaceholderResults";

type ReportsInspectionFilterModalProps = {
  open: boolean;
  target: InspectionReportModalTarget | null;
  onClose: () => void;
};

const fieldLabel: React.CSSProperties = {
  display: "block",
  color: ONE_EYRIE.textSubtle,
  fontSize: "12px",
  fontWeight: 700,
  marginBottom: "6px",
};

export default function ReportsInspectionFilterModal({
  open,
  target,
  onClose,
}: ReportsInspectionFilterModalProps) {
  const [filters, setFilters] = useState<InspectionReportFilters>(
    DEFAULT_INSPECTION_REPORT_FILTERS
  );
  const [showResults, setShowResults] = useState(false);

  useEffect(() => {
    if (!open) {
      setFilters(DEFAULT_INSPECTION_REPORT_FILTERS);
      setShowResults(false);
    }
  }, [open, target]);

  if (!open || !target) return null;

  const typeOptions =
    target.variant === "rpm"
      ? RPM_TYPE_FILTER_OPTIONS
      : ROOM_INSPECTION_TYPE_FILTER_OPTIONS;
  const typeLabel = getInspectionReportLabels(target.variant).typeLabel;
  const title =
    target.variant === "rpm"
      ? getRpmInspectionReportTitle(target.reportId)
      : getRoomInspectionReportTitle(target.reportId);

  function updateFilter<K extends keyof InspectionReportFilters>(
    key: K,
    value: InspectionReportFilters[K]
  ) {
    setFilters((prev) => ({ ...prev, [key]: value }));
    setShowResults(false);
  }

  return (
    <div
      className="reports-pm-modal-overlay"
      style={ONE_EYRIE_MODAL_OVERLAY}
      role="presentation"
      onClick={onClose}
    >
      <div
        className="reports-pm-modal reports-inspection-modal"
        style={{
          ...ONE_EYRIE_MODAL_BOX,
          width: showResults ? "min(980px, 96vw)" : "560px",
          maxHeight: "92vh",
          overflow: "auto",
        }}
        role="dialog"
        aria-modal="true"
        aria-labelledby="reports-inspection-modal-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div style={ONE_EYRIE_MODAL_HEADER}>
          <div>
            <h2
              id="reports-inspection-modal-title"
              style={{ margin: 0, color: ONE_EYRIE.gold, fontSize: "20px", fontWeight: 800 }}
            >
              {title}
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
            <span style={fieldLabel}>{typeLabel}</span>
            <select
              className="one-eyrie-field"
              value={filters.type}
              onChange={(event) => updateFilter("type", event.target.value)}
            >
              {typeOptions.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
          </label>

          <label className="reports-pm-modal__field">
            <span style={fieldLabel}>Associate / Inspector</span>
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

          <div className="reports-pm-modal__date-row">
            <label className="reports-pm-modal__field">
              <span style={fieldLabel}>Date Range Start</span>
              <input
                type="date"
                className="one-eyrie-field"
                value={filters.dateStart}
                onChange={(event) => updateFilter("dateStart", event.target.value)}
              />
            </label>
            <label className="reports-pm-modal__field">
              <span style={fieldLabel}>Date Range End</span>
              <input
                type="date"
                className="one-eyrie-field"
                value={filters.dateEnd}
                onChange={(event) => updateFilter("dateEnd", event.target.value)}
              />
            </label>
          </div>
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
            <ReportsInspectionPlaceholderResults target={target} />
          </div>
        ) : null}
      </div>
    </div>
  );
}
