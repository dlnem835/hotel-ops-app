"use client";

import { useRef, useState, type CSSProperties } from "react";
import { Camera, Loader2, X } from "lucide-react";
import { FLAT_RED, ONE_EYRIE } from "@/app/lib/oneEyrieColors";
import { SETTINGS_BUTTON_BASE } from "@/app/settings/lib/settings-ui-interactions";
import { useInspectionBreakpoint } from "../lib/use-inspection-breakpoint";

type FailedItemDetailsProps = {
  notes: string;
  photoUrl: string | null;
  readOnly?: boolean;
  uploading?: boolean;
  onNotesChange: (value: string) => void;
  onPhotoSelect: (file: File) => void;
  onPhotoRemove: () => void;
};

const NOTE_MAX_LENGTH = 240;
const PHOTO_TOOLTIP = "Add photo (optional)";

export default function FailedItemDetails({
  notes,
  photoUrl,
  readOnly = false,
  uploading = false,
  onNotesChange,
  onPhotoSelect,
  onPhotoRemove,
}: FailedItemDetailsProps) {
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const breakpoint = useInspectionBreakpoint();
  const preferCamera = breakpoint === "mobile" || breakpoint === "tablet";

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
    if (uploading) return;
    if (preferCamera) {
      cameraInputRef.current?.click();
      return;
    }
    fileInputRef.current?.click();
  }

  const displayUrl = photoUrl || previewUrl;

  const noteFieldStyle: CSSProperties = {
    width: "100%",
    minWidth: 0,
    height: "44px",
    background: ONE_EYRIE.black,
    color: ONE_EYRIE.text,
    border: `1px solid ${ONE_EYRIE.borderInput}`,
    borderRadius: "8px",
    padding: "0 40px 0 12px",
    fontFamily: "inherit",
    fontSize: "13px",
    lineHeight: 1.3,
    boxSizing: "border-box",
  };

  return (
    <div
      className="inspection-failed-details"
      style={{
        marginTop: "8px",
        padding: "8px 10px",
        borderRadius: "8px",
        border: `1px solid ${ONE_EYRIE.border}`,
        borderLeft: `3px solid ${ONE_EYRIE.gold}`,
        background: ONE_EYRIE.surfacePanel,
      }}
    >
      {readOnly ? (
        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          <div
            style={{
              color: notes ? ONE_EYRIE.text : ONE_EYRIE.textMuted,
              fontSize: "13px",
              lineHeight: 1.35,
            }}
          >
            {notes || "No deficiency note."}
          </div>
          {displayUrl ? (
            <a href={displayUrl} target="_blank" rel="noopener noreferrer" style={{ display: "inline-block" }}>
              <img
                src={displayUrl}
                alt="Deficiency photo"
                className="inspection-failed-details-thumb"
                style={{
                  width: "44px",
                  height: "44px",
                  objectFit: "cover",
                  borderRadius: "6px",
                  border: `1px solid ${ONE_EYRIE.border}`,
                }}
              />
            </a>
          ) : (
            <div style={{ color: ONE_EYRIE.textMuted, fontSize: "12px" }}>No photo attached.</div>
          )}
        </div>
      ) : (
        <>
          <div className="inspection-failed-details-field" style={{ position: "relative" }}>
            <input
              type="text"
              value={notes}
              maxLength={NOTE_MAX_LENGTH}
              onChange={(event) => onNotesChange(event.target.value)}
              placeholder="Brief deficiency note…"
              className={
                displayUrl
                  ? "inspection-failed-details-note inspection-failed-details-note--has-photo"
                  : "inspection-failed-details-note"
              }
              style={noteFieldStyle}
            />

            {displayUrl && (
              <div className="inspection-failed-details-thumb-wrap">
                <a
                  href={displayUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  title="View photo"
                  style={{ display: "block", lineHeight: 0 }}
                >
                  <img
                    src={displayUrl}
                    alt="Deficiency photo"
                    className="inspection-failed-details-thumb"
                    style={{
                      width: "28px",
                      height: "28px",
                      objectFit: "cover",
                      borderRadius: "4px",
                      border: `1px solid ${ONE_EYRIE.border}`,
                    }}
                  />
                </a>
                <button
                  type="button"
                  onClick={handleRemovePhoto}
                  disabled={uploading}
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
                    opacity: uploading ? 0.6 : 1,
                  }}
                >
                  <X size={10} />
                </button>
              </div>
            )}

            <button
              type="button"
              className="inspection-failed-photo-icon-btn"
              onClick={openPhotoPicker}
              disabled={uploading}
              title={PHOTO_TOOLTIP}
              aria-label={PHOTO_TOOLTIP}
              style={{
                ...SETTINGS_BUTTON_BASE,
                width: "32px",
                height: "32px",
                padding: 0,
                border: "none",
                borderRadius: "6px",
                background: "transparent",
                color: displayUrl ? ONE_EYRIE.goldLight : ONE_EYRIE.gold,
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                opacity: uploading ? 0.6 : 1,
              }}
            >
              {uploading ? <Loader2 size={16} className="inspection-failed-spin" /> : <Camera size={16} />}
            </button>
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
        </>
      )}
    </div>
  );
}
