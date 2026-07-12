"use client";

import {
  INSPECTION_PERIODS,
  InspectionPeriod,
} from "@/app/inspections/lib/inspection-types";
import { ONE_EYRIE } from "@/app/lib/oneEyrieColors";
import {
  goldHoverHandlers,
  SETTINGS_BUTTON_BASE,
} from "@/app/settings/lib/settings-ui-interactions";

const PERIOD_LABELS: Record<InspectionPeriod, string> = {
  today: "Today",
  wtd: "WTD",
  mtd: "MTD",
  qtd: "QTD",
  ytd: "YTD",
};

type MaintenanceKpiPeriodFiltersProps = {
  period: InspectionPeriod;
  onPeriodChange: (period: InspectionPeriod) => void;
};

export default function MaintenanceKpiPeriodFilters({
  period,
  onPeriodChange,
}: MaintenanceKpiPeriodFiltersProps) {
  return (
    <div
      className="maintenance-kpi-period-filters"
      style={{
        display: "flex",
        flexWrap: "wrap",
        gap: "10px",
        alignItems: "center",
        marginBottom: "18px",
      }}
    >
      <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
        {INSPECTION_PERIODS.map((entry) => (
          <button
            key={entry}
            type="button"
            data-active={period === entry ? "true" : undefined}
            onClick={() => onPeriodChange(entry)}
            style={{
              ...SETTINGS_BUTTON_BASE,
              background: period === entry ? ONE_EYRIE.gold : "transparent",
              color: period === entry ? ONE_EYRIE.surface : ONE_EYRIE.text,
              border: `1px solid ${period === entry ? ONE_EYRIE.goldLight : ONE_EYRIE.border}`,
              borderRadius: "999px",
              padding: "8px 14px",
              fontWeight: 800,
              fontSize: "13px",
            }}
            {...goldHoverHandlers(period === entry ? "primary" : "secondary")}
          >
            {PERIOD_LABELS[entry]}
          </button>
        ))}
      </div>
    </div>
  );
}
