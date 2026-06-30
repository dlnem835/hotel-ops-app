import { SupabaseClient } from "@supabase/supabase-js";
import {
  WorkOrder,
  WorkOrderInput,
  WorkOrderPriority,
} from "./maintenance-types";
import { WorkOrderCategory } from "./work-order-categories";
import { WORK_ORDER_PRIORITY_ORDER } from "@/app/lib/workOrderPriority";
import { isGuestImpactingWorkOrder } from "./work-order-display";

export type WorkOrderRow = {
  id: number;
  subject: string;
  description: string | null;
  priority: string;
  status: string;
  area_id: number | null;
  area_label: string | null;
  source_module: string | null;
  source_record_id: string | null;
  source_note: string | null;
  comments: string | null;
  photo_url: string | null;
  category: string | null;
  item: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
};

export function normalizeWorkOrder(row: WorkOrderRow): WorkOrder {
  return {
    id: Number(row.id),
    subject: String(row.subject),
    description: row.description ? String(row.description) : null,
    priority: row.priority as WorkOrderPriority,
    status: row.status as WorkOrder["status"],
    areaId: row.area_id ? Number(row.area_id) : null,
    areaLabel: row.area_label ? String(row.area_label) : null,
    sourceModule: row.source_module ? String(row.source_module) : null,
    sourceRecordId: row.source_record_id ? String(row.source_record_id) : null,
    sourceNote: row.source_note ? String(row.source_note) : null,
    comments: row.comments ? String(row.comments) : null,
    photoUrl: row.photo_url ? String(row.photo_url) : null,
    category: row.category ? (row.category as WorkOrderCategory) : null,
    item: row.item ? String(row.item) : null,
    createdBy: row.created_by ? String(row.created_by) : null,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
    completedAt: row.completed_at ? String(row.completed_at) : null,
  };
}

export function sortWorkOrdersByPriority(orders: WorkOrder[]): WorkOrder[] {
  return [...orders].sort((a, b) => {
    const guestDiff =
      Number(isGuestImpactingWorkOrder(b)) - Number(isGuestImpactingWorkOrder(a));
    if (guestDiff !== 0) return guestDiff;

    const priorityDiff =
      WORK_ORDER_PRIORITY_ORDER[a.priority] - WORK_ORDER_PRIORITY_ORDER[b.priority];
    if (priorityDiff !== 0) return priorityDiff;
    return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
  });
}

export async function fetchWorkOrders(
  supabase: SupabaseClient,
  options?: { status?: string[] }
): Promise<WorkOrder[]> {
  let query = supabase.from("work_orders").select("*").order("created_at", {
    ascending: false,
  });

  if (options?.status?.length) {
    query = query.in("status", options.status);
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);

  return sortWorkOrdersByPriority(
    ((data || []) as WorkOrderRow[]).map(normalizeWorkOrder)
  );
}

export async function createWorkOrder(
  supabase: SupabaseClient,
  input: WorkOrderInput
): Promise<WorkOrder> {
  const { data, error } = await supabase
    .from("work_orders")
    .insert({
      subject: input.subject,
      description: input.description ?? null,
      priority: input.priority ?? "Normal",
      status: input.status ?? "Open",
      area_id: input.area_id ?? null,
      area_label: input.area_label ?? null,
      source_module: input.source_module ?? null,
      source_record_id: input.source_record_id ?? null,
      source_note: input.source_note ?? null,
      photo_url: input.photo_url ?? null,
      category: input.category ?? null,
      item: input.item?.trim() || null,
      created_by: input.created_by ?? null,
    })
    .select("*")
    .single();

  if (error) throw new Error(error.message);
  return normalizeWorkOrder(data as WorkOrderRow);
}

export async function updateWorkOrder(
  supabase: SupabaseClient,
  id: number,
  patch: Partial<WorkOrderInput> & { status?: WorkOrder["status"] }
): Promise<WorkOrder> {
  const payload: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };

  if (patch.subject !== undefined) payload.subject = patch.subject;
  if (patch.description !== undefined) payload.description = patch.description;
  if (patch.priority !== undefined) payload.priority = patch.priority;
  if (patch.status !== undefined) {
    payload.status = patch.status;
    if (patch.status === "Completed") {
      payload.completed_at = new Date().toISOString();
    }
  }
  if (patch.area_id !== undefined) payload.area_id = patch.area_id;
  if (patch.area_label !== undefined) payload.area_label = patch.area_label;
  if (patch.comments !== undefined) payload.comments = patch.comments;
  if (patch.photo_url !== undefined) payload.photo_url = patch.photo_url;

  const { data, error } = await supabase
    .from("work_orders")
    .update(payload)
    .eq("id", id)
    .select("*")
    .single();

  if (error) throw new Error(error.message);
  return normalizeWorkOrder(data as WorkOrderRow);
}

export async function fetchWorkOrderById(
  supabase: SupabaseClient,
  id: number
): Promise<WorkOrder | null> {
  const { data, error } = await supabase
    .from("work_orders")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) return null;
  return normalizeWorkOrder(data as WorkOrderRow);
}
