"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import OneEyrieSidebar from "@/app/components/OneEyrieSidebar";
import OneEyriePageHeader from "@/app/components/OneEyriePageHeader";
import { ONE_EYRIE } from "@/app/lib/oneEyrieColors";
import { APP_SHELL, APP_SHELL_CLASS, MAIN_CONTENT, MAIN_CONTENT_CLASS } from "@/app/lib/oneEyrieLayout";
import { tenantFetch } from "@/app/lib/tenant/tenant-fetch";
import { OperationalDashboardPayload } from "./dashboard/lib/operational-types";
import LostFoundSummaryCard from "./dashboard/components/LostFoundSummaryCard";
import PassOnKpiSection from "./dashboard/components/PassOnKpiSection";
import DashboardWorkOrdersSection from "./dashboard/components/DashboardWorkOrdersSection";
import TodaysWorkSection from "./dashboard/components/TodaysWorkSection";
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
          subtitle="Front Desk operations at a glance"
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
            <LostFoundSummaryCard
              readyToShip={dashboard.lostFound.readyToShip}
              storedToday={dashboard.lostFound.storedToday}
            />

            <PassOnKpiSection kpis={dashboard.passOnKpis} />

            <DashboardWorkOrdersSection
              workOrders={dashboard.workOrders}
              openWorkOrderCount={dashboard.openWorkOrderCount}
            />

            <TodaysWorkSection
              pms={dashboard.todaysWork.pms}
              rpms={dashboard.todaysWork.rpms}
            />
          </div>
        )}
      </section>
    </main>
  );
}
