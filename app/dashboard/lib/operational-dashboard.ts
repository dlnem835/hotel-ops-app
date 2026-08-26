import { SupabaseClient } from "@supabase/supabase-js";
import { buildDashboard as buildInspectionDashboard } from "@/app/inspections/lib/inspection-db";
import { buildMaintenanceDashboard } from "@/app/maintenance/lib/maintenance-dashboard";
import { PmTile } from "@/app/maintenance/lib/maintenance-types";
import { getHotelBusinessDateString } from "@/app/lib/hotel-business-date";
import {
  getPassOnReadBaseline,
  listPassOnEntries,
} from "@/app/pass-on-log/lib/pass-on-server-db";
import { countPassOnKpisForUser } from "@/app/pass-on-log/lib/pass-on-kpi";
import { isStoredToday } from "./date-utils";
import { OperationalDashboardPayload } from "./operational-types";

function formatPmDueTodayLabel(tile: PmTile): string {
  if (tile.areaName) {
    return `${tile.areaName} – ${tile.templateName}`;
  }
  if (tile.assetLabel) {
    return `${tile.assetLabel} – ${tile.templateName}`;
  }
  return tile.templateName;
}

export async function buildOperationalDashboard(
  supabase: SupabaseClient,
  scope: { organizationId: number; propertyId: number },
  authUserId: string
): Promise<OperationalDashboardPayload> {
  const today = getHotelBusinessDateString();

  const [maintenance, inspectionRpmToday, passOnEntries, readBaseline, lostItemsResult] =
    await Promise.all([
      buildMaintenanceDashboard(supabase, scope),
      buildInspectionDashboard(supabase, "today", "rpm", null, null, scope),
      listPassOnEntries(supabase, scope),
      getPassOnReadBaseline(supabase, authUserId, scope.propertyId),
      (() => {
        let query = supabase.from("lost_items").select("id, status, created_at");
        query = query
          .eq("organization_id", scope.organizationId)
          .eq("property_id", scope.propertyId);
        return query;
      })(),
    ]);

  if (lostItemsResult.error) {
    throw new Error(lostItemsResult.error.message);
  }

  const passOnKpiCounts = countPassOnKpisForUser(
    passOnEntries,
    authUserId,
    readBaseline
  );

  const lostItems = lostItemsResult.data || [];
  const readyToShip = lostItems.filter(
    (item) =>
      item.status === "Ready to Ship" || item.status === "Ready to be shipped"
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
    passOnKpis: {
      newEntries: passOnKpiCounts.newEntries,
      unread: passOnKpiCounts.unread,
      newReplies: passOnKpiCounts.newReplies,
      hrefs: {
        newEntries: "/pass-on-log?focus=new",
        unread: "/pass-on-log?focus=unread",
        newReplies: "/pass-on-log?focus=new-replies",
      },
    },
    workOrders: maintenance.workOrders,
    openWorkOrderCount: maintenance.workOrders.length,
    lostFound: {
      readyToShip,
      storedToday,
    },
  };
}
