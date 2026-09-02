import { NextResponse } from "next/server";
import { fetchMemberDisplayNameResolver } from "@/app/lib/member-display-name";
import {
  resolveTenantRequest,
  tenantErrorResponse,
  TenantRequestError,
} from "@/app/lib/tenant/server/resolve-tenant-request";
import { fetchWorkOrderById, updateWorkOrder } from "@/app/maintenance/lib/work-order-db";
import {
  fetchWorkOrderPhotos,
  insertWorkOrderPhoto,
  isWorkOrderPhotoAddableStatus,
} from "@/app/maintenance/lib/work-order-photos-db";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(request: Request, context: RouteContext) {
  try {
    const { supabase, organizationId, propertyId } = await resolveTenantRequest(
      request
    );
    const scope = { organizationId, propertyId };
    const { id } = await context.params;
    const workOrder = await fetchWorkOrderById(supabase, Number(id), scope);
    if (!workOrder) {
      throw new TenantRequestError(404, "Work order not found.");
    }

    const photos = await fetchWorkOrderPhotos(supabase, Number(id), scope);
    const memberResolver = await fetchMemberDisplayNameResolver(supabase);
    return NextResponse.json({
      photos: photos.map((photo) => ({
        ...photo,
        uploadedByLabel: photo.uploadedBy
          ? memberResolver.resolveStoredValue(photo.uploadedBy)
          : null,
      })),
    });
  } catch (error: unknown) {
    return tenantErrorResponse(error);
  }
}

export async function POST(request: Request, context: RouteContext) {
  try {
    const { supabase, organizationId, propertyId } = await resolveTenantRequest(
      request
    );
    const scope = { organizationId, propertyId };
    const { id } = await context.params;
    const workOrderId = Number(id);
    const workOrder = await fetchWorkOrderById(supabase, workOrderId, scope);
    if (!workOrder) {
      throw new TenantRequestError(404, "Work order not found.");
    }

    if (!isWorkOrderPhotoAddableStatus(workOrder.status)) {
      throw new TenantRequestError(
        400,
        "Photos can only be added to open or in-progress work orders."
      );
    }

    const body = (await request.json().catch(() => null)) as {
      photo_url?: string;
      storage_path?: string | null;
      uploaded_by?: string | null;
    } | null;

    const photoUrl = String(body?.photo_url || "").trim();
    if (!photoUrl) {
      throw new TenantRequestError(400, "photo_url is required.");
    }

    const photo = await insertWorkOrderPhoto(
      supabase,
      {
        workOrderId,
        photoUrl,
        storagePath: body?.storage_path ?? null,
        uploadedBy: body?.uploaded_by ?? null,
      },
      scope
    );

    // Touch updated_at without changing other fields.
    const updated = await updateWorkOrder(supabase, workOrderId, {}, scope);
    const photos = await fetchWorkOrderPhotos(supabase, workOrderId, scope);
    const memberResolver = await fetchMemberDisplayNameResolver(supabase);

    return NextResponse.json({
      photo: {
        ...photo,
        uploadedByLabel: photo.uploadedBy
          ? memberResolver.resolveStoredValue(photo.uploadedBy)
          : null,
      },
      photos: photos.map((row) => ({
        ...row,
        uploadedByLabel: row.uploadedBy
          ? memberResolver.resolveStoredValue(row.uploadedBy)
          : null,
      })),
      workOrder: {
        ...updated,
        createdByLabel: updated.createdBy
          ? memberResolver.resolveStoredValue(updated.createdBy)
          : null,
        completedByLabel: updated.completedBy
          ? memberResolver.resolveStoredValue(updated.completedBy)
          : null,
        photos: photos.map((row) => ({
          ...row,
          uploadedByLabel: row.uploadedBy
            ? memberResolver.resolveStoredValue(row.uploadedBy)
            : null,
        })),
      },
    });
  } catch (error: unknown) {
    return tenantErrorResponse(error);
  }
}
