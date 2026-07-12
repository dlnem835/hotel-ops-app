"use client";

import { useCallback, useEffect, useState } from "react";
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
  WORK_ORDER_SOURCE_FILTER_OPTIONS,
  WORK_ORDER_STATUS_FILTER_OPTIONS,
  type WorkOrderReportFilters,
  type WorkOrderReportId,
} from "@/app/reports/lib/report-definitions";
import { buildWorkOrderLocationOptions } from "@/app/maintenance/lib/work-order-location";
import type { BuildingArea } from "@/app/settings/lib/buildings-types";
import { tenantFetch } from "@/app/lib/tenant/tenant-fetch";
import ReportsDateRangeField from "@/app/reports/components/ReportsDateRangeField";
import ReportsWoPlaceholderResults from "@/app/reports/components/ReportsWoPlaceholderResults";
import ReportsPrintableOutput from "@/app/reports/components/ReportsPrintableOutput";
import ReportsPropertyNameField from "@/app/reports/components/ReportsPropertyNameField";
import ReportsWorkOrderAreaField from "@/app/reports/components/ReportsWorkOrderAreaField";
import { useReportPropertyName, useSyncReportPropertyName } from "@/app/reports/hooks/useReportPropertyName";
import {
  applyDefaultReportDateRange,
  DEFAULT_REPORT_DATE_PRESET,
  type ReportDatePreset,
} from "@/app/reports/lib/report-date-presets";
import { formatReportDateRangeLabel } from "@/app/reports/lib/report-output-utils";

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
  const [filters, setFilters] = useState<WorkOrderReportFilters>(() =>
    applyDefaultReportDateRange(DEFAULT_WORK_ORDER_REPORT_FILTERS)
  );
  const [datePreset, setDatePreset] = useState<ReportDatePreset>(DEFAULT_REPORT_DATE_PRESET);
  const [showResults, setShowResults] = useState(false);
  const [locationOptions, setLocationOptions] = useState(
    buildWorkOrderLocationOptions([])
  );
  const { propertyName, loading: propertyLoading } = useReportPropertyName();

  const syncPropertyName = useCallback((name: string) => {
    setFilters((prev) => ({ ...prev, propertyName: name }));
  }, []);

  useSyncReportPropertyName(open, propertyName, syncPropertyName);

  useEffect(() => {
    if (!open) {
      setFilters(applyDefaultReportDateRange(DEFAULT_WORK_ORDER_REPORT_FILTERS));
      setDatePreset(DEFAULT_REPORT_DATE_PRESET);
      setShowResults(false);
      return;
    }

    let cancelled = false;

    async function loadLocationOptions() {
      try {
        const response = await tenantFetch("/api/buildings-areas");
        const result = await response.json();
        if (!response.ok) {
          throw new Error(result.error || "Unable to load areas");
        }
        if (cancelled) return;
        setLocationOptions(
          buildWorkOrderLocationOptions((result.areas ?? []) as BuildingArea[])
        );
      } catch {
        if (!cancelled) {
          setLocationOptions(buildWorkOrderLocationOptions([]));
        }
      }
    }

    void loadLocationOptions();

    return () => {
      cancelled = true;
    };
  }, [open, reportId]);

  if (!open || !reportId) return null;

  const isBySourceReport = reportId === "work-orders-by-source";
  const showSourceFilter = reportId === "all-work-orders" || isBySourceReport;
  const showExtendedFilters = !isBySourceReport;
  const woFilterLines = [
    `Status: ${filters.status}`,
    ...(showSourceFilter ? [`Source: ${filters.source}`] : []),
    ...(showExtendedFilters
      ? [
          `Room / Area: ${filters.areaLabel || "All"}`,
          `Category: ${filters.category}`,
        ]
      : []),
  ];

  function updateFilter<K extends keyof WorkOrderReportFilters>(
    key: K,
    value: WorkOrderReportFilters[K]
  ) {
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
          <ReportsPropertyNameField
            propertyName={propertyName || filters.propertyName}
            loading={propertyLoading}
          />

          {isBySourceReport ? (
            <label className="reports-pm-modal__field">
              <span style={fieldLabel}>Source</span>
              <select
                className="one-eyrie-field"
                value={filters.source}
                onChange={(event) =>
                  updateFilter(
                    "source",
                    event.target.value as WorkOrderReportFilters["source"]
                  )
                }
              >
                {WORK_ORDER_SOURCE_FILTER_OPTIONS.map((source) => (
                  <option key={source} value={source}>
                    {source}
                  </option>
                ))}
              </select>
            </label>
          ) : null}

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

          {showSourceFilter && !isBySourceReport ? (
            <label className="reports-pm-modal__field">
              <span style={fieldLabel}>Source</span>
              <select
                className="one-eyrie-field"
                value={filters.source}
                onChange={(event) =>
                  updateFilter(
                    "source",
                    event.target.value as WorkOrderReportFilters["source"]
                  )
                }
              >
                {WORK_ORDER_SOURCE_FILTER_OPTIONS.map((source) => (
                  <option key={source} value={source}>
                    {source}
                  </option>
                ))}
              </select>
            </label>
          ) : null}

          {showExtendedFilters ? (
            <>
              <div className="reports-pm-modal__field">
                <span style={fieldLabel}>Room / Area</span>
                <ReportsWorkOrderAreaField
                  options={locationOptions}
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
            </>
          ) : null}

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
            <ReportsPrintableOutput
              reportName={getWorkOrderReportTitle(reportId)}
              propertyName={propertyName || filters.propertyName}
              dateRangeLabel={formatReportDateRangeLabel(
                datePreset,
                filters.dateStart,
                filters.dateEnd
              )}
              filterLines={woFilterLines}
              scheduleContext={{
                reportModule: "wo",
                reportId,
                reportName: getWorkOrderReportTitle(reportId),
                propertyName: propertyName || filters.propertyName,
                dateRangeLabel: formatReportDateRangeLabel(
                  datePreset,
                  filters.dateStart,
                  filters.dateEnd
                ),
                datePreset,
                dateStart: filters.dateStart,
                dateEnd: filters.dateEnd,
                filterLines: woFilterLines,
                filterSnapshot: {
                  status: filters.status,
                  source: filters.source,
                  areaId: filters.areaId,
                  areaLabel: filters.areaLabel,
                  category: filters.category,
                },
              }}
            >
              <ReportsWoPlaceholderResults reportId={reportId} filters={filters} />
            </ReportsPrintableOutput>
          </div>
        ) : null}
      </div>
    </div>
  );
}
