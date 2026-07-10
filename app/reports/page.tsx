"use client";

import { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import OneEyrieSidebar from "@/app/components/OneEyrieSidebar";
import OneEyriePageHeader from "@/app/components/OneEyriePageHeader";
import OneEyrieDesktopHeaderActions from "@/app/components/OneEyrieDesktopHeaderActions";
import { APP_SHELL, APP_SHELL_CLASS, MAIN_CONTENT, MAIN_CONTENT_CLASS } from "@/app/lib/oneEyrieLayout";
import ReportsCategoryCard from "@/app/reports/components/ReportsCategoryCard";
import ReportsEmptyTabState from "@/app/reports/components/ReportsEmptyTabState";
import ReportsScheduledReportsList from "@/app/reports/components/ReportsScheduledReportsList";
import ReportsFavoritesTab from "@/app/reports/components/ReportsFavoritesTab";
import ReportsInspectionFilterModal from "@/app/reports/components/ReportsInspectionFilterModal";
import ReportsLnfFilterModal from "@/app/reports/components/ReportsLnfFilterModal";
import ReportsPassOnFilterModal from "@/app/reports/components/ReportsPassOnFilterModal";
import ReportsPmFilterModal from "@/app/reports/components/ReportsPmFilterModal";
import ReportsSearchBar from "@/app/reports/components/ReportsSearchBar";
import ReportsTabs from "@/app/reports/components/ReportsTabs";
import ReportsWoFilterModal from "@/app/reports/components/ReportsWoFilterModal";
import { ReportFavoritesProvider } from "@/app/reports/hooks/useReportFavorites";
import { filterReportsForSearch } from "@/app/reports/lib/reports-search";
import {
  ALL_REPORT_SECTIONS,
  type InspectionReportModalTarget,
  type LostFoundReportId,
  type PassOnReportId,
  type PmReportId,
  type ReportRowDefinition,
  type ReportsTabId,
  type WorkOrderReportId,
} from "@/app/reports/lib/report-definitions";
import "./reports-responsive.css";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function ReportsPage() {
  const [activeTab, setActiveTab] = useState<ReportsTabId>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [activePmReportId, setActivePmReportId] = useState<PmReportId | null>(null);
  const [activeWoReportId, setActiveWoReportId] = useState<WorkOrderReportId | null>(null);
  const [activeInspectionTarget, setActiveInspectionTarget] =
    useState<InspectionReportModalTarget | null>(null);
  const [activeLnfReportId, setActiveLnfReportId] = useState<LostFoundReportId | null>(null);
  const [activePassOnReportId, setActivePassOnReportId] = useState<PassOnReportId | null>(null);

  function clearModals() {
    setActivePmReportId(null);
    setActiveWoReportId(null);
    setActiveInspectionTarget(null);
    setActiveLnfReportId(null);
    setActivePassOnReportId(null);
  }

  function handleReportSelect(report: ReportRowDefinition) {
    clearModals();

    if (report.pmReportId) {
      setActivePmReportId(report.pmReportId);
      return;
    }
    if (report.woReportId) {
      setActiveWoReportId(report.woReportId);
      return;
    }
    if (report.roomInspectionReportId) {
      setActiveInspectionTarget({
        variant: "room",
        reportId: report.roomInspectionReportId,
      });
      return;
    }
    if (report.rpmInspectionReportId) {
      setActiveInspectionTarget({
        variant: "rpm",
        reportId: report.rpmInspectionReportId,
      });
      return;
    }
    if (report.lnfReportId) {
      setActiveLnfReportId(report.lnfReportId);
      return;
    }
    if (report.passOnReportId) {
      setActivePassOnReportId(report.passOnReportId);
    }
  }

  useEffect(() => {
    async function checkAuth() {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        window.location.href = "/login";
      }
    }

    void checkAuth();
  }, []);

  return (
    <main style={APP_SHELL} className={APP_SHELL_CLASS}>
      <OneEyrieSidebar active="Reports" />

      <section style={MAIN_CONTENT} className={MAIN_CONTENT_CLASS}>
        <OneEyriePageHeader
          title="Reports"
          subtitle="Generate operational reports across your hotel."
          actions={<OneEyrieDesktopHeaderActions />}
        />

        <div className="one-eyrie-reports-page">
          <ReportFavoritesProvider>
            <ReportsTabs activeTab={activeTab} onTabChange={setActiveTab} />

            <ReportsSearchBar value={searchQuery} onChange={setSearchQuery} />

            {activeTab === "all" ? (
              <>
                <div className="reports-category-grid">
                  {ALL_REPORT_SECTIONS.map((section) => (
                    <ReportsCategoryCard
                      key={section.id}
                      section={section}
                      searchQuery={searchQuery}
                      onReportSelect={handleReportSelect}
                    />
                  ))}
                </div>
                {searchQuery.trim() &&
                !ALL_REPORT_SECTIONS.some(
                  (section) => filterReportsForSearch(section, searchQuery).length > 0
                ) ? (
                  <ReportsEmptyTabState
                    title="No matching reports"
                    description={`No reports match "${searchQuery.trim()}". Try a different search term.`}
                  />
                ) : null}
              </>
            ) : null}

            {activeTab === "favorites" ? (
              <ReportsFavoritesTab
                searchQuery={searchQuery}
                onReportSelect={handleReportSelect}
              />
            ) : null}

            {activeTab === "scheduled" ? <ReportsScheduledReportsList /> : null}
          </ReportFavoritesProvider>
        </div>
      </section>

      <ReportsPmFilterModal
        open={activePmReportId !== null}
        reportId={activePmReportId}
        onClose={() => setActivePmReportId(null)}
      />

      <ReportsWoFilterModal
        open={activeWoReportId !== null}
        reportId={activeWoReportId}
        onClose={() => setActiveWoReportId(null)}
      />

      <ReportsInspectionFilterModal
        open={activeInspectionTarget !== null}
        target={activeInspectionTarget}
        onClose={() => setActiveInspectionTarget(null)}
      />

      <ReportsLnfFilterModal
        open={activeLnfReportId !== null}
        reportId={activeLnfReportId}
        onClose={() => setActiveLnfReportId(null)}
      />

      <ReportsPassOnFilterModal
        open={activePassOnReportId !== null}
        reportId={activePassOnReportId}
        onClose={() => setActivePassOnReportId(null)}
      />
    </main>
  );
}
