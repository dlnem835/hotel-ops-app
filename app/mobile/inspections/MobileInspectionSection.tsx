"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { formatInspectionAgeLabel } from "@/app/inspections/lib/inspection-age";
import { PriorityQueueItem } from "@/app/inspections/lib/inspection-types";
import StartInspectionModal from "./components/StartInspectionModal";
import {
  buildFullPriorityQueue,
  defaultTemplateId,
  fetchInspectionBootstrap,
  fetchInspectionDashboard,
  filterRoomsBySearch,
  inspectionSessionUrl,
  InspectionBootstrap,
  RoomOption,
  startInspectionSession,
} from "./lib/inspection-shared";

function statusLine(item: PriorityQueueItem): string {
  return formatInspectionAgeLabel(item.neverInspected, item.lastCompletedAt);
}

type MobileInspectionSectionProps = {
  program: "VR" | "RPM";
  programLabel: string;
};

export default function MobileInspectionSection({
  program,
  programLabel,
}: MobileInspectionSectionProps) {
  const router = useRouter();
  const [bootstrap, setBootstrap] = useState<InspectionBootstrap | null>(null);
  const [priorityQueue, setPriorityQueue] = useState<PriorityQueueItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [starting, setStarting] = useState(false);
  const [pendingRoom, setPendingRoom] = useState<RoomOption | null>(null);

  useEffect(() => {
    let mounted = true;

    void fetchInspectionBootstrap()
      .then((data) => {
        if (!mounted) return;
        setBootstrap(data);
      })
      .catch((loadError) => {
        if (!mounted) return;
        setError(loadError instanceof Error ? loadError.message : "Unable to load data");
        setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (!bootstrap) return;

    let mounted = true;
    setLoading(true);
    setError(null);

    void fetchInspectionDashboard(program)
      .then((dashboard) => {
        if (!mounted) return;
        setPriorityQueue(buildFullPriorityQueue(dashboard.rooms));
        setLoading(false);
      })
      .catch((loadError) => {
        if (!mounted) return;
        setError(loadError instanceof Error ? loadError.message : "Unable to load queue");
        setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, [bootstrap, program]);

  const activeRooms = useMemo(
    () => (bootstrap?.rooms || []).filter((room) => room.status === "Active"),
    [bootstrap]
  );

  const filteredQueue = useMemo(
    () => filterRoomsBySearch(priorityQueue, search),
    [priorityQueue, search]
  );

  const resolvedDefaultTemplateId = bootstrap
    ? defaultTemplateId(bootstrap.templates, program)
    : null;

  function roomForQueueItem(item: PriorityQueueItem): RoomOption | null {
    return activeRooms.find((entry) => entry.id === item.areaId) ?? null;
  }

  function openInspectModal(room: RoomOption) {
    setPendingRoom(room);
  }

  async function handleStartInspection(templateId: number, associateId: string | null) {
    if (!bootstrap || !pendingRoom) return;

    setStarting(true);
    setError(null);

    try {
      const sessionId = await startInspectionSession({
        areaId: pendingRoom.id,
        templateId,
        inspectorId: bootstrap.inspectorId,
        associateId,
        program,
      });
      setPendingRoom(null);
      router.push(inspectionSessionUrl(sessionId));
    } catch (startError) {
      setError(startError instanceof Error ? startError.message : "Unable to start inspection");
      setStarting(false);
    }
  }

  if (!bootstrap && loading) {
    return <div className="one-eyrie-mobile-status">Loading…</div>;
  }

  return (
    <div className="one-eyrie-mobile-inspections-section">
      {error ? <div className="one-eyrie-mobile-error">{error}</div> : null}

      <section className="one-eyrie-mobile-inspections-panel">
        <div className="one-eyrie-mobile-inspections-panel__title">Priority Queue</div>
        <div className="one-eyrie-mobile-inspections-panel__subtitle">
          {programLabel} · {filteredQueue.length} of {priorityQueue.length} guest rooms · most
          overdue first
        </div>

        <input
          type="search"
          className="one-eyrie-mobile-inspections-search"
          placeholder="Search room number…"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          aria-label="Search rooms"
        />

        {loading ? (
          <div className="one-eyrie-mobile-status">Loading queue…</div>
        ) : filteredQueue.length === 0 ? (
          <div className="one-eyrie-mobile-status">
            {priorityQueue.length === 0
              ? "All guest rooms are current."
              : "No rooms match your search."}
          </div>
        ) : (
          <div className="one-eyrie-mobile-inspections-queue">
            {filteredQueue.map((item, index) => {
              const room = roomForQueueItem(item);
              if (!room) return null;

              return (
                <div key={item.areaId} className="one-eyrie-mobile-inspections-queue__row">
                  <div className="one-eyrie-mobile-inspections-queue__main">
                    <div className="one-eyrie-mobile-inspections-queue__title">
                      {index + 1}. Room {item.name}
                    </div>
                    <div className="one-eyrie-mobile-inspections-queue__meta">
                      {statusLine(item)}
                    </div>
                  </div>
                  <button
                    type="button"
                    className="one-eyrie-mobile-inspections-queue__inspect"
                    onClick={() => openInspectModal(room)}
                  >
                    Inspect
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </section>

      <StartInspectionModal
        open={Boolean(pendingRoom)}
        roomName={pendingRoom?.name || ""}
        program={program}
        templates={bootstrap?.templates || []}
        associates={bootstrap?.associates || []}
        defaultTemplateId={resolvedDefaultTemplateId}
        starting={starting}
        onClose={() => {
          if (starting) return;
          setPendingRoom(null);
        }}
        onStart={(templateId, associateId) => void handleStartInspection(templateId, associateId)}
      />
    </div>
  );
}
