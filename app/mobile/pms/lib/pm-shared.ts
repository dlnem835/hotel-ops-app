import { PmTile } from "@/app/maintenance/lib/maintenance-types";
import { MaintenanceDashboardPayload } from "@/app/maintenance/lib/maintenance-types";

export async function fetchPmTiles(): Promise<PmTile[]> {
  const response = await fetch("/api/maintenance/dashboard");
  const result = await response.json();

  if (!response.ok) {
    throw new Error(result.error || "Unable to load PM assignments");
  }

  const payload = result as MaintenanceDashboardPayload;
  return payload.pmTiles || [];
}

export async function startPmAssignment(assignmentId: number): Promise<number> {
  const response = await fetch("/api/maintenance/pm-occurrences", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ assignment_id: assignmentId }),
  });
  const result = await response.json();

  if (!response.ok) {
    throw new Error(result.error || "Unable to start PM");
  }

  return Number(result.occurrence.id);
}

export function pmAreaLabel(tile: PmTile): string {
  if (tile.areaName && tile.assetLabel) {
    return `${tile.areaName} · ${tile.assetLabel}`;
  }
  return tile.areaName || tile.assetLabel || "Property-wide";
}
