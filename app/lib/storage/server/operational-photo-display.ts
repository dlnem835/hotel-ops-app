import type { SupabaseClient } from "@supabase/supabase-js";
import {
  canonicalizeOperationalPhotoRef,
  collectKnownLegacyPhotoPaths,
  requireCanonicalOperationalPhotoForWrite,
  resolveOperationalPhotoDisplayUrl,
  resolveOperationalPhotoDisplayUrls,
} from "@/app/lib/storage/server/operational-photo-access";
import type { OperationalPhotoTenantScope } from "@/app/lib/storage/operational-photo-types";
import type { InspectionItemResponse } from "@/app/inspections/lib/inspection-types";
import type { RoomHistoryEntry } from "@/app/inspections/lib/inspection-types";
import type {
  PmOccurrence,
  PmOccurrenceResponses,
  WorkOrder,
  WorkOrderPhoto,
} from "@/app/maintenance/lib/maintenance-types";
import type { PmProgramSession } from "@/app/maintenance/lib/pm-program-session-db";

export function canonicalizePmOccurrenceResponses(
  responses: PmOccurrenceResponses,
  scope?: OperationalPhotoTenantScope,
  existing?: PmOccurrenceResponses | null
): PmOccurrenceResponses {
  const existingRefs = [
    existing?.targetPhotoUrl,
    ...(existing?.steps || []).map((step) => step.photoUrl),
  ];
  const writePhoto = (
    value: string | null | undefined,
    fieldName: string
  ): string | null => {
    if (!scope) {
      return canonicalizeOperationalPhotoRef(value, {
        defaultBucket: "inspection-photos",
      });
    }
    return requireCanonicalOperationalPhotoForWrite(value, scope, {
      defaultBucket: "inspection-photos",
      existingRefs,
      fieldName,
    });
  };

  return {
    ...responses,
    targetPhotoUrl: writePhoto(responses.targetPhotoUrl, "targetPhotoUrl"),
    steps: (responses.steps || []).map((step) => ({
      ...step,
      photoUrl: writePhoto(step.photoUrl, "photoUrl"),
    })),
  };
}

export async function signInspectionResponsePhotos(
  supabase: SupabaseClient,
  responses: InspectionItemResponse[],
  scope: OperationalPhotoTenantScope
): Promise<InspectionItemResponse[]> {
  const stored = responses.map((row) => row.photo_url);
  const signed = await resolveOperationalPhotoDisplayUrls(
    supabase,
    stored,
    scope,
    {
      defaultBucket: "inspection-photos",
      knownLegacyPaths: collectKnownLegacyPhotoPaths(
        stored,
        "inspection-photos"
      ),
    }
  );
  return responses.map((row, index) => ({
    ...row,
    photo_url: signed[index],
  }));
}

export async function signRoomHistoryPhotos(
  supabase: SupabaseClient,
  history: RoomHistoryEntry[],
  scope: OperationalPhotoTenantScope
): Promise<RoomHistoryEntry[]> {
  const stored = history.flatMap((entry) =>
    entry.failedItems.map((item) => item.photoUrl)
  );
  const signed = await resolveOperationalPhotoDisplayUrls(
    supabase,
    stored,
    scope,
    {
      defaultBucket: "inspection-photos",
      knownLegacyPaths: collectKnownLegacyPhotoPaths(
        stored,
        "inspection-photos"
      ),
    }
  );

  let cursor = 0;
  return history.map((entry) => ({
    ...entry,
    failedItems: entry.failedItems.map((item) => {
      const photoUrl = signed[cursor];
      cursor += 1;
      return { ...item, photoUrl };
    }),
  }));
}

