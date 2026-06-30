import { WorkOrder } from "@/app/maintenance/lib/maintenance-types";
import { getClientSession } from "@/app/lib/auth";
import { supabase } from "@/app/supabaseClient";

export async function resolveWorkOrderCreatedBy(): Promise<string | null> {
  const session = await getClientSession();
  if (!session) return null;

  const { data: teamMember } = await supabase
    .from("team_members")
    .select("first_name, last_name, username")
    .eq("auth_user_id", session.user.id)
    .maybeSingle();

  if (!teamMember) return null;

  return (
    [teamMember.first_name, teamMember.last_name].filter(Boolean).join(" ") ||
    teamMember.username ||
    null
  );
}

export async function fetchOpenWorkOrders(): Promise<WorkOrder[]> {
  const response = await fetch("/api/work-orders?open=1");
  const result = await response.json();

  if (!response.ok) {
    throw new Error(result.error || "Unable to load work orders");
  }

  return (result.workOrders || []) as WorkOrder[];
}

export async function fetchWorkOrderById(id: number): Promise<WorkOrder | null> {
  const response = await fetch(`/api/work-orders/${id}`);
  const result = await response.json();

  if (response.status === 404) return null;

  if (!response.ok) {
    throw new Error(result.error || "Unable to load work order");
  }

  return result.workOrder as WorkOrder;
}

export async function saveWorkOrderComments(
  id: number,
  comments: string
): Promise<WorkOrder> {
  const response = await fetch(`/api/work-orders/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ comments: comments.trim() || null }),
  });
  const result = await response.json();

  if (!response.ok) {
    throw new Error(result.error || "Unable to save comments");
  }

  return result.workOrder as WorkOrder;
}

export async function completeWorkOrder(id: number): Promise<WorkOrder> {
  const response = await fetch(`/api/work-orders/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status: "Completed" }),
  });
  const result = await response.json();

  if (!response.ok) {
    throw new Error(result.error || "Unable to complete work order");
  }

  return result.workOrder as WorkOrder;
}
