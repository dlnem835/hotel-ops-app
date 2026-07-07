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
  DEFAULT_LOST_FOUND_REPORT_FILTERS,
  getLostFoundReportTitle,
  LOST_FOUND_STATUS_FILTER_OPTIONS,
  REPORT_PROPERTY_OPTIONS,
  type LostFoundReportFilters,
  type LostFoundReportId,
} from "@/app/reports/lib/report-definitions";
import ReportsLnfPlaceholderResults from "@/app/reports/components/ReportsLnfPlaceholderResults";

type ReportsLnfFilterModalProps = {
  open: boolean;
  reportId: LostFoundReportId | null;
  onClose: () => void;
};

const fieldLabel: React.CSSProperties = {
  display: "block",
  color: ONE_EYRIE.textSubtle,
  fontSize: "12px",
  fontWeight: 700,
  marginBottom: "6px",
};

export default function ReportsLnfFilterModal({
  open,
  reportId,
  onClose,
}: ReportsLnfFilterModalProps) {
  const [filters, setFilters] = useState<LostFoundReportFilters>(DEFAULT_LOST_FOUND_REPORT_FILTERS);
  const [showResults, setShowResults] = useState(false);

  useEffect(() => {
    if (!open) {
      setFilters(DEFAULT_LOST_FOUND_REPORT_FILTERS);
      setShowResults(false);
    }
  }, [open, reportId]);

  if (!open || !reportId) return null;

  function updateFilter<K extends keyof LostFoundReportFilters>(
    key: K,
    value: LostFoundReportFilters[K]
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
        className="reports-pm-modal reports-lnf-modal"
        style={{
          ...ONE_EYRIE_MODAL_BOX,
          width: showResults ? "min(1040px, 96vw)" : "560px",
          maxHeight: "92vh",
          overflow: "auto",
        }}
        role="dialog"
        aria-modal="true"
        aria-labelledby="reports-lnf-modal-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div style={ONE_EYRIE_MODAL_HEADER}>
          <div>
            <h2
              id="reports-lnf-modal-title"
              style={{ margin: 0, color: ONE_EYRIE.gold, fontSize: "20px", fontWeight: 800 }}
            >
              {getLostFoundReportTitle(reportId)}
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
                  event.target.value as LostFoundReportFilters["status"]
                )
              }
            >
              {LOST_FOUND_STATUS_FILTER_OPTIONS.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
          </label>

          <label className="reports-pm-modal__field">
            <span style={fieldLabel}>Guest Last Name</span>
            <input
              type="search"
              className="one-eyrie-field"
              value={filters.guestLastName}
              onChange={(event) => updateFilter("guestLastName", event.target.value)}
              placeholder="Search guest last name…"
            />
          </label>

          <label className="reports-pm-modal__field">
            <span style={fieldLabel}>Room Number</span>
            <input
              type="search"
              className="one-eyrie-field"
              value={filters.roomNumber}
              onChange={(event) => updateFilter("roomNumber", event.target.value)}
              placeholder="Search room number…"
            />
          </label>

          <label className="reports-pm-modal__field">
            <span style={fieldLabel}>Item Name</span>
            <input
              type="search"
              className="one-eyrie-field"
              value={filters.itemName}
              onChange={(event) => updateFilter("itemName", event.target.value)}
              placeholder="Search item name…"
            />
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
            <ReportsLnfPlaceholderResults reportId={reportId} />
          </div>
        ) : null}
      </div>
    </div>
  );
}
