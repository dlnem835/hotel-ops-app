"use client";

import {
  getReportDateRangeForPreset,
  REPORT_DATE_PRESET_LABELS,
  REPORT_DATE_PRESETS,
  type ReportDatePreset,
} from "@/app/reports/lib/report-date-presets";

type ReportsDateRangeFieldProps = {
  preset: ReportDatePreset;
  dateStart: string;
  dateEnd: string;
  onChange: (value: {
    preset: ReportDatePreset;
    dateStart: string;
    dateEnd: string;
  }) => void;
  fieldLabelStyle?: React.CSSProperties;
};

export default function ReportsDateRangeField({
  preset,
  dateStart,
  dateEnd,
  onChange,
  fieldLabelStyle,
}: ReportsDateRangeFieldProps) {
  function selectPreset(nextPreset: ReportDatePreset) {
    if (nextPreset === "custom") {
      onChange({
        preset: "custom",
        dateStart: preset === "custom" ? dateStart : "",
        dateEnd: preset === "custom" ? dateEnd : "",
      });
      return;
    }

    onChange({
      preset: nextPreset,
      ...getReportDateRangeForPreset(nextPreset),
    });
  }

  return (
    <div className="reports-date-range-field">
      <span style={fieldLabelStyle}>Date Range</span>
      <div
        className="reports-date-presets"
        role="group"
        aria-label="Quick date range"
      >
        {REPORT_DATE_PRESETS.map((option) => {
          const isActive = preset === option;
          return (
            <button
              key={option}
              type="button"
              className={
                isActive
                  ? "reports-date-presets__btn reports-date-presets__btn--active"
                  : "reports-date-presets__btn"
              }
              aria-pressed={isActive}
              onClick={() => selectPreset(option)}
            >
              {REPORT_DATE_PRESET_LABELS[option]}
            </button>
          );
        })}
      </div>

      {preset === "custom" ? (
        <div className="reports-pm-modal__date-row">
          <label className="reports-pm-modal__field">
            <span style={fieldLabelStyle}>Date Range Start</span>
            <input
              type="date"
              className="one-eyrie-field"
              value={dateStart}
              onChange={(event) =>
                onChange({
                  preset: "custom",
                  dateStart: event.target.value,
                  dateEnd,
                })
              }
            />
          </label>
          <label className="reports-pm-modal__field">
            <span style={fieldLabelStyle}>Date Range End</span>
            <input
              type="date"
              className="one-eyrie-field"
              value={dateEnd}
              onChange={(event) =>
                onChange({
                  preset: "custom",
                  dateStart,
                  dateEnd: event.target.value,
                })
              }
            />
          </label>
        </div>
      ) : null}
    </div>
  );
}
