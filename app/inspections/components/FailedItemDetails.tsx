"use client";

import { useRef, useState } from "react";
import { Camera, Loader2, X } from "lucide-react";
import { FLAT_RED, FOREST, ONE_EYRIE } from "@/app/lib/oneEyrieColors";
import {
  forestOutlineHoverHandlers,
  SETTINGS_BUTTON_BASE,
} from "@/app/settings/lib/settings-ui-interactions";

type FailedItemDetailsProps = {
  notes: string;
  photoUrl: string | null;
  readOnly?: boolean;
  uploading?: boolean;
  onNotesChange: (value: string) => void;
  onPhotoSelect: (file: File) => void;
  onPhotoRemove: () => void;
};

export default function FailedItemDetails({
  notes,
  photoUrl,
  readOnly = false,
  uploading = false,
  onNotesChange,
  onPhotoSelect,
  onPhotoRemove,
}: FailedItemDetailsProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

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

  const displayUrl = photoUrl || previewUrl;

  return (
    <div
      style={{
        marginTop: "12px",
        padding: "12px",
        borderRadius: "10px",
        border: `1px solid ${FLAT_RED.border}`,
        background: FLAT_RED.bg,
      }}
    >
      <div
        style={{
          color: FLAT_RED.text,
          fontWeight: 800,
          fontSize: "12px",
          marginBottom: "10px",
          letterSpacing: "0.02em",
          textTransform: "uppercase",
        }}
      >
        Deficiency Details
      </div>

      <label style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
        <span style={{ color: ONE_EYRIE.textSubtle, fontSize: "12px", fontWeight: 700 }}>
          Comment
        </span>
        {readOnly ? (
          <div
            style={{
              color: notes ? ONE_EYRIE.text : ONE_EYRIE.textMuted,
              fontSize: "13px",
              lineHeight: 1.5,
              whiteSpace: "pre-wrap",
            }}
          >
            {notes || "No comment provided."}
          </div>
        ) : (
          <textarea
            value={notes}
            onChange={(event) => onNotesChange(event.target.value)}
            placeholder="Describe the deficiency..."
            rows={3}
            style={{
              width: "100%",
              background: ONE_EYRIE.black,
              color: ONE_EYRIE.text,
              border: `1px solid ${ONE_EYRIE.borderInput}`,
              borderRadius: "8px",
              padding: "10px 12px",
              resize: "vertical",
              fontFamily: "inherit",
              fontSize: "13px",
              lineHeight: 1.45,
            }}
          />
        )}
      </label>

      <div style={{ marginTop: "12px" }}>
        <div
          style={{
            color: ONE_EYRIE.textSubtle,
            fontSize: "12px",
            fontWeight: 700,
            marginBottom: "8px",
          }}
        >
          Photo {readOnly ? "" : "(optional)"}
        </div>

        {displayUrl ? (
          <div style={{ display: "flex", gap: "12px", alignItems: "flex-start" }}>
            <a
              href={displayUrl}
              target="_blank"
              rel="noopener noreferrer"
              style={{ display: "block", flexShrink: 0 }}
            >
              <img
                src={displayUrl}
                alt="Deficiency photo"
                style={{
                  width: "96px",
                  height: "96px",
                  objectFit: "cover",
                  borderRadius: "8px",
                  border: `1px solid ${ONE_EYRIE.border}`,
                }}
              />
            </a>
            {!readOnly && (
              <button
                type="button"
                onClick={handleRemovePhoto}
                disabled={uploading}
                style={{
                  ...SETTINGS_BUTTON_BASE,
                  background: "transparent",
                  border: `1px solid ${FLAT_RED.border}`,
                  color: FLAT_RED.text,
                  borderRadius: "8px",
                  padding: "6px 10px",
                  fontSize: "12px",
                  fontWeight: 700,
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "4px",
                  opacity: uploading ? 0.6 : 1,
                }}
              >
                <X size={14} />
                Remove
              </button>
            )}
          </div>
        ) : readOnly ? (
          <div style={{ color: ONE_EYRIE.textMuted, fontSize: "12px" }}>No photo attached.</div>
        ) : (
          <>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
              capture="environment"
              onChange={handleFileChange}
              style={{ display: "none" }}
            />
            <button
              type="button"
              className="inspection-failed-photo-btn"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              style={{
                ...SETTINGS_BUTTON_BASE,
                background: "transparent",
                border: `1px solid ${FOREST.border}`,
                color: FOREST.text,
                borderRadius: "8px",
                padding: "8px 12px",
                fontSize: "12px",
                fontWeight: 800,
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                opacity: uploading ? 0.6 : 1,
              }}
              {...forestOutlineHoverHandlers(uploading)}
            >
              {uploading ? <Loader2 size={14} /> : <Camera size={14} />}
              {uploading ? "Uploading..." : "Add Photo"}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