export async function signPmOccurrenceResponses(
  supabase: SupabaseClient,
  responses: PmOccurrenceResponses,
  scope: OperationalPhotoTenantScope
): Promise<PmOccurrenceResponses> {
  const stored = [
    responses.targetPhotoUrl,
    ...(responses.steps || []).map((step) => step.photoUrl),
  ];
  const signed = await resolveOperationalPhotoDisplayUrls(
    supabase,
    stored,
    scope,
    {
      defaultBucket: "inspection-photos",
      knownLegacyPaths: collectKnownLegacyPhotoPaths(
        stored,
        "inspection-photos"
      ),
    }
  );
  return {
    ...responses,
    targetPhotoUrl: signed[0],
    steps: (responses.steps || []).map((step, index) => ({
      ...step,
      photoUrl: signed[index + 1],
    })),
  };
}

export async function signPmOccurrence(
  supabase: SupabaseClient,
  occurrence: PmOccurrence,
  scope: OperationalPhotoTenantScope
): Promise<PmOccurrence> {
  return {
    ...occurrence,
    responses: await signPmOccurrenceResponses(
      supabase,
      occurrence.responses || { steps: [] },
      scope
    ),
  };
}

export async function signPmProgramSessionPhotos(
  supabase: SupabaseClient,
  session: PmProgramSession,
  scope: OperationalPhotoTenantScope
): Promise<PmProgramSession> {
  const responses = await signPmOccurrenceResponses(
    supabase,
    session.responses || { steps: [] },
    scope
  );
  const targetPhotos = session.targets.map((target) => target.photoUrl);
  const targetUrls = await resolveOperationalPhotoDisplayUrls(
    supabase,
    targetPhotos,
    scope,
    {
      defaultBucket: "inspection-photos",
      knownLegacyPaths: collectKnownLegacyPhotoPaths(
        targetPhotos,
        "inspection-photos"
      ),
    }
  );
  return {
    ...session,
    responses,
    targets: session.targets.map((target, index) => ({
      ...target,
      photoUrl: targetUrls[index],
    })),
  };
}

export async function signWorkOrderPhotoFields(
  supabase: SupabaseClient,
  workOrder: WorkOrder,
  scope: OperationalPhotoTenantScope
): Promise<WorkOrder> {
  const extraStored = (workOrder.photos || []).map(
    (photo) => photo.storagePath || photo.photoUrl
  );
  const knownLegacyPaths = collectKnownLegacyPhotoPaths(
    [workOrder.photoUrl, workOrder.resolutionPhotoUrl, ...extraStored],
    "work-order-photos"
  );
  const [photoUrl, resolutionPhotoUrl, photos] = await Promise.all([
    resolveOperationalPhotoDisplayUrl(supabase, workOrder.photoUrl, scope, {
      defaultBucket: "work-order-photos",
      knownLegacyPaths,
    }),
    resolveOperationalPhotoDisplayUrl(
      supabase,
      workOrder.resolutionPhotoUrl,
      scope,
      { defaultBucket: "work-order-photos", knownLegacyPaths }
    ),
    workOrder.photos
      ? Promise.all(
          workOrder.photos.map(async (photo, index) => ({
            ...photo,
            photoUrl:
              (await resolveOperationalPhotoDisplayUrl(
                supabase,
                extraStored[index],
                scope,
                { defaultBucket: "work-order-photos", knownLegacyPaths }
              )) || "",
          }))
        )
      : Promise.resolve(undefined as WorkOrderPhoto[] | undefined),
  ]);

  return {
    ...workOrder,
    photoUrl,
    resolutionPhotoUrl,
    ...(photos ? { photos } : {}),
  };
}

export async function signWorkOrderPhotoList(
  supabase: SupabaseClient,
  photos: WorkOrderPhoto[],
  scope: OperationalPhotoTenantScope
): Promise<WorkOrderPhoto[]> {
  const stored = photos.map((photo) => photo.storagePath || photo.photoUrl);
  const signed = await resolveOperationalPhotoDisplayUrls(
    supabase,
    stored,
    scope,
    {
      defaultBucket: "work-order-photos",
      knownLegacyPaths: collectKnownLegacyPhotoPaths(
        stored,
        "work-order-photos"
      ),
    }
  );
  return photos.map((photo, index) => ({
    ...photo,
    photoUrl: signed[index] || "",
  }));
}
