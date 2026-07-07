"use client";

import { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import OneEyrieSidebar from "@/app/components/OneEyrieSidebar";
import OneEyriePageHeader from "@/app/components/OneEyriePageHeader";
import OneEyrieDesktopHeaderActions from "@/app/components/OneEyrieDesktopHeaderActions";
import { APP_SHELL, APP_SHELL_CLASS, MAIN_CONTENT, MAIN_CONTENT_CLASS } from "@/app/lib/oneEyrieLayout";
import ReportsCategorySection from "@/app/reports/components/ReportsCategorySection";
import ReportsEmptyTabState from "@/app/reports/components/ReportsEmptyTabState";
import ReportsPmFilterModal from "@/app/reports/components/ReportsPmFilterModal";
import ReportsTabs from "@/app/reports/components/ReportsTabs";
import {
  ALL_REPORT_SECTIONS,
  type PmReportId,
  type ReportsTabId,
} from "@/app/reports/lib/report-definitions";
import "./reports-responsive.css";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function ReportsPage() {
  const [activeTab, setActiveTab] = useState<ReportsTabId>("all");
  const [activePmReportId, setActivePmReportId] = useState<PmReportId | null>(null);

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
          subtitle="View and export operational reports across One Eyrie."
          actions={<OneEyrieDesktopHeaderActions />}
        />

        <div className="one-eyrie-reports-page">
          <ReportsTabs activeTab={activeTab} onTabChange={setActiveTab} />

          {activeTab === "all" ? (
            <div className="reports-sections">
              {ALL_REPORT_SECTIONS.map((section) => (
                <ReportsCategorySection
                  key={section.id}
                  section={section}
                  onReportSelect={(_report, pmReportId) => setActivePmReportId(pmReportId)}
                />
              ))}
            </div>
          ) : null}

          {activeTab === "saved" ? (
            <ReportsEmptyTabState
              title="Saved Reports"
              description="Saved report configurations will appear here. Pin filters and layouts from any report once reporting is live."
            />
          ) : null}

          {activeTab === "generated" ? (
            <ReportsEmptyTabState
              title="Generated Reports"
              description="Recently generated report runs will appear here for quick reopen and export."
            />
          ) : null}
        </div>
      </section>

      <ReportsPmFilterModal
        open={activePmReportId !== null}
        reportId={activePmReportId}
        onClose={() => setActivePmReportId(null)}
      />
    </main>
  );
}
