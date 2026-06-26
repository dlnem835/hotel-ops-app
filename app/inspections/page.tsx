"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@supabase/supabase-js";
import OneEyrieSidebar from "@/app/components/OneEyrieSidebar";
import OneEyriePageHeader from "@/app/components/OneEyriePageHeader";
import { ONE_EYRIE } from "@/app/lib/oneEyrieColors";
import { APP_SHELL, MAIN_CONTENT } from "@/app/lib/oneEyrieLayout";
import {
  DashboardPayload,
  InspectionPeriod,
  RoomGridTile,
  RoomHistoryEntry,
} from "./lib/inspection-types";
import { INSPECTION_PERIODS } from "./lib/inspection-types";
import InspectionMetricCards from "./components/InspectionMetricCards";
import InspectionRoomGrid from "./components/InspectionRoomGrid";
import PriorityQueuePanel from "./components/PriorityQueuePanel";
import StartInspectionPanel, {
  AssociateOption,
  RoomOption,
  TemplateOption,
} from "./components/StartInspectionPanel";
import AssociateRankingsPanel from "./components/AssociateRankingsPanel";
import TopInspectorsPanel from "./components/TopInspectorsPanel";
import RoomHistoryDrawer from "./components/RoomHistoryDrawer";
import "./inspections-responsive.css";
import { templateMatchesDashboard } from "./lib/program-map";
import { resolveDefaultTemplateForDashboard } from "./lib/default-template";
import {
  goldHoverHandlers,
  SETTINGS_BUTTON_BASE,
} from "@/app/settings/lib/settings-ui-interactions";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const PERIOD_LABELS: Record<InspectionPeriod, string> = {
  today: "Today",
  wtd: "WTD",
  mtd: "MTD",
  qtd: "QTD",
  ytd: "YTD",
};

