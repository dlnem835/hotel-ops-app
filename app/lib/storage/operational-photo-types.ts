export const OPERATIONAL_PHOTO_BUCKETS = [
  "inspection-photos",
  "work-order-photos",
] as const;

export type OperationalPhotoBucket =
  (typeof OPERATIONAL_PHOTO_BUCKETS)[number];

/** 2 hours — long enough for a typical inspection or PM session. */
export const OPERATIONAL_PHOTO_SIGNED_TTL_SECONDS = 2 * 60 * 60;

/** Refresh the display URL 10 minutes before the signed URL expires. */
export const OPERATIONAL_PHOTO_REFRESH_AFTER_MS =
  (OPERATIONAL_PHOTO_SIGNED_TTL_SECONDS - 10 * 60) * 1000;

export type OperationalPhotoParent =
  | { type: "inspection_session"; id: number }
  | { type: "work_order"; id: number }
  | { type: "pm_occurrence"; id: number };

export type ParsedOperationalPhoto = {
  bucket: OperationalPhotoBucket;
  path: string;
  kind: "public-url" | "signed-url" | "storage-path";
  organizationId: number | null;
  propertyId: number | null;
};

export type OperationalPhotoTenantScope = {
  organizationId: number;
  propertyId: number;
};
