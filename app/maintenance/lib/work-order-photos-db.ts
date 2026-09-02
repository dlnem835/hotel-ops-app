import type { SupabaseClient } from "@supabase/supabase-js";
import type { WorkOrderPhoto } from "./maintenance-types";

export type WorkOrderPhotoRow = {
  id: number;
  work_order_id: number;
  organization_id: number;
  property_id: number;
  photo_url: string;
  storage_path: string | null;
  uploaded_by: string | null;
  uploaded_at: string;
};

export {
  isWorkOrderPhotoAddableStatus,
  WORK_ORDER_PHOTO_ACTIVE_STATUSES,
} from "./maintenance-types";


export function normalizeWorkOrderPhoto(row: WorkOrderPhotoRow): WorkOrderPhoto {
  return {
    id: Number(row.id),
    workOrderId: Number(row.work_order_id),
    photoUrl: String(row.photo_url),
    storagePath: row.storage_path ? String(row.storage_path) : null,
    uploadedBy: row.uploaded_by ? String(row.uploaded_by) : null,
    uploadedAt: String(row.uploaded_at),
  };
}

export async function fetchWorkOrderPhotos(
  supabase: SupabaseClient,
  workOrderId: number,
  scope: { organizationId: number; propertyId: number }
): Promise<WorkOrderPhoto[]> {
  const { data, error } = await supabase
    .from("work_order_photos")
    .select("*")
    .eq("work_order_id", workOrderId)
    .eq("organization_id", scope.organizationId)
    .eq("property_id", scope.propertyId)
    .order("uploaded_at", { ascending: true });

  if (error) throw new Error(error.message);
  return ((data || []) as WorkOrderPhotoRow[]).map(normalizeWorkOrderPhoto);
}

export async function insertWorkOrderPhoto(
  supabase: SupabaseClient,
  input: {
    workOrderId: number;
    photoUrl: string;
    storagePath?: string | null;
    uploadedBy?: string | null;
  },
  scope: { organizationId: number; propertyId: number }
): Promise<WorkOrderPhoto> {
  const { data, error } = await supabase
    .from("work_order_photos")
    .insert({
      work_order_id: input.workOrderId,
      organization_id: scope.organizationId,
      property_id: scope.propertyId,
      photo_url: input.photoUrl,
      storage_path: input.storagePath ?? null,
      uploaded_by: input.uploadedBy ?? null,
    })
    .select("*")
    .single();

  if (error) throw new Error(error.message);
  return normalizeWorkOrderPhoto(data as WorkOrderPhotoRow);
}
