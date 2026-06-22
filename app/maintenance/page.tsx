"use client";

import OneEyriePageHeader from "@/app/components/OneEyriePageHeader";
import OneEyrieSidebar from "@/app/components/OneEyrieSidebar";
import { APP_SHELL, MAIN_CONTENT } from "@/app/lib/oneEyrieLayout";
import { ONE_EYRIE } from "@/app/lib/oneEyrieColors";
import Link from "next/link";
import {
  FOREST_OUTLINE_BUTTON,
  forestOutlineHoverHandlers,
} from "@/app/lib/oneEyrieButtons";

export default function MaintenancePage() {
  return (
    <main style={APP_SHELL}>
      <OneEyrieSidebar active="Maintenance" />

      <section style={MAIN_CONTENT}>
        <OneEyriePageHeader
          title="Maintenance"
          subtitle="Preventive maintenance work queue — coming soon"
        />

        <div
          style={{
            background: ONE_EYRIE.surface,
            border: `1px solid ${ONE_EYRIE.border}`,
            borderRadius: "14px",
            padding: "28px",
            maxWidth: "640px",
          }}
        >
          <div
            style={{
              color: ONE_EYRIE.text,
              fontWeight: 800,
              fontSize: "18px",
              marginBottom: "10px",
            }}
          >
            PM Scheduler dashboard is in progress
          </div>
          <p
            style={{
              color: ONE_EYRIE.textMuted,
              fontSize: "14px",
              lineHeight: 1.55,
              margin: "0 0 18px",
            }}
          >
            Configure PM templates, area assignments, and checklists in Settings.
            The engineer work queue — Overdue, Due Today, Due This Week, and
            more — will live here next.
          </p>
          <Link
            href="/settings"
            style={{
              ...FOREST_OUTLINE_BUTTON,
              display: "inline-flex",
              textDecoration: "none",
            }}
            {...forestOutlineHoverHandlers()}
          >
            Open PM Templates in Settings
          </Link>
        </div>
      </section>
    </main>
  );
}
