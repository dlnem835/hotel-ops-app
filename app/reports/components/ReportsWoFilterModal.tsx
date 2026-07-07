"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { WORK_ORDER_CATEGORIES } from "@/app/maintenance/lib/work-order-categories";
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
  DEFAULT_WORK_ORDER_REPORT_FILTERS,
  getWorkOrderReportTitle,
  REPORT_PROPERTY_OPTIONS,
  WORK_ORDER_STATUS_FILTER_OPTIONS,
  type WorkOrderReportFilters,
  type WorkOrderReportId,
} from "@/app/reports/lib/report-definitions";
import { SAMPLE_WORK_ORDER_LOCATION_OPTIONS } from "@/app/reports/lib/work-order-report-sample-data";
import ReportsWoPlaceholderResults from "@/app/reports/components/ReportsWoPlaceholderResults";
import ReportsWorkOrderAreaField from "@/app/reports/components/ReportsWorkOrderAreaField";

type ReportsWoFilterModalProps = {
  open: boolean;
  reportId: WorkOrderReportId | null;
  onClose: () => void;
};

const fieldLabel: React.CSSProperties = {
  display: "block",
  color: ONE_EYRIE.textSubtle,
  fontSize: "12px",
  fontWeight: 700,
  marginBottom: "6px",
};

export default function ReportsWoFilterModal({
  open,
  reportId,
  onClose,
}: ReportsWoFilterModalProps) {
  const [filters, setFilters] = useState<WorkOrderReportFilters>(DEFAULT_WORK_ORDER_REPORT_FILTERS);
  const [showResults, setShowResults] = useState(false);

  useEffect(() => {
    if (!open) {
      setFilters(DEFAULT_WORK_ORDER_REPORT_FILTERS);
      setShowResults(false);
    }
  }, [open, reportId]);

  if (!open || !reportId) return null;

  function updateFilter<K extends keyof WorkOrderReportFilters>(
    key: K,
    value: WorkOrderReportFilters[K]
  ) {
    setFilters((prev) => ({ ...prev, [key]: value }));
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
        className="reports-pm-modal reports-wo-modal"
        style={{
          ...ONE_EYRIE_MODAL_BOX,
          width: showResults ? "min(1100px, 96vw)" : "560px",
          maxHeight: "92vh",
          overflow: "auto",
        }}
        role="dialog"
        aria-modal="true"
        aria-labelledby="reports-wo-modal-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div style={ONE_EYRIE_MODAL_HEADER}>
          <div>
            <h2
              id="reports-wo-modal-title"
              style={{ margin: 0, color: ONE_EYRIE.gold, fontSize: "20px", fontWeight: 800 }}
            >
              {getWorkOrderReportTitle(reportId)}
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
            <span style={fieldLabel}>Status</span>
            <select
              className="one-eyrie-field"
              value={filters.status}
              onChange={(event) =>
                updateFilter(
                  "status",
                  event.target.value as WorkOrderReportFilters["status"]
                )
              }
            >
              {WORK_ORDER_STATUS_FILTER_OPTIONS.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
          </label>

          <div className="reports-pm-modal__field">
            <span style={fieldLabel}>Room / Area</span>
            <ReportsWorkOrderAreaField
              options={SAMPLE_WORK_ORDER_LOCATION_OPTIONS}
              selectedId={filters.areaId}
              selectedLabel={filters.areaLabel}
              onSelectAll={() => {
                setFilters((prev) => ({
                  ...prev,
                  areaId: null,
                  areaLabel: "All",
                }));
                setShowResults(false);
              }}
              onSelect={(id, label) => {
                setFilters((prev) => ({
                  ...prev,
                  areaId: id,
                  areaLabel: label,
                }));
                setShowResults(false);
              }}
              onClearSelection={() => {
                setFilters((prev) => ({
                  ...prev,
                  areaId: null,
                  areaLabel: "",
                }));
                setShowResults(false);
              }}
            />
          </div>

          <label className="reports-pm-modal__field">
            <span style={fieldLabel}>Category</span>
            <select
              className="one-eyrie-field"
              value={filters.category}
              onChange={(event) => updateFilter("category", event.target.value)}
            >
              <option value="All">All</option>
              {WORK_ORDER_CATEGORIES.map((category) => (
                <option key={category} value={category}>
                  {category}
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
            onClick={handleRunReport}
          >
            Run Report
          </button>
        </div>

        {showResults ? (
          <div className="reports-pm-modal__results">
            <ReportsWoPlaceholderResults reportId={reportId} />
          </div>
        ) : null}
      </div>
    </div>
  );
}
