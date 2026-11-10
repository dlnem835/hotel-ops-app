import type { SupabaseClient } from "@supabase/supabase-js";
import {
  parseOperationalPhotoRef,
  requireCanonicalOperationalPhotoForWrite,
} from "@/app/lib/storage/server/operational-photo-access";
import { TenantRequestError } from "@/app/lib/tenant/server/resolve-tenant-request";
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
  const canonicalUrl = requireCanonicalOperationalPhotoForWrite(
    input.photoUrl,
    scope,
    {
      defaultBucket: "work-order-photos",
      existingRefs: [],
      fieldName: "photo_url",
    }
  );
  if (!canonicalUrl) {
    throw new TenantRequestError(400, "Invalid photo_url reference.");
  }

  const parsedPhoto = parseOperationalPhotoRef(canonicalUrl, {
    defaultBucket: "work-order-photos",
  });
  if (!parsedPhoto) {
    throw new TenantRequestError(400, "Invalid photo_url reference.");
  }

  if (input.storagePath) {
    const parsedStorage = parseOperationalPhotoRef(input.storagePath, {
      defaultBucket: "work-order-photos",
    });
    if (
      !parsedStorage ||
      parsedStorage.bucket !== parsedPhoto.bucket ||
      parsedStorage.path !== parsedPhoto.path
    ) {
      throw new TenantRequestError(400, "Invalid storage_path reference.");
    }
  }

  const { data, error } = await supabase
    .from("work_order_photos")
    .insert({
      work_order_id: input.workOrderId,
      organization_id: scope.organizationId,
      property_id: scope.propertyId,
      photo_url: canonicalUrl,
      storage_path: parsedPhoto.path,
      uploaded_by: input.uploadedBy ?? null,
    })
    .select("*")
    .single();

  if (error) throw new Error(error.message);
  return normalizeWorkOrderPhoto(data as WorkOrderPhotoRow);
}
