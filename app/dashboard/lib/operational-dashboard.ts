import { SupabaseClient } from "@supabase/supabase-js";
import { buildDashboard as buildInspectionDashboard } from "@/app/inspections/lib/inspection-db";
import { fetchMemberDisplayNameResolver } from "@/app/lib/member-display-name";
import { RoomGridTile } from "@/app/inspections/lib/inspection-types";
import { buildMaintenanceDashboard } from "@/app/maintenance/lib/maintenance-dashboard";
import { PmTile } from "@/app/maintenance/lib/maintenance-types";
import {
  groupPassOnEntriesForDashboard,
  passOnDashboardDateKeys,
} from "@/app/lib/hotel-business-date";
import { isStoredToday } from "./date-utils";
import {
  OperationalDashboardPayload,
  PassOnLogEntry,
} from "./operational-types";

function normalizePassOnEntry(
  row: {
    id: number;
    subject: string;
    author: string;
    message: string;
    priority: string;
    entry_date: string;
    created_at: string;
    edited_at?: string | null;
  },
  resolveAuthor: (author: string) => string
): PassOnLogEntry {
  return {
    id: Number(row.id),
    subject: String(row.subject || "Pass-on"),
    author: resolveAuthor(String(row.author || "Unknown")),
    message: String(row.message || ""),
    priority: String(row.priority || "Normal"),
    entryDate: String(row.entry_date),
    createdAt: String(row.created_at || ""),
    editedAt: row.edited_at ?? null,
  };
}

function formatPmDueTodayLabel(tile: PmTile): string {
  if (tile.areaName) {
    return `${tile.areaName} – ${tile.templateName}`;
  }
  if (tile.assetLabel) {
    return `${tile.assetLabel} – ${tile.templateName}`;
  }
  return tile.templateName;
}

function countPastDueInspectionRooms(rooms: RoomGridTile[]): number {
  return rooms.filter(
    (room) =>
      room.neverInspectedForProgram ||
      (room.neverInspectedInPeriod && Boolean(room.operationalLastCompletedAt))
  ).length;
}

export async function buildOperationalDashboard(
  supabase: SupabaseClient
): Promise<OperationalDashboardPayload> {
  const [today, yesterday, tomorrow] = passOnDashboardDateKeys();

  const [
    maintenance,
    inspectionRpmToday,
    inspectionVrMtd,
    inspectionRpmMtd,
    passOnResult,
    lostItemsResult,
  ] = await Promise.all([
    buildMaintenanceDashboard(supabase),
    buildInspectionDashboard(supabase, "today", "rpm"),
    buildInspectionDashboard(supabase, "mtd", "vr"),
    buildInspectionDashboard(supabase, "mtd", "rpm"),
    supabase
      .from("pass_on_log")
      .select("id, subject, author, message, priority, entry_date, created_at, edited_at")
      .in("entry_date", [today, yesterday, tomorrow])
      .order("entry_date", { ascending: false })
      .order("created_at", { ascending: false }),
    supabase.from("lost_items").select("id, status, created_at"),
  ]);

  if (passOnResult.error) {
    throw new Error(passOnResult.error.message);
  }

  if (lostItemsResult.error) {
    throw new Error(lostItemsResult.error.message);
  }

  const memberResolver = await fetchMemberDisplayNameResolver(supabase);
  const resolveAuthor = (author: string) =>
    memberResolver.resolveStoredValue(author) || author || "Unknown";

  const passOnEntries = (passOnResult.data || []).map((row) =>
    normalizePassOnEntry(row, resolveAuthor)
  );
  const passOnLog = groupPassOnEntriesForDashboard(passOnEntries);

  const lostItems = lostItemsResult.data || [];
  const readyToShip = lostItems.filter(
    (item) => item.status === "Ready to be shipped"
  ).length;
  const storedToday = lostItems.filter(
    (item) =>
      item.status === "Stored" &&
      isStoredToday(item.created_at ? String(item.created_at) : null, today)
  ).length;

  const nextPmDueToday = maintenance.pmTiles.find(
    (tile) => tile.urgency === "due_today"
  );
  const nextRpm = inspectionRpmToday.priorityQueue[0];

  return {
    todaysWork: {
      pms: {
        label: nextPmDueToday ? formatPmDueTodayLabel(nextPmDueToday) : null,
        href: "/maintenance?filter=due_today",
      },
      rpms: {
        label: nextRpm ? `Room ${nextRpm.name}` : null,
        href: "/inspections?period=today&program=rpm",
      },
    },
    pastDue: {
      pms: maintenance.metrics.pastDuePms,
      vrInspections: countPastDueInspectionRooms(inspectionVrMtd.rooms),
      rpmInspections: countPastDueInspectionRooms(inspectionRpmMtd.rooms),
      hrefs: {
        pms: "/maintenance?filter=past_due",
        vrInspections: "/inspections?period=mtd&program=vr",
        rpmInspections: "/inspections?period=mtd&program=rpm",
      },
    },
    passOnLog,
    workOrders: maintenance.workOrders.slice(0, 6).map((order) => ({
      id: order.id,
      subject: order.subject,
      priority: order.priority,
      areaLabel: order.areaLabel,
      createdAt: order.createdAt,
      commentsUpdatedAt: order.commentsUpdatedAt,
    })),
    openWorkOrderCount: maintenance.workOrders.length,
    lostFound: {
      readyToShip,
      storedToday,
    },
  };
}
