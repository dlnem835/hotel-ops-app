"use client";

import { useEffect, useRef, useState } from "react";
import { Camera, Loader2, X } from "lucide-react";
import { FLAT_RED, ONE_EYRIE } from "@/app/lib/oneEyrieColors";
import { SETTINGS_BUTTON_BASE } from "@/app/settings/lib/settings-ui-interactions";
import { useInspectionBreakpoint } from "@/app/inspections/lib/use-inspection-breakpoint";

type WorkOrderPhotoFieldProps = {
  photoUrl: string | null;
  uploading?: boolean;
  disabled?: boolean;
  compact?: boolean;
  onPhotoSelect: (file: File) => void;
  onPhotoRemove: () => void;
};

export default function WorkOrderPhotoField({
  photoUrl,
  uploading = false,
  disabled = false,
  compact = false,
  onPhotoSelect,
  onPhotoRemove,
}: WorkOrderPhotoFieldProps) {
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const breakpoint = useInspectionBreakpoint();
  const preferCamera = breakpoint === "mobile" || breakpoint === "tablet";
  const displayUrl = photoUrl || previewUrl;
  const isBusy = uploading || disabled;

  useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }
    setPreviewUrl(URL.createObjectURL(file));
    onPhotoSelect(file);
    event.target.value = "";
  }

  function handleRemovePhoto() {
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
      setPreviewUrl(null);
    }
    onPhotoRemove();
  }

  function openPhotoPicker() {
    if (isBusy) return;
    if (preferCamera) {
      cameraInputRef.current?.click();
      return;
    }
    fileInputRef.current?.click();
  }

  const labelStyle: React.CSSProperties = compact
    ? {
        color: ONE_EYRIE.textSubtle,
        fontSize: "11px",
        fontWeight: 700,
        marginBottom: "4px",
        textTransform: "uppercase",
        letterSpacing: "0.25px",
      }
    : {
        color: ONE_EYRIE.textSubtle,
        fontSize: "12px",
        fontWeight: 700,
        marginBottom: "6px",
      };

  return (
    <div className={compact ? "work-order-photo-field work-order-photo-field--compact" : undefined}>
      <div style={labelStyle}>Photo (optional)</div>

      <div
        className={compact ? "work-order-photo-field__row" : undefined}
        style={
          compact
            ? undefined
            : {
                display: "flex",
                alignItems: "center",
                gap: "12px",
                flexWrap: "wrap",
              }
        }
      >
        <button
          type="button"
          className={compact ? "work-order-photo-field__btn" : undefined}
          onClick={openPhotoPicker}
          disabled={isBusy}
          style={{
            ...SETTINGS_BUTTON_BASE,
            display: "inline-flex",
            alignItems: "center",
            gap: compact ? undefined : "8px",
            height: compact ? undefined : "40px",
            padding: compact ? undefined : "0 14px",
            borderRadius: "8px",
            border: `1px solid ${ONE_EYRIE.gold}`,
            background: "transparent",
            color: ONE_EYRIE.gold,
            fontWeight: 700,
            fontSize: compact ? undefined : "13px",
            opacity: isBusy ? 0.6 : 1,
            cursor: isBusy ? "not-allowed" : "pointer",
          }}
        >
          {uploading ? (
            <Loader2 size={compact ? 14 : 16} className="inspection-failed-spin" />
          ) : (
            <Camera size={compact ? 14 : 16} />
          )}
          {compact
            ? preferCamera
              ? "Add photo"
              : "Upload"
            : preferCamera
              ? "Take or upload photo"
              : "Upload photo"}
        </button>

        {displayUrl ? (
          <div style={{ position: "relative", display: "inline-block" }}>
            <a
              href={displayUrl}
              target="_blank"
              rel="noopener noreferrer"
              title="View photo"
            >
              <img
                src={displayUrl}
                alt="Work order attachment preview"
                className={compact ? "work-order-photo-field__thumb" : undefined}
                style={
                  compact
                    ? {
                        objectFit: "cover",
                        borderRadius: "8px",
                        border: `1px solid ${ONE_EYRIE.border}`,
                        background: ONE_EYRIE.black,
                        display: "block",
                      }
                    : {
                        width: "72px",
                        height: "72px",
                        objectFit: "cover",
                        borderRadius: "8px",
                        border: `1px solid ${ONE_EYRIE.border}`,
                        background: ONE_EYRIE.black,
                        display: "block",
                      }
                }
              />
            </a>
            {!isBusy ? (
              <button
                type="button"
                onClick={handleRemovePhoto}
                title="Remove photo"
                aria-label="Remove photo"
                style={{
                  ...SETTINGS_BUTTON_BASE,
                  position: "absolute",
                  top: "-6px",
                  right: "-6px",
                  width: "16px",
                  height: "16px",
                  padding: 0,
                  borderRadius: "999px",
                  border: `1px solid ${FLAT_RED.border}`,
                  background: FLAT_RED.bg,
                  color: FLAT_RED.text,
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <X size={10} />
              </button>
            ) : null}
          </div>
        ) : compact ? null : (
          <span style={{ color: ONE_EYRIE.textMuted, fontSize: "12px" }}>
            No photo attached
          </span>
        )}
      </div>

      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleFileChange}
        style={{ display: "none" }}
        aria-hidden
      />
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
        onChange={handleFileChange}
        style={{ display: "none" }}
        aria-hidden
      />
    </div>
  );
}
