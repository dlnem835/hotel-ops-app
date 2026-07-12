import { PmTile } from "@/app/maintenance/lib/maintenance-types";
import { MaintenanceDashboardPayload } from "@/app/maintenance/lib/maintenance-types";
import { tenantFetch } from "@/app/lib/tenant/tenant-fetch";
import { getClientSession } from "@/app/lib/auth";
import { supabase } from "@/app/supabaseClient";

export async function resolvePmCreatedBy(): Promise<string | null> {
  const session = await getClientSession();
  if (!session) return null;

  const { data: teamMember } = await supabase
    .from("team_members")
    .select("first_name, last_name, username")
    .eq("auth_user_id", session.user.id)
    .maybeSingle();

  if (!teamMember) return null;

  return (
    teamMember.username ||
    [teamMember.first_name, teamMember.last_name].filter(Boolean).join(" ") ||
    null
  );
}

export async function fetchPmTiles(): Promise<PmTile[]> {
  const response = await tenantFetch("/api/maintenance/dashboard");
  const result = await response.json();

  if (!response.ok) {
    throw new Error(result.error || "Unable to load PM assignments");
  }

  const payload = result as MaintenanceDashboardPayload;
  return payload.pmTiles || [];
}

export async function startPmAssignment(
  assignmentId: number,
  createdBy?: string | null
): Promise<number> {
  const response = await tenantFetch("/api/maintenance/pm-occurrences", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      assignment_id: assignmentId,
      created_by: createdBy ?? null,
    }),
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
