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
  DEFAULT_LOST_FOUND_FOUND_BY_REPORT_FILTERS,
  DEFAULT_LOST_FOUND_REPORT_FILTERS,
  getLostFoundReportTitle,
  LNF_DEPARTMENT_FILTER_OPTIONS,
  LOST_FOUND_STATUS_FILTER_OPTIONS,
  REPORT_PROPERTY_OPTIONS,
  type LostFoundFoundByReportFilters,
  type LostFoundReportFilters,
  type LostFoundReportId,
} from "@/app/reports/lib/report-definitions";
import { SAMPLE_LNF_CREATED_BY_ASSOCIATES, SAMPLE_LNF_FOUND_BY_ASSOCIATES } from "@/app/reports/lib/lost-found-report-sample-data";
import ReportsDateRangeField from "@/app/reports/components/ReportsDateRangeField";
import ReportsLnfPlaceholderResults from "@/app/reports/components/ReportsLnfPlaceholderResults";
import ReportsPrintableOutput from "@/app/reports/components/ReportsPrintableOutput";
import {
  applyDefaultReportDateRange,
  DEFAULT_REPORT_DATE_PRESET,
  type ReportDatePreset,
} from "@/app/reports/lib/report-date-presets";
import { formatReportDateRangeLabel } from "@/app/reports/lib/report-output-utils";

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
  const [filters, setFilters] = useState<LostFoundReportFilters>(() =>
    applyDefaultReportDateRange(DEFAULT_LOST_FOUND_REPORT_FILTERS)
  );
  const [foundByFilters, setFoundByFilters] = useState<LostFoundFoundByReportFilters>(() =>
    applyDefaultReportDateRange(DEFAULT_LOST_FOUND_FOUND_BY_REPORT_FILTERS)
  );
  const [datePreset, setDatePreset] = useState<ReportDatePreset>(DEFAULT_REPORT_DATE_PRESET);
  const [showResults, setShowResults] = useState(false);

  useEffect(() => {
    if (!open) {
      setFilters(applyDefaultReportDateRange(DEFAULT_LOST_FOUND_REPORT_FILTERS));
      setFoundByFilters(applyDefaultReportDateRange(DEFAULT_LOST_FOUND_FOUND_BY_REPORT_FILTERS));
      setDatePreset(DEFAULT_REPORT_DATE_PRESET);
      setShowResults(false);
    }
  }, [open, reportId]);

  if (!open || !reportId) return null;

  const isFoundByReport = reportId === "found-by";
  const isAllItemsReport = reportId === "all-items";

  function updateFilter<K extends keyof LostFoundReportFilters>(
    key: K,
    value: LostFoundReportFilters[K]
  ) {
    setFilters((prev) => ({ ...prev, [key]: value }));
    setShowResults(false);
  }

  function updateFoundByFilter<K extends keyof LostFoundFoundByReportFilters>(
    key: K,
    value: LostFoundFoundByReportFilters[K]
  ) {
    setFoundByFilters((prev) => ({ ...prev, [key]: value }));
    setShowResults(false);
  }

  function updateDateRange(value: {
    preset: ReportDatePreset;
    dateStart: string;
    dateEnd: string;
  }) {
    setDatePreset(value.preset);
    if (isFoundByReport) {
      setFoundByFilters((prev) => ({
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

  const activeDateStart = isFoundByReport ? foundByFilters.dateStart : filters.dateStart;
  const activeDateEnd = isFoundByReport ? foundByFilters.dateEnd : filters.dateEnd;
  const lnfFilterLines = isFoundByReport
    ? [
        `Found By: ${foundByFilters.foundBy}`,
        `Department: ${foundByFilters.department}`,
      ]
    : isAllItemsReport
      ? [
          `Status: ${filters.status}`,
          `Found By: ${filters.foundBy}`,
          `Created By: ${filters.createdBy}`,
        ]
      : [];

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
              value={isFoundByReport ? foundByFilters.propertyName : filters.propertyName}
              onChange={(event) =>
                isFoundByReport
                  ? updateFoundByFilter("propertyName", event.target.value)
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

          {isAllItemsReport ? (
            <>
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
                <span style={fieldLabel}>Found By</span>
                <select
                  className="one-eyrie-field"
                  value={filters.foundBy}
                  onChange={(event) => updateFilter("foundBy", event.target.value)}
                >
                  {SAMPLE_LNF_FOUND_BY_ASSOCIATES.map((associate) => (
                    <option key={associate} value={associate}>
                      {associate}
                    </option>
                  ))}
                </select>
              </label>

              <label className="reports-pm-modal__field">
                <span style={fieldLabel}>Created By</span>
                <select
                  className="one-eyrie-field"
                  value={filters.createdBy}
                  onChange={(event) => updateFilter("createdBy", event.target.value)}
                >
                  {SAMPLE_LNF_CREATED_BY_ASSOCIATES.map((associate) => (
                    <option key={associate} value={associate}>
                      {associate}
                    </option>
                  ))}
                </select>
              </label>
            </>
          ) : null}

          {isFoundByReport ? (
            <>
              <label className="reports-pm-modal__field">
                <span style={fieldLabel}>Found By</span>
                <select
                  className="one-eyrie-field"
                  value={foundByFilters.foundBy}
                  onChange={(event) => updateFoundByFilter("foundBy", event.target.value)}
                >
                  {SAMPLE_LNF_FOUND_BY_ASSOCIATES.map((associate) => (
                    <option key={associate} value={associate}>
                      {associate}
                    </option>
                  ))}
                </select>
              </label>

              <label className="reports-pm-modal__field">
                <span style={fieldLabel}>Department</span>
                <select
                  className="one-eyrie-field"
                  value={foundByFilters.department}
                  onChange={(event) =>
                    updateFoundByFilter(
                      "department",
                      event.target.value as LostFoundFoundByReportFilters["department"]
                    )
                  }
                >
                  {LNF_DEPARTMENT_FILTER_OPTIONS.map((department) => (
                    <option key={department} value={department}>
                      {department}
                    </option>
                  ))}
                </select>
              </label>
            </>
          ) : null}

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
            <ReportsPrintableOutput
              reportName={getLostFoundReportTitle(reportId)}
              propertyName={isFoundByReport ? foundByFilters.propertyName : filters.propertyName}
              dateRangeLabel={formatReportDateRangeLabel(
                datePreset,
                activeDateStart,
                activeDateEnd
              )}
              filterLines={lnfFilterLines}
              scheduleContext={{
                reportModule: "lnf",
                reportId,
                reportName: getLostFoundReportTitle(reportId),
                propertyName: isFoundByReport ? foundByFilters.propertyName : filters.propertyName,
                dateRangeLabel: formatReportDateRangeLabel(
                  datePreset,
                  activeDateStart,
                  activeDateEnd
                ),
                datePreset,
                dateStart: activeDateStart,
                dateEnd: activeDateEnd,
                filterLines: lnfFilterLines,
                filterSnapshot: isFoundByReport
                  ? {
                      reportVariant: "found-by",
                      propertyName: foundByFilters.propertyName,
                      foundBy: foundByFilters.foundBy,
                      department: foundByFilters.department,
                    }
                  : isAllItemsReport
                    ? {
                        reportVariant: "all-items",
                        propertyName: filters.propertyName,
                        status: filters.status,
                        foundBy: filters.foundBy,
                        createdBy: filters.createdBy,
                      }
                    : {
                        reportVariant: reportId,
                        propertyName: filters.propertyName,
                      },
              }}
            >
              <ReportsLnfPlaceholderResults
                reportId={reportId}
                filters={isFoundByReport ? undefined : filters}
                foundByFilters={isFoundByReport ? foundByFilters : undefined}
              />
            </ReportsPrintableOutput>
          </div>
        ) : null}
      </div>
    </div>
  );
}
