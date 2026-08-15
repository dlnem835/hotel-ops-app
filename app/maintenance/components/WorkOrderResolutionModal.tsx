"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { ONE_EYRIE } from "@/app/lib/oneEyrieColors";
import {
  ONE_EYRIE_MODAL_BOX,
  ONE_EYRIE_MODAL_CLOSE_BUTTON,
  ONE_EYRIE_MODAL_HEADER,
  ONE_EYRIE_MODAL_OVERLAY,
} from "@/app/lib/one-eyrie-modal-styles";
import {
  GOLD_FILLED_BUTTON,
  SETTINGS_BUTTON_BASE,
} from "@/app/settings/lib/settings-ui-interactions";
import { useModalScrollLock } from "@/app/lib/use-modal-scroll-lock";
import WorkOrderPhotoField from "@/app/maintenance/components/WorkOrderPhotoField";
import { uploadWorkOrderPhoto } from "@/app/maintenance/lib/work-order-photo-upload";

type WorkOrderResolutionModalProps = {
  open: boolean;
  saving?: boolean;
  onClose: () => void;
  onSubmit: (resolution: string, resolutionPhotoUrl: string | null) => void;
};

export default function WorkOrderResolutionModal({
  open,
  saving = false,
  onClose,
  onSubmit,
}: WorkOrderResolutionModalProps) {
  const [resolution, setResolution] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [photo, setPhoto] = useState<File | null>(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  useModalScrollLock(open);

  if (!open) return null;

  async function submit() {
    const value = resolution.trim();
    if (!value) {
      setError("Resolution is required.");
      return;
    }
    try {
      setError(null);
      let resolutionPhotoUrl: string | null = null;
      if (photo) {
        setUploadingPhoto(true);
        resolutionPhotoUrl = await uploadWorkOrderPhoto(photo);
      }
      onSubmit(value, resolutionPhotoUrl);
    } catch (uploadError) {
      setError(
        uploadError instanceof Error
          ? uploadError.message
          : "Unable to upload completion photo."
      );
    } finally {
      setUploadingPhoto(false);
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="work-order-resolution-title"
      style={{ ...ONE_EYRIE_MODAL_OVERLAY, zIndex: 1200 }}
      onClick={(event) => {
        event.stopPropagation();
        if (!saving) onClose();
      }}
    >
      <div
        style={{
          ...ONE_EYRIE_MODAL_BOX,
          width: "520px",
          maxWidth: "calc(100vw - 24px)",
          maxHeight: "calc(100vh - 32px)",
          overflowY: "auto",
          boxSizing: "border-box",
        }}
        onClick={(event) => event.stopPropagation()}
      >
        <div style={ONE_EYRIE_MODAL_HEADER}>
          <h2
            id="work-order-resolution-title"
            style={{ margin: 0, color: ONE_EYRIE.text }}
          >
            Complete Work Order
          </h2>
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            style={ONE_EYRIE_MODAL_CLOSE_BUTTON}
            aria-label="Close"
          >
            <X size={22} />
          </button>
        </div>

        <label style={{ display: "block" }}>
          <div
            style={{
              color: ONE_EYRIE.textSubtle,
              fontSize: 12,
              fontWeight: 700,
              marginBottom: 6,
            }}
          >
            Resolution
          </div>
          <textarea
            autoFocus
            value={resolution}
            onChange={(event) => {
              setResolution(event.target.value);
              setError(null);
            }}
            rows={5}
            placeholder="Describe what was done to resolve this work order."
            className="one-eyrie-maintenance-field"
            style={{
              width: "100%",
              boxSizing: "border-box",
              borderRadius: 10,
              padding: 12,
              fontSize: 14,
              lineHeight: 1.5,
              resize: "vertical",
              outline: "none",
            }}
          />
        </label>

        <div style={{ marginTop: 14 }}>
          <WorkOrderPhotoField
            photoUrl={null}
            uploading={uploadingPhoto}
            disabled={saving}
            compact
            label="Completion Photo"
            onPhotoSelect={setPhoto}
            onPhotoRemove={() => setPhoto(null)}
          />
        </div>

        {error ? (
          <div role="alert" style={{ color: "#C9A8A8", fontSize: 12, marginTop: 8 }}>
            {error}
          </div>
        ) : null}

        <div
          style={{
            display: "flex",
            justifyContent: "flex-end",
            gap: 10,
            marginTop: 18,
          }}
        >
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            style={{
              ...SETTINGS_BUTTON_BASE,
              background: "transparent",
              color: ONE_EYRIE.textMuted,
              border: `1px solid ${ONE_EYRIE.border}`,
            }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => void submit()}
            disabled={saving || uploadingPhoto}
            style={{
              ...GOLD_FILLED_BUTTON,
              opacity: saving || uploadingPhoto ? 0.6 : 1,
              cursor: saving || uploadingPhoto ? "not-allowed" : "pointer",
            }}
          >
            {uploadingPhoto
              ? "Uploading photo…"
              : saving
                ? "Completing…"
                : "Submit Resolution"}
          </button>
        </div>
      </div>
    </div>
  );
}
