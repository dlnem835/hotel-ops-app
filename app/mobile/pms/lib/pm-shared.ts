import { PmTile } from "@/app/maintenance/lib/maintenance-types";
import { MaintenanceDashboardPayload } from "@/app/maintenance/lib/maintenance-types";
import { tenantFetch } from "@/app/lib/tenant/tenant-fetch";

export async function fetchPmTiles(): Promise<PmTile[]> {
  const response = await tenantFetch("/api/maintenance/dashboard");
  const result = await response.json();

  if (!response.ok) {
    throw new Error(result.error || "Unable to load PM assignments");
  }

  const payload = result as MaintenanceDashboardPayload;
  return payload.pmTiles || [];
}

export function pmAreaLabel(tile: PmTile): string {
  if (tile.areaName && tile.assetLabel) {
    return `${tile.assetLabel} — ${tile.areaName}`;
  }
  return tile.areaName || tile.assetLabel || "Property-wide";
}
