"use client";

import { useRef, useState } from "react";
import { Camera, FileText, ImageIcon, Upload, X } from "lucide-react";
import {
  openPassOnAttachment,
  type PassOnAttachment,
  uploadPassOnAttachment,
} from "@/app/mobile/pass-on-log/lib/pass-on-shared";

const ACCEPTED_FILES =
  "image/jpeg,image/png,image/webp,image/heic,image/heif,application/pdf,text/plain,text/csv,.doc,.docx,.xls,.xlsx";

type PassOnAttachmentsProps = {
  entryId?: number;
  attachments?: PassOnAttachment[];
  pendingFiles?: File[];
  onPendingFilesChange?: (files: File[]) => void;
  onUploaded?: () => void;
  disabled?: boolean;
  allowUpload?: boolean;
  replyId?: number;
};

function formatBytes(value: number): string {
  if (value < 1024 * 1024) return `${Math.max(1, Math.round(value / 1024))} KB`;
  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
}

export default function PassOnAttachments({
  entryId,
  attachments = [],
  pendingFiles = [],
  onPendingFilesChange,
  onUploaded,
  disabled = false,
  allowUpload = true,
  replyId,
}: PassOnAttachmentsProps) {
  const cameraInputRef = useRef<HTMLInputElement | null>(null);
  const uploadInputRef = useRef<HTMLInputElement | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFiles(files: File[]) {
    if (files.length === 0) return;
    setError(null);

    if (!entryId) {
      onPendingFilesChange?.([...pendingFiles, ...files]);
      return;
    }

    setUploading(true);
    try {
      for (const file of files) {
        await uploadPassOnAttachment(entryId, file, replyId);
      }
      onUploaded?.();
    } catch (uploadError) {
      setError(
        uploadError instanceof Error
          ? uploadError.message
          : "Unable to upload attachment"
      );
    } finally {
      setUploading(false);
    }
  }

  async function openAttachment(attachmentId: number) {
    if (!entryId) return;
    setError(null);
    try {
      await openPassOnAttachment(entryId, attachmentId);
    } catch (openError) {
      setError(
        openError instanceof Error ? openError.message : "Unable to open attachment"
      );
    }
  }

  function openPendingFile(file: File) {
    const url = URL.createObjectURL(file);
    window.open(url, "_blank", "noopener,noreferrer");
    window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
  }

  function attachmentIcon(contentType: string) {
    return contentType.startsWith("image/") ? (
      <ImageIcon size={14} aria-hidden />
    ) : (
      <FileText size={14} aria-hidden />
    );
  }

  return (
    <div style={{ display: "grid", gap: 8 }}>
      {allowUpload ? (
        <>
          <input
            ref={cameraInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            hidden
            onChange={(event) => {
              void handleFiles(Array.from(event.target.files || []));
              event.target.value = "";
            }}
          />
          <input
            ref={uploadInputRef}
            type="file"
            multiple
            accept={ACCEPTED_FILES}
            hidden
            onChange={(event) => {
              void handleFiles(Array.from(event.target.files || []));
              event.target.value = "";
            }}
          />

          <div
            style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}
          >
            <button
              type="button"
              disabled={disabled || uploading}
              onClick={() => cameraInputRef.current?.click()}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 5,
                border: "1px solid #3A352E",
                borderRadius: 8,
                background: "transparent",
                color: "#9CA3AF",
                padding: "5px 8px",
                cursor: disabled || uploading ? "not-allowed" : "pointer",
                fontSize: 11,
              }}
            >
              <Camera size={14} />
              Take Photo
            </button>
            <button
              type="button"
              disabled={disabled || uploading}
              onClick={() => uploadInputRef.current?.click()}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 5,
                border: "1px solid #3A352E",
                borderRadius: 8,
                background: "transparent",
                color: "#9CA3AF",
                padding: "5px 8px",
                cursor: disabled || uploading ? "not-allowed" : "pointer",
                fontSize: 11,
              }}
            >
              <Upload size={14} />
              {uploading ? "Uploading…" : "Upload"}
            </button>
          </div>
        </>
      ) : null}

      {pendingFiles.length > 0 ? (
        <div style={{ display: "grid", gap: 5 }}>
          {pendingFiles.map((file, index) => (
            <div
              key={`${file.name}-${file.size}-${index}`}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 7,
                width: "fit-content",
                maxWidth: "100%",
                border: "1px solid #3A352E",
                borderRadius: 8,
                padding: "5px 7px",
                fontSize: 12,
              }}
            >
              {attachmentIcon(file.type)}
              <button
                type="button"
                onClick={() => openPendingFile(file)}
                title={`Preview ${file.name}`}
                style={{
                  border: 0,
                  padding: 0,
                  background: "transparent",
                  color: "inherit",
                  cursor: "pointer",
                  maxWidth: 220,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {file.name}
              </button>
              <button
                type="button"
                disabled={disabled}
                onClick={() =>
                  onPendingFilesChange?.(
                    pendingFiles.filter((_, fileIndex) => fileIndex !== index)
                  )
                }
                style={{
                  border: 0,
                  background: "transparent",
                  color: "#9CA3AF",
                  cursor: "pointer",
                  display: "inline-flex",
                  padding: 0,
                }}
                aria-label={`Remove ${file.name}`}
              >
                <X size={13} />
              </button>
            </div>
          ))}
        </div>
      ) : null}

      {attachments.length > 0 ? (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {attachments.map((attachment) => (
            <button
              key={attachment.id}
              type="button"
              onClick={() => void openAttachment(attachment.id)}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                border: "1px solid #3A352E",
                borderRadius: 8,
                background: "transparent",
                color: "inherit",
                padding: "6px 8px",
                cursor: "pointer",
                fontSize: 12,
                maxWidth: "100%",
              }}
              title={`Open ${attachment.original_filename}`}
            >
              {attachmentIcon(attachment.content_type)}
              <span
                style={{
                  maxWidth: 220,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {attachment.original_filename}
              </span>
              <span style={{ color: "#9CA3AF", whiteSpace: "nowrap" }}>
                {formatBytes(attachment.byte_size)}
              </span>
            </button>
          ))}
        </div>
      ) : null}

      {error ? (
        <div role="alert" style={{ color: "#C9A8A8", fontSize: 12 }}>
          {error}
        </div>
      ) : null}
    </div>
  );
}
