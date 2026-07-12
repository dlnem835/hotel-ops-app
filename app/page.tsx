"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import OneEyrieSidebar from "@/app/components/OneEyrieSidebar";
import OneEyriePageHeader from "@/app/components/OneEyriePageHeader";
import { ONE_EYRIE } from "@/app/lib/oneEyrieColors";
import { APP_SHELL, APP_SHELL_CLASS, MAIN_CONTENT, MAIN_CONTENT_CLASS } from "@/app/lib/oneEyrieLayout";
import { tenantFetch } from "@/app/lib/tenant/tenant-fetch";
import { OperationalDashboardPayload } from "./dashboard/lib/operational-types";
import TodaysWorkSection from "./dashboard/components/TodaysWorkSection";
import PastDueSummaryBar from "./dashboard/components/PastDueSummaryBar";
import PassOnLogSection from "./dashboard/components/PassOnLogSection";
import OpenWorkOrdersSection from "./dashboard/components/OpenWorkOrdersSection";
import LostFoundSummaryCard from "./dashboard/components/LostFoundSummaryCard";
import "./dashboard/dashboard-responsive.css";
import "./dashboard/dashboard-light-theme.css";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function DashboardPage() {
  const [dashboard, setDashboard] = useState<OperationalDashboardPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    setError(null);
    const response = await tenantFetch("/api/dashboard");
    const result = await response.json();
    setLoading(false);

    if (!response.ok) {
      setError(result.error || "Unable to load dashboard");
      return;
    }

    setDashboard(result);
  }, []);

  useEffect(() => {
    async function init() {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) {
        window.location.href = "/login";
        return;
      }

      await loadDashboard();
    }

    void init();
  }, [loadDashboard]);

  return (
    <main style={APP_SHELL} className={`${APP_SHELL_CLASS} one-eyrie-dashboard-route`}>
      <OneEyrieSidebar active="Dashboard" />

      <section style={MAIN_CONTENT} className={MAIN_CONTENT_CLASS}>
        <OneEyriePageHeader
          title="Dashboard"
          subtitle="What must be completed today?"
        />

        {error && (
          <div
            style={{
              marginBottom: "16px",
              padding: "12px 14px",
              borderRadius: "10px",
              border: "1px solid #8B5252",
              color: "#C9A8A8",
            }}
          >
            {error}
          </div>
        )}

        {loading || !dashboard ? (
          <div style={{ color: ONE_EYRIE.textMuted, padding: "24px 0" }} className="dashboard-dashboard-loading">
            Loading operational dashboard...
          </div>
        ) : (
          <div
            className="one-eyrie-dashboard-page"
            style={{ display: "flex", flexDirection: "column", gap: "16px" }}
          >
            <TodaysWorkSection
              pms={dashboard.todaysWork.pms}
              rpms={dashboard.todaysWork.rpms}
            />

            <PastDueSummaryBar pastDue={dashboard.pastDue} />

            <div
              className="dashboard-command-grid one-eyrie-split-grid"
              style={{
                display: "grid",
                gridTemplateColumns: "minmax(360px, 1.55fr) minmax(300px, 1fr)",
                gap: "16px",
                alignItems: "start",
              }}
            >
              <div className="dashboard-pass-on-panel">
                <PassOnLogSection passOnLog={dashboard.passOnLog} />
              </div>

              <div
                className="dashboard-command-sidebar"
                style={{ display: "flex", flexDirection: "column", gap: "12px" }}
              >
                <OpenWorkOrdersSection
                  workOrders={dashboard.workOrders}
                  totalCount={dashboard.openWorkOrderCount}
                />
                <LostFoundSummaryCard
                  readyToShip={dashboard.lostFound.readyToShip}
                  storedToday={dashboard.lostFound.storedToday}
                />
              </div>
            </div>
          </div>
        )}
      </section>
    </main>
  );
}
