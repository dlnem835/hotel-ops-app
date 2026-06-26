import { SupabaseClient } from "@supabase/supabase-js";
import { buildDashboard as buildInspectionDashboard } from "@/app/inspections/lib/inspection-db";
import { buildMaintenanceDashboard } from "@/app/maintenance/lib/maintenance-dashboard";
import {
  getLocalDateString,
  isStoredToday,
  shiftLocalDateString,
} from "./date-utils";
import {
  AttentionItem,
  OperationalDashboardPayload,
  PassOnLogEntry,
} from "./operational-types";

function normalizePassOnEntry(row: {
  id: number;
  subject: string;
  author: string;
  message: string;
  priority: string;
  entry_date: string;
}): PassOnLogEntry {
  return {
    id: Number(row.id),
    subject: String(row.subject || "Pass-on"),
    author: String(row.author || "Unknown"),
    message: String(row.message || ""),
    priority: String(row.priority || "Normal"),
    entryDate: String(row.entry_date),
  };
}

function buildNeedsAttention(input: {
  pastDuePms: number;
  urgentWorkOrders: number;
  readyToShip: number;
  vrRemaining: number;
  rpmRemaining: number;
}): AttentionItem[] {
  const items: AttentionItem[] = [];

  if (input.pastDuePms > 0) {
    items.push({
      id: "overdue-pms",
      label: `${input.pastDuePms} Overdue PM${input.pastDuePms === 1 ? "" : "s"}`,
      count: input.pastDuePms,
      href: "/maintenance",
      severity: "critical",
    });
  }

  if (input.urgentWorkOrders > 0) {
    items.push({
      id: "urgent-work-orders",
      label: `${input.urgentWorkOrders} Urgent Work Order${input.urgentWorkOrders === 1 ? "" : "s"}`,
      count: input.urgentWorkOrders,
      href: "/maintenance",
      severity: "critical",
    });
  }

  if (input.readyToShip > 0) {
    items.push({
      id: "lost-ready-to-ship",
      label: `${input.readyToShip} Lost Item${input.readyToShip === 1 ? "" : "s"} Ready to Ship`,
      count: input.readyToShip,
      href: "/lost-and-found",
      severity: "warning",
    });
  }

  if (input.vrRemaining > 0) {
    items.push({
      id: "vr-remaining",
      label: `${input.vrRemaining} VR Inspection${input.vrRemaining === 1 ? "" : "s"} Remaining`,
      count: input.vrRemaining,
      href: "/inspections",
      severity: "warning",
    });
  }

  if (input.rpmRemaining > 0) {
    items.push({
      id: "rpm-remaining",
      label: `${input.rpmRemaining} RPM Inspection${input.rpmRemaining === 1 ? "" : "s"} Remaining`,
      count: input.rpmRemaining,
      href: "/inspections?program=rpm",
      severity: "warning",
    });
  }

  return items;
}

export async function buildOperationalDashboard(
  supabase: SupabaseClient
): Promise<OperationalDashboardPayload> {
  const today = getLocalDateString();
  const yesterday = shiftLocalDateString(new Date(), -1);
  const tomorrow = shiftLocalDateString(new Date(), 1);

  const [maintenance, inspectionVr, inspectionRpm, passOnResult, lostItemsResult] =
    await Promise.all([
      buildMaintenanceDashboard(supabase),
      buildInspectionDashboard(supabase, "mtd", "vr"),
      buildInspectionDashboard(supabase, "mtd", "rpm"),
      supabase
        .from("pass_on_log")
        .select("id, subject, author, message, priority, entry_date")
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

  const passOnEntries = (passOnResult.data || []).map(normalizePassOnEntry);
  const passOnLog = {
    today: passOnEntries.filter((entry) => entry.entryDate === today),
    yesterday: passOnEntries.filter((entry) => entry.entryDate === yesterday),
    tomorrow: passOnEntries.filter((entry) => entry.entryDate === tomorrow),
  };

  const lostItems = lostItemsResult.data || [];
  const readyToShip = lostItems.filter(
    (item) => item.status === "Ready to be shipped"
  ).length;
  const storedToday = lostItems.filter(
    (item) =>
      item.status === "Stored" && isStoredToday(item.created_at ? String(item.created_at) : null, today)
  ).length;

  const urgentWorkOrders = maintenance.workOrders.filter(
    (order) => order.priority === "Urgent"
  ).length;

  return {
    needsAttention: buildNeedsAttention({
      pastDuePms: maintenance.metrics.pastDuePms,
      urgentWorkOrders,
      readyToShip,
      vrRemaining: inspectionVr.metrics.remaining,
      rpmRemaining: inspectionRpm.metrics.remaining,
    }),
    passOnLog,
    workOrders: maintenance.workOrders.slice(0, 6).map((order) => ({
      id: order.id,
      subject: order.subject,
      priority: order.priority,
      areaLabel: order.areaLabel,
    })),
    openWorkOrderCount: maintenance.workOrders.length,
    lostFound: {
      readyToShip,
      storedToday,
    },
  };
}