export default function InspectionsPage() {
  const router = useRouter();
  const [period, setPeriod] = useState<InspectionPeriod>("mtd");
  const [program, setProgram] = useState<"VR" | "RPM">("VR");
  const [dashboard, setDashboard] = useState<DashboardPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [templates, setTemplates] = useState<TemplateOption[]>([]);
  const [rooms, setRooms] = useState<RoomOption[]>([]);
  const [associates, setAssociates] = useState<AssociateOption[]>([]);
  const [inspectorId, setInspectorId] = useState<string | null>(null);

  const [selectedRoomId, setSelectedRoomId] = useState<number | null>(null);
  const [selectedTemplateId, setSelectedTemplateId] = useState<number | null>(null);
  const [selectedAssociateId, setSelectedAssociateId] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  const [startPanelHighlighted, setStartPanelHighlighted] = useState(false);
  const highlightTimeoutRef = useRef<number | null>(null);

  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyRoom, setHistoryRoom] = useState<RoomGridTile | null>(null);
  const [history, setHistory] = useState<RoomHistoryEntry[]>([]);
  const [historyHasMore, setHistoryHasMore] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const programParam = params.get("program")?.toUpperCase();
    if (programParam === "RPM") {
      setProgram("RPM");
    }
  }, []);

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    setError(null);
    const response = await fetch(
      `/api/inspections/dashboard?period=${period}&program=${program.toLowerCase()}`
    );
    const result = await response.json();
    setLoading(false);

    if (!response.ok) {
      setError(result.error || "Unable to load dashboard");
      return;
    }

    setDashboard(result);
  }, [period, program]);

  useEffect(() => {
    async function init() {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) {
        window.location.href = "/login";
        return;
      }

      const { data: teamMember } = await supabase
        .from("team_members")
        .select("id")
        .eq("auth_user_id", session.user.id)
        .maybeSingle();

      if (teamMember) {
        setInspectorId(String(teamMember.id));
      }

      const [templatesRes, areasRes, membersRes] = await Promise.all([
        fetch("/api/inspections/sessions"),
        fetch("/api/buildings-areas"),
        supabase.from("team_members").select("id, first_name, last_name, username"),
      ]);

      const templatesJson = await templatesRes.json();
      if (templatesRes.ok) {
        setTemplates(templatesJson.templates || []);
      }

      const areasJson = await areasRes.json();
      if (areasRes.ok) {
        setRooms(
          (areasJson.areas || [])
            .filter((area: { area_type: string }) => area.area_type === "Guest Room")
            .map((area: { id: number; name: string; status: string }) => ({
              id: Number(area.id),
              name: String(area.name),
              status: String(area.status),
            }))
        );
      }

      setAssociates(
        (membersRes.data || []).map(
          (member: {
            id: number;
            first_name?: string;
            last_name?: string;
            username?: string;
          }) => ({
            id: String(member.id),
            name:
              member.username ||
              `${member.first_name || ""} ${member.last_name || ""}`.trim() ||
              "Unknown",
          })
        )
      );
    }

    void init();
  }, []);

  useEffect(() => {
    void loadDashboard();
  }, [loadDashboard]);

  const matchingTemplates = useMemo(
    () =>
      templates.filter((template) =>
        templateMatchesDashboard(template.inspection_program as never, program)
      ),
    [templates, program]
  );

  const defaultTemplateId = useMemo(
    () => resolveDefaultTemplateForDashboard(templates, program),
    [templates, program]
  );

  const effectiveTemplateId = useMemo(() => {
    if (
      selectedTemplateId &&
      matchingTemplates.some((template) => template.id === selectedTemplateId)
    ) {
      return selectedTemplateId;
    }
    return defaultTemplateId ?? matchingTemplates[0]?.id ?? null;
  }, [selectedTemplateId, matchingTemplates, defaultTemplateId]);

  useEffect(() => {
    setSelectedTemplateId((current) => {
      if (current && matchingTemplates.some((template) => template.id === current)) {
        return current;
      }
      return defaultTemplateId ?? matchingTemplates[0]?.id ?? null;
    });
  }, [program, matchingTemplates, defaultTemplateId]);

  function handlePriorityInspect(areaId: number) {
    setSelectedRoomId(areaId);

    const templateId = resolveDefaultTemplateForDashboard(templates, program);
    if (templateId) {
      setSelectedTemplateId(templateId);
    }

    setStartPanelHighlighted(true);

    if (highlightTimeoutRef.current !== null) {
      window.clearTimeout(highlightTimeoutRef.current);
    }

    highlightTimeoutRef.current = window.setTimeout(() => {
      setStartPanelHighlighted(false);
      highlightTimeoutRef.current = null;
    }, 3000);

    window.requestAnimationFrame(() => {
      document
        .getElementById("start-inspection-panel")
        ?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    });
  }

  useEffect(() => {
    return () => {
      if (highlightTimeoutRef.current !== null) {
        window.clearTimeout(highlightTimeoutRef.current);
      }
    };
  }, []);

  async function openRoomHistory(room: RoomGridTile) {
    setHistoryRoom(room);
    setHistoryOpen(true);
    setHistoryLoading(true);
    const response = await fetch(`/api/inspections/rooms/${room.areaId}/history`);
    const result = await response.json();
    setHistoryLoading(false);
    if (response.ok) {
      setHistory(result.history || []);
      setHistoryHasMore(Boolean(result.hasMore));
    } else {
      setHistory([]);
      setHistoryHasMore(false);
    }
  }

  useEffect(() => {
    if (!dashboard || historyOpen || typeof window === "undefined") {
      return;
    }

    const params = new URLSearchParams(window.location.search);
    const historyRoomId = params.get("historyRoom");
    if (!historyRoomId) {
      return;
    }

    const room = dashboard.rooms.find(
      (entry) => String(entry.areaId) === historyRoomId
    );
    if (!room) {
      return;
    }

    void openRoomHistory(room);
    window.history.replaceState({}, "", "/inspections");
  }, [dashboard, historyOpen]);

  async function startInspection(areaId?: number) {
    const roomId = areaId ?? selectedRoomId;
    const templateId = effectiveTemplateId;

    if (!roomId || !templateId) {
      alert("Select a room and inspection template.");
      return;
    }

    setStarting(true);
    const response = await fetch("/api/inspections/sessions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        areaId: roomId,
        templateId,
        inspectorId,
        associateId: selectedAssociateId,
        program: program.toLowerCase(),
      }),
    });
    const result = await response.json();
    setStarting(false);

    if (!response.ok) {
      alert(result.error || "Unable to start inspection");
      return;
    }

    router.push(`/inspections/session/${result.session.id}`);
  }

  return (
    <main style={APP_SHELL}>
      <OneEyrieSidebar active="Inspections" />

      <section
        className="inspections-mobile-page-content"
        style={MAIN_CONTENT}
      >
        <OneEyriePageHeader
          title="Inspections"
          subtitle="Coverage snapshot and priority-driven inspection workflow"
          titleClassName="inspections-mobile-page-title"
        />

        <div
          className="inspections-mobile-filter-row"
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
                onClick={() => setPeriod(entry)}
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

          <div
            className="inspections-mobile-program-toggle"
            style={{ marginLeft: "auto", display: "flex", gap: "8px" }}
          >
            {(["VR", "RPM"] as const).map((entry) => (
              <button
                key={entry}
                type="button"
                onClick={() => setProgram(entry)}
                style={{
                  ...SETTINGS_BUTTON_BASE,
                  background: program === entry ? "#1C3428" : "transparent",
                  color: program === entry ? "#B8D4C4" : ONE_EYRIE.text,
                  border: `1px solid ${program === entry ? "#3D6B4F" : ONE_EYRIE.border}`,
                  borderRadius: "10px",
                  padding: "8px 14px",
                  fontWeight: 800,
                  fontSize: "13px",
                }}
              >
                {entry === "VR" ? "VR / SO" : "RPM"}
              </button>
            ))}
          </div>
        </div>

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
            {error.includes("inspection_sessions") && (
              <div style={{ marginTop: "8px", fontSize: "13px", color: ONE_EYRIE.textMuted }}>
                Run migrations 004 and 005 in Supabase SQL Editor, then refresh.
              </div>
            )}
          </div>
        )}

        {loading || !dashboard ? (
          <div style={{ color: ONE_EYRIE.textMuted, padding: "24px 0" }}>
            Loading inspection dashboard...
          </div>
        ) : (
          <>
            <InspectionMetricCards metrics={dashboard.metrics} program={program} />

            <div
              className="inspections-mobile-dashboard-grid"
              style={{
                display: "grid",
                gridTemplateColumns: "minmax(0, 1.7fr) minmax(320px, 1fr)",
                gap: "16px",
                alignItems: "start",
              }}
            >
              <div>
                <div
                  style={{
                    color: ONE_EYRIE.gold,
                    fontWeight: 800,
                    fontSize: "15px",
                    marginBottom: "10px",
                  }}
                >
                  Guest Room Grid · {PERIOD_LABELS[period]} · {program === "VR" ? "VR / SO" : "RPM"}
                </div>
                <InspectionRoomGrid
                  rooms={dashboard.rooms}
                  onViewHistory={openRoomHistory}
                />
                <div
                  className="inspections-mobile-rankings-row"
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
                    gap: "12px",
                    marginTop: "14px",
                  }}
                >
                  <AssociateRankingsPanel
                    rankings={dashboard.housekeeperRankings}
                    program={program}
                    periodLabel={PERIOD_LABELS[period]}
                  />
                  <TopInspectorsPanel
                    inspectors={dashboard.topInspectors}
                    periodLabel={PERIOD_LABELS[period]}
                  />
                </div>
              </div>

              <div
                className="inspections-mobile-dashboard-sidebar"
                style={{ display: "flex", flexDirection: "column", gap: "12px" }}
              >
                <StartInspectionPanel
                  program={program}
                  rooms={rooms}
                  templates={templates}
                  associates={associates}
                  selectedRoomId={selectedRoomId}
                  selectedTemplateId={effectiveTemplateId}
                  selectedAssociateId={selectedAssociateId}
                  highlighted={startPanelHighlighted}
                  onRoomChange={setSelectedRoomId}
                  onTemplateChange={setSelectedTemplateId}
                  onAssociateChange={setSelectedAssociateId}
                  onStart={() => void startInspection()}
                  starting={starting}
                />
                <PriorityQueuePanel
                  items={dashboard.priorityQueue}
                  program={program}
                  onInspectRoom={handlePriorityInspect}
                />
              </div>
            </div>
          </>
        )}

        <RoomHistoryDrawer
          open={historyOpen}
          room={historyRoom}
          history={history}
          hasMore={historyHasMore}
          loading={historyLoading}
          onClose={() => setHistoryOpen(false)}
          onStartInspection={(areaId) => {
            setHistoryOpen(false);
            handlePriorityInspect(areaId);
          }}
        />
      </section>
    </main>
  );
}
