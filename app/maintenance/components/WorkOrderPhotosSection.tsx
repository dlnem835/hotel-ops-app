"use client";

import { useEffect, useRef, useState } from "react";
import { Camera, ImagePlus, Loader2 } from "lucide-react";
import { ONE_EYRIE } from "@/app/lib/oneEyrieColors";
import { SETTINGS_BUTTON_BASE } from "@/app/settings/lib/settings-ui-interactions";
import type { WorkOrder, WorkOrderPhoto } from "@/app/maintenance/lib/maintenance-types";
import { isWorkOrderPhotoAddableStatus } from "@/app/maintenance/lib/maintenance-types";
import { uploadWorkOrderPhoto } from "@/app/maintenance/lib/work-order-photo-upload";
import { tenantFetch } from "@/app/lib/tenant/tenant-fetch";
import WorkOrderPhotoAttachment from "./WorkOrderPhotoAttachment";

const PHOTO_ACCEPT =
  "image/jpeg,image/png,image/webp,image/heic,image/heif";

type WorkOrderPhotosSectionProps = {
  workOrder: WorkOrder;
  uploadedBy?: string | null;
  onWorkOrderUpdated?: (workOrder: WorkOrder) => void;
  className?: string;
};

function formatPhotoMeta(photo: WorkOrderPhoto): string {
  const who = photo.uploadedByLabel || photo.uploadedBy || "Unknown";
  const when = photo.uploadedAt
    ? new Date(photo.uploadedAt).toLocaleString()
    : "";
  return when ? `Photo added by ${who} · ${when}` : `Photo added by ${who}`;
}

export default function WorkOrderPhotosSection({
  workOrder,
  uploadedBy,
  onWorkOrderUpdated,
  className,
}: WorkOrderPhotosSectionProps) {
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const libraryInputRef = useRef<HTMLInputElement>(null);
  const [photos, setPhotos] = useState<WorkOrderPhoto[]>(workOrder.photos || []);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setPhotos(workOrder.photos || []);
  }, [workOrder.id, workOrder.photos]);

  const canAdd = isWorkOrderPhotoAddableStatus(workOrder.status);
  const legacyPhoto = workOrder.photoUrl;
  const resolutionPhoto = workOrder.resolutionPhotoUrl;
  const hasAny =
    Boolean(legacyPhoto) || Boolean(resolutionPhoto) || photos.length > 0;

  async function handleFile(file: File) {
    if (!canAdd || uploading) return;
    setUploading(true);
    setError(null);
    try {
      const photoUrl = await uploadWorkOrderPhoto(file);
      const response = await tenantFetch(`/api/work-orders/${workOrder.id}/photos`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          photo_url: photoUrl,
          uploaded_by: uploadedBy || null,
        }),
      });
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || "Unable to add photo");
      }
      const nextPhotos = (result.photos || []) as WorkOrderPhoto[];
      setPhotos(nextPhotos);
      if (result.workOrder && onWorkOrderUpdated) {
        onWorkOrderUpdated(result.workOrder as WorkOrder);
      }
    } catch (uploadError) {
      setError(
        uploadError instanceof Error ? uploadError.message : "Unable to add photo"
      );
    } finally {
      setUploading(false);
    }
  }

  function onInputChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (file) void handleFile(file);
  }

  const actionButtonStyle: React.CSSProperties = {
    ...SETTINGS_BUTTON_BASE,
    display: "inline-flex",
    alignItems: "center",
    gap: "8px",
    height: "40px",
    padding: "0 14px",
    borderRadius: "8px",
    border: `1px solid ${ONE_EYRIE.gold}`,
    background: "transparent",
    color: ONE_EYRIE.gold,
    fontWeight: 700,
    fontSize: "13px",
    opacity: uploading ? 0.6 : 1,
    cursor: uploading ? "not-allowed" : "pointer",
  };

  return (
    <div className={className} style={{ marginBottom: "18px" }}>
      <div
        style={{
          color: "#9CA3AF",
          fontSize: "12px",
          fontWeight: 700,
          marginBottom: "8px",
          textTransform: "uppercase",
          letterSpacing: "0.3px",
        }}
      >
        Photos
      </div>

      {!hasAny ? (
        <p style={{ margin: "0 0 10px", color: ONE_EYRIE.textMuted, fontSize: "13px" }}>
          No photos attached.
        </p>
      ) : null}

      <div style={{ display: "grid", gap: "14px" }}>
        {legacyPhoto ? (
          <WorkOrderPhotoAttachment photoUrl={legacyPhoto} label="Original Photo" />
        ) : null}

        {photos.map((photo) => (
          <div key={photo.id}>
            <WorkOrderPhotoAttachment photoUrl={photo.photoUrl} label="Photo" />
            <p
              style={{
                margin: "6px 0 0",
                color: ONE_EYRIE.textMuted,
                fontSize: "12px",
              }}
            >
              {formatPhotoMeta(photo)}
            </p>
          </div>
        ))}

        {resolutionPhoto ? (
          <WorkOrderPhotoAttachment
            photoUrl={resolutionPhoto}
            label="Resolution Photo"
          />
        ) : null}
      </div>

      {canAdd ? (
        <div style={{ marginTop: "12px", display: "flex", gap: "8px", flexWrap: "wrap" }}>
          <button
            type="button"
            onClick={() => libraryInputRef.current?.click()}
            disabled={uploading}
            style={actionButtonStyle}
          >
            {uploading ? (
              <Loader2 size={16} className="inspection-failed-spin" />
            ) : (
              <ImagePlus size={16} />
            )}
            Add Photo
          </button>
          <button
            type="button"
            onClick={() => cameraInputRef.current?.click()}
            disabled={uploading}
            style={actionButtonStyle}
            title="Take photo"
          >
            <Camera size={16} />
            Take Photo
          </button>
        </div>
      ) : null}

      {error ? (
        <p style={{ margin: "8px 0 0", color: "#FCA5A5", fontSize: "13px" }}>{error}</p>
      ) : null}

      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={onInputChange}
        style={{ display: "none" }}
        aria-hidden
      />
      <input
        ref={libraryInputRef}
        type="file"
        accept={PHOTO_ACCEPT}
        onChange={onInputChange}
        style={{ display: "none" }}
        aria-hidden
      />
    </div>
  );
}
