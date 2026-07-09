"use client";

import { useCallback, useEffect, useState } from "react";
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
  DEFAULT_LOST_FOUND_AGING_REPORT_FILTERS,
  DEFAULT_LOST_FOUND_FOUND_BY_REPORT_FILTERS,
  DEFAULT_LOST_FOUND_REPORT_FILTERS,
  getLostFoundReportTitle,
  LNF_DEPARTMENT_FILTER_OPTIONS,
  LOST_FOUND_AGING_STATUS_FILTER_OPTIONS,
  LOST_FOUND_STATUS_FILTER_OPTIONS,
  type LostFoundFoundByReportFilters,
  type LostFoundReportFilters,
  type LostFoundReportId,
} from "@/app/reports/lib/report-definitions";
import {
  buildLostFoundFilterOptions,
  createReportsSupabaseClient,
  fetchLostFoundReportSource,
} from "@/app/reports/lib/lost-found-report-data";
import type { LostFoundFilterOptions } from "@/app/reports/lib/lost-found-report-types";
import ReportsDateRangeField from "@/app/reports/components/ReportsDateRangeField";
import ReportsLnfPlaceholderResults from "@/app/reports/components/ReportsLnfPlaceholderResults";
import ReportsPrintableOutput from "@/app/reports/components/ReportsPrintableOutput";
import ReportsPropertyNameField from "@/app/reports/components/ReportsPropertyNameField";
import { useReportPropertyName, useSyncReportPropertyName } from "@/app/reports/hooks/useReportPropertyName";
import { LOST_FOUND_AGING_RETENTION_LABEL } from "@/app/reports/lib/report-property";
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
  const [filterOptions, setFilterOptions] = useState<LostFoundFilterOptions>({
    foundBy: ["All"],
    createdBy: ["All"],
  });
  const { propertyName, loading: propertyLoading } = useReportPropertyName();

  const syncPropertyName = useCallback((name: string) => {
    setFilters((prev) => ({ ...prev, propertyName: name }));
    setFoundByFilters((prev) => ({ ...prev, propertyName: name }));
  }, []);

  useEffect(() => {
    if (!open) {
      setFilters(applyDefaultReportDateRange(DEFAULT_LOST_FOUND_REPORT_FILTERS));
      setFoundByFilters(applyDefaultReportDateRange(DEFAULT_LOST_FOUND_FOUND_BY_REPORT_FILTERS));
      setDatePreset(DEFAULT_REPORT_DATE_PRESET);
      setShowResults(false);
      return;
    }

    if (reportId === "ready-to-discard") {
      setFilters({
        ...DEFAULT_LOST_FOUND_AGING_REPORT_FILTERS,
        propertyName,
      });
    } else if (reportId === "found-by") {
      setFoundByFilters(
        applyDefaultReportDateRange({
          ...DEFAULT_LOST_FOUND_FOUND_BY_REPORT_FILTERS,
          propertyName,
        })
      );
      setDatePreset(DEFAULT_REPORT_DATE_PRESET);
    } else {
      setFilters(
        applyDefaultReportDateRange({
          ...DEFAULT_LOST_FOUND_REPORT_FILTERS,
          propertyName,
        })
      );
      setDatePreset(DEFAULT_REPORT_DATE_PRESET);
    }

    let cancelled = false;

    async function loadFilterOptions() {
      try {
        const supabase = createReportsSupabaseClient();
        const source = await fetchLostFoundReportSource(supabase);
        if (cancelled) return;
        setFilterOptions(buildLostFoundFilterOptions(source.items));
      } catch {
        if (!cancelled) {
          setFilterOptions({ foundBy: ["All"], createdBy: ["All"] });
        }
      }
    }

    void loadFilterOptions();

    return () => {
      cancelled = true;
    };
  }, [open, reportId, propertyName]);

  useSyncReportPropertyName(open, propertyName, syncPropertyName);

  if (!open || !reportId) return null;

  const isFoundByReport = reportId === "found-by";
  const isAllItemsReport = reportId === "all-items";
  const isShippingReport = reportId === "shipped-items";
  const isAgingReport = reportId === "ready-to-discard";
  const usesSharedItemFilters = isAllItemsReport || isShippingReport || isAgingReport;
  const statusFilterOptions = isAgingReport
    ? LOST_FOUND_AGING_STATUS_FILTER_OPTIONS
    : LOST_FOUND_STATUS_FILTER_OPTIONS;

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

  const activePropertyName = propertyName || (isFoundByReport ? foundByFilters.propertyName : filters.propertyName);
  const activeDateStart = isFoundByReport ? foundByFilters.dateStart : filters.dateStart;
  const activeDateEnd = isFoundByReport ? foundByFilters.dateEnd : filters.dateEnd;
  const reportDateRangeLabel = isAgingReport
    ? LOST_FOUND_AGING_RETENTION_LABEL
    : formatReportDateRangeLabel(datePreset, activeDateStart, activeDateEnd);
  const lnfFilterLines = isFoundByReport
    ? [
        `Found By: ${foundByFilters.foundBy}`,
        `Department: ${foundByFilters.department}`,
      ]
    : usesSharedItemFilters
      ? [
          `Status: ${filters.status}`,
          `Found By: ${filters.foundBy}`,
          ...(isAllItemsReport ? [`Created By: ${filters.createdBy}`] : []),
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
          <ReportsPropertyNameField
            propertyName={activePropertyName}
            loading={propertyLoading}
          />

          {usesSharedItemFilters ? (
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
                  {statusFilterOptions.map((status) => (
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
                  {filterOptions.foundBy.map((associate) => (
                    <option key={associate} value={associate}>
                      {associate}
                    </option>
                  ))}
                </select>
              </label>

              {isAllItemsReport ? (
                <label className="reports-pm-modal__field">
                  <span style={fieldLabel}>Created By</span>
                  <select
                    className="one-eyrie-field"
                    value={filters.createdBy}
                    onChange={(event) => updateFilter("createdBy", event.target.value)}
                  >
                    {filterOptions.createdBy.map((associate) => (
                      <option key={associate} value={associate}>
                        {associate}
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}
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
                  {filterOptions.foundBy.map((associate) => (
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

          {isAgingReport ? null : (
            <ReportsDateRangeField
              preset={datePreset}
              dateStart={activeDateStart}
              dateEnd={activeDateEnd}
              onChange={updateDateRange}
              fieldLabelStyle={fieldLabel}
            />
          )}
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
              propertyName={activePropertyName}
              dateRangeLabel={reportDateRangeLabel}
              filterLines={lnfFilterLines}
              scheduleContext={{
                reportModule: "lnf",
                reportId,
                reportName: getLostFoundReportTitle(reportId),
                propertyName: activePropertyName,
                dateRangeLabel: reportDateRangeLabel,
                datePreset: isAgingReport ? "custom" : datePreset,
                dateStart: isAgingReport ? "" : activeDateStart,
                dateEnd: isAgingReport ? "" : activeDateEnd,
                filterLines: lnfFilterLines,
                filterSnapshot: isFoundByReport
                  ? {
                      reportVariant: "found-by",
                      propertyName: activePropertyName,
                      foundBy: foundByFilters.foundBy,
                      department: foundByFilters.department,
                    }
                  : usesSharedItemFilters
                    ? {
                        reportVariant: reportId,
                        propertyName: activePropertyName,
                        status: filters.status,
                        foundBy: filters.foundBy,
                        ...(isAllItemsReport ? { createdBy: filters.createdBy } : {}),
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
