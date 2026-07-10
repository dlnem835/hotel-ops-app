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
  DEFAULT_INSPECTION_REPORT_FILTERS,
  getRoomInspectionReportTitle,
  getRpmInspectionReportTitle,
  type InspectionReportModalTarget,
} from "@/app/reports/lib/report-definitions";
import {
  getInspectionReportLabels,
  ROOM_INSPECTION_TYPE_FILTER_OPTIONS,
  type InspectionReportFilters,
} from "@/app/reports/lib/inspection-report-sample-data";
import ReportsDateRangeField from "@/app/reports/components/ReportsDateRangeField";
import ReportsInspectionResults from "@/app/reports/components/ReportsInspectionResults";
import ReportsPrintableOutput from "@/app/reports/components/ReportsPrintableOutput";
import ReportsPropertyNameField from "@/app/reports/components/ReportsPropertyNameField";
import { useReportPropertyName, useSyncReportPropertyName } from "@/app/reports/hooks/useReportPropertyName";
import {
  applyDefaultReportDateRange,
  DEFAULT_REPORT_DATE_PRESET,
  type ReportDatePreset,
} from "@/app/reports/lib/report-date-presets";
import { fetchInspectionReportSource } from "@/app/reports/lib/inspection-report-data";
import { formatReportDateRangeLabel } from "@/app/reports/lib/report-output-utils";

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
  const [filters, setFilters] = useState<InspectionReportFilters>(() =>
    applyDefaultReportDateRange(DEFAULT_INSPECTION_REPORT_FILTERS)
  );
  const [datePreset, setDatePreset] = useState<ReportDatePreset>(DEFAULT_REPORT_DATE_PRESET);
  const [showResults, setShowResults] = useState(false);
  const [associateOptions, setAssociateOptions] = useState<string[]>(["All"]);
  const [inspectorOptions, setInspectorOptions] = useState<string[]>(["All"]);
  const { propertyName, loading: propertyLoading } = useReportPropertyName();

  const syncPropertyName = useCallback((name: string) => {
    setFilters((prev) => ({ ...prev, propertyName: name }));
  }, []);

  useSyncReportPropertyName(open, propertyName, syncPropertyName);

  useEffect(() => {
    if (!open) {
      setFilters(applyDefaultReportDateRange(DEFAULT_INSPECTION_REPORT_FILTERS));
      setDatePreset(DEFAULT_REPORT_DATE_PRESET);
      setShowResults(false);
      setAssociateOptions(["All"]);
      setInspectorOptions(["All"]);
    }
  }, [open, target]);

  useEffect(() => {
    if (!open || !target) return;

    let cancelled = false;
    const variant = target.variant;

    async function loadFilterOptions() {
      try {
        const source = await fetchInspectionReportSource(variant);
        if (!cancelled) {
          setAssociateOptions(source.associateOptions);
          setInspectorOptions(source.inspectorOptions);
        }
      } catch {
        if (!cancelled) {
          setAssociateOptions(["All"]);
          setInspectorOptions(["All"]);
        }
      }
    }

    void loadFilterOptions();

    return () => {
      cancelled = true;
    };
  }, [open, target]);

  if (!open || !target) return null;

  const title =
    target.variant === "rpm"
      ? getRpmInspectionReportTitle(target.reportId)
      : getRoomInspectionReportTitle(target.reportId);
  const inspectionFilterLines = [
    ...(target.variant === "room"
      ? [`Inspection Type: ${filters.type}`]
      : []),
    `Associate: ${filters.associate}`,
    `Inspector: ${filters.inspector}`,
  ];

  function updateFilter<K extends keyof InspectionReportFilters>(
    key: K,
    value: InspectionReportFilters[K]
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
          <ReportsPropertyNameField
            propertyName={propertyName || filters.propertyName}
            loading={propertyLoading}
          />

          {target.variant === "room" ? (
            <label className="reports-pm-modal__field">
              <span style={fieldLabel}>{getInspectionReportLabels("room").typeLabel}</span>
              <select
                className="one-eyrie-field"
                value={filters.type}
                onChange={(event) => updateFilter("type", event.target.value)}
              >
                {ROOM_INSPECTION_TYPE_FILTER_OPTIONS.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
            </label>
          ) : null}

          <label className="reports-pm-modal__field">
            <span style={fieldLabel}>Associate</span>
            <select
              className="one-eyrie-field"
              value={filters.associate}
              onChange={(event) => updateFilter("associate", event.target.value)}
            >
              {associateOptions.map((associate) => (
                <option key={associate} value={associate}>
                  {associate}
                </option>
              ))}
            </select>
          </label>

          <label className="reports-pm-modal__field">
            <span style={fieldLabel}>Inspector</span>
            <select
              className="one-eyrie-field"
              value={filters.inspector}
              onChange={(event) => updateFilter("inspector", event.target.value)}
            >
              {inspectorOptions.map((inspector) => (
                <option key={inspector} value={inspector}>
                  {inspector}
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
            onClick={() => setShowResults(true)}
          >
            Run Report
          </button>
        </div>

        {showResults ? (
          <div className="reports-pm-modal__results">
            <ReportsPrintableOutput
              reportName={title}
              propertyName={propertyName || filters.propertyName}
              dateRangeLabel={formatReportDateRangeLabel(
                datePreset,
                filters.dateStart,
                filters.dateEnd
              )}
              filterLines={inspectionFilterLines}
              scheduleContext={{
                reportModule: "inspection",
                reportId: target.reportId,
                reportName: title,
                propertyName: propertyName || filters.propertyName,
                dateRangeLabel: formatReportDateRangeLabel(
                  datePreset,
                  filters.dateStart,
                  filters.dateEnd
                ),
                datePreset,
                dateStart: filters.dateStart,
                dateEnd: filters.dateEnd,
                filterLines: inspectionFilterLines,
                inspectionVariant: target.variant,
                filterSnapshot: {
                  type: filters.type,
                  associate: filters.associate,
                  inspector: filters.inspector,
                },
              }}
            >
              <ReportsInspectionResults target={target} filters={filters} />
            </ReportsPrintableOutput>
          </div>
        ) : null}
      </div>
    </div>
  );
}
