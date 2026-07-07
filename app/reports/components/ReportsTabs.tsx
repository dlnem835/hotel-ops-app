"use client";

import type { ReportsTabId } from "@/app/reports/lib/report-definitions";
import { REPORTS_TABS } from "@/app/reports/lib/report-definitions";

type ReportsTabsProps = {
  activeTab: ReportsTabId;
  onTabChange: (tab: ReportsTabId) => void;
};

export default function ReportsTabs({ activeTab, onTabChange }: ReportsTabsProps) {
  return (
    <div className="reports-tabs" role="tablist" aria-label="Report views">
      {REPORTS_TABS.map((tab) => {
        const isActive = tab.id === activeTab;
        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={isActive}
            className={
              isActive
                ? "reports-tabs__tab reports-tabs__tab--active"
                : "reports-tabs__tab"
            }
            onClick={() => onTabChange(tab.id)}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}
