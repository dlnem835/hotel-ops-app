"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  mapInspectionAssociateOptions,
  type TeamMemberForAssociate,
} from "./lib/inspection-associates";
import { useRouter } from "next/navigation";
import { createClient } from "@supabase/supabase-js";
import OneEyrieSidebar from "@/app/components/OneEyrieSidebar";
import OneEyriePageHeader from "@/app/components/OneEyriePageHeader";
import { ONE_EYRIE } from "@/app/lib/oneEyrieColors";
import { APP_SHELL, APP_SHELL_CLASS, MAIN_CONTENT, MAIN_CONTENT_CLASS } from "@/app/lib/oneEyrieLayout";
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
import StartInspectionModal from "./components/StartInspectionModal";
import {
  RoomOption,
  TemplateOption,
} from "./components/StartInspectionPanel";
import AssociateRankingsPanel from "./components/AssociateRankingsPanel";
import TopInspectorsPanel from "./components/TopInspectorsPanel";
import RoomHistoryDrawer from "./components/RoomHistoryDrawer";
import InspectionMtdMonthSelector from "./components/InspectionMtdMonthSelector";
import { formatMonthYearLabel } from "./lib/period-utils";
import "./inspections-responsive.css";
import "./components/start-inspection-modal.css";
import "./components/inspections-mtd-month-selector.css";
import { templateMatchesDashboard } from "./lib/program-map";
import { resolveDefaultTemplateForDashboard } from "./lib/default-template";
import {
  goldHoverHandlers,
  SETTINGS_BUTTON_BASE,
} from "@/app/settings/lib/settings-ui-interactions";
import { tenantFetch } from "@/app/lib/tenant/tenant-fetch";

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
  const initialNow = useMemo(() => new Date(), []);
  const [period, setPeriod] = useState<InspectionPeriod>("mtd");
  const [mtdYear, setMtdYear] = useState(initialNow.getFullYear());
  const [mtdMonth, setMtdMonth] = useState(initialNow.getMonth());
  const [program, setProgram] = useState<"VR" | "RPM">("VR");
  const [dashboard, setDashboard] = useState<DashboardPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [templates, setTemplates] = useState<TemplateOption[]>([]);
  const [rooms, setRooms] = useState<RoomOption[]>([]);
  const [teamMembers, setTeamMembers] = useState<TeamMemberForAssociate[]>([]);
  const [inspectorId, setInspectorId] = useState<string | null>(null);

  const [selectedRoomId, setSelectedRoomId] = useState<number | null>(null);
  const [selectedTemplateId, setSelectedTemplateId] = useState<number | null>(null);
  const [selectedAssociateId, setSelectedAssociateId] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  const [startModalOpen, setStartModalOpen] = useState(false);
  const [preloadedFromQueue, setPreloadedFromQueue] = useState(false);

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

    const periodParam = params.get("period")?.toLowerCase();
    if (
      periodParam === "today" ||
      periodParam === "wtd" ||
      periodParam === "mtd" ||
      periodParam === "qtd" ||
      periodParam === "ytd"
    ) {
      setPeriod(periodParam);
    }
  }, []);

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    setError(null);
    const params = new URLSearchParams({
      period,
      program: program.toLowerCase(),
    });
    if (period === "mtd") {
      params.set("month", String(mtdMonth + 1));
      params.set("year", String(mtdYear));
    }
    const response = await tenantFetch(`/api/inspections/dashboard?${params}`);
    const result = await response.json();
    setLoading(false);

    if (!response.ok) {
      setError(result.error || "Unable to load dashboard");
      return;
    }

    setDashboard(result);
  }, [period, program, mtdMonth, mtdYear]);

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
        tenantFetch("/api/inspections/sessions"),
        tenantFetch("/api/buildings-areas"),
        supabase
          .from("team_members")
          .select("id, first_name, last_name, username, job_title, role, status"),
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

      setTeamMembers((membersRes.data || []) as TeamMemberForAssociate[]);
    }

    void init();
  }, []);

  useEffect(() => {
    void loadDashboard();
  }, [loadDashboard]);

  const associates = useMemo(
    () => mapInspectionAssociateOptions(teamMembers, program),
    [teamMembers, program]
  );

  useEffect(() => {
    setSelectedAssociateId((current) =>
      current && associates.some((associate) => associate.id === current)
        ? current
        : null
    );
  }, [associates]);

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

  function openStartModal(areaId?: number, fromQueue = false) {
    if (areaId !== undefined) {
      setSelectedRoomId(areaId);
    } else {
      setSelectedRoomId(null);
      setSelectedAssociateId(null);
    }

    const templateId = resolveDefaultTemplateForDashboard(templates, program);
    if (templateId) {
      setSelectedTemplateId(templateId);
    }

    setPreloadedFromQueue(fromQueue && areaId !== undefined);
    setStartModalOpen(true);
  }

  function handlePriorityInspect(areaId: number) {
    openStartModal(areaId, true);
  }

  function closeStartModal() {
    if (starting) return;
    setStartModalOpen(false);
    setPreloadedFromQueue(false);
  }

  async function openRoomHistory(room: RoomGridTile) {
    setHistoryRoom(room);
    setHistoryOpen(true);
    setHistoryLoading(true);
    const response = await tenantFetch(`/api/inspections/rooms/${room.areaId}/history`);
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
    const response = await tenantFetch("/api/inspections/sessions", {
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

    setStartModalOpen(false);
    setPreloadedFromQueue(false);
    router.push(`/inspections/session/${result.session.id}`);
  }

  const periodContextLabel =
    period === "mtd"
      ? `MTD · ${formatMonthYearLabel(mtdYear, mtdMonth)}`
      : PERIOD_LABELS[period];

  return (
    <main style={APP_SHELL} className={APP_SHELL_CLASS}>
      <OneEyrieSidebar active="Inspections" />

      <section
        className={`inspections-mobile-page-content ${MAIN_CONTENT_CLASS}`}
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
              className="inspections-mobile-dashboard-grid one-eyrie-split-grid"
              style={{
                display: "grid",
                gridTemplateColumns: "minmax(360px, 1.7fr) minmax(300px, 1fr)",
                gap: "16px",
                alignItems: "start",
              }}
            >
              <div>
                {period === "mtd" ? (
                  <InspectionMtdMonthSelector
                    year={mtdYear}
                    month={mtdMonth}
                    onChange={(year, month) => {
                      setMtdYear(year);
                      setMtdMonth(month);
                    }}
                  />
                ) : null}
                <div
                  style={{
                    color: ONE_EYRIE.gold,
                    fontWeight: 800,
                    fontSize: "15px",
                    marginBottom: "10px",
                  }}
                >
                  Guest Room Grid · {periodContextLabel} · {program === "VR" ? "VR / SO" : "RPM"}
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
                    periodLabel={periodContextLabel}
                  />
                  <TopInspectorsPanel
                    inspectors={dashboard.topInspectors}
                    periodLabel={periodContextLabel}
                  />
                </div>
              </div>

              <div
                className="inspections-mobile-dashboard-sidebar"
                style={{ display: "flex", flexDirection: "column", gap: "12px" }}
              >
                <button
                  type="button"
                  className="inspections-start-btn inspections-desktop-start-btn"
                  onClick={() => openStartModal()}
                >
                  Start Inspection
                </button>
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
            openStartModal(areaId, true);
          }}
        />

        <StartInspectionModal
          open={startModalOpen}
          program={program}
          rooms={rooms}
          templates={templates}
          associates={associates}
          selectedRoomId={selectedRoomId}
          selectedTemplateId={effectiveTemplateId}
          selectedAssociateId={selectedAssociateId}
          preloadedFromQueue={preloadedFromQueue}
          onRoomChange={(id) => {
            setSelectedRoomId(id);
            if (id !== null) {
              setPreloadedFromQueue(false);
            }
          }}
          onTemplateChange={setSelectedTemplateId}
          onAssociateChange={setSelectedAssociateId}
          starting={starting}
          onClose={closeStartModal}
          onStart={() => void startInspection()}
        />
      </section>
    </main>
  );
}
