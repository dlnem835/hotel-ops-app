"use client";

import { useEffect, useRef, useState } from "react";
import { Pencil, Save } from "lucide-react";
import {
  forestHoverHandlers,
  START_WORK_BUTTON,
} from "@/app/lib/oneEyrieButtons";

type LostFoundCommentCellProps = {
  itemId: string | number;
  comments: string | null;
  onSave: (id: string | number, comments: string) => Promise<void>;
  /** Modal composer: larger textarea, auto-focus, Save Comment button. */
  variant?: "inline" | "modal";
};

export default function LostFoundCommentCell({
  itemId,
  comments,
  onSave,
  variant = "inline",
}: LostFoundCommentCellProps) {
  const isModal = variant === "modal";
  const [isEditing, setIsEditing] = useState(isModal);
  const [draft, setDraft] = useState(comments || "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!isEditing) {
      setDraft(comments || "");
      setError(null);
    }
  }, [comments, isEditing]);

  useEffect(() => {
    if (!isEditing) return;
    const node = inputRef.current;
    if (!node) return;
    node.focus();
    const length = node.value.length;
    node.setSelectionRange(length, length);
  }, [isEditing]);

  function startEditing(event: React.MouseEvent) {
    event.stopPropagation();
    setDraft(comments || "");
    setError(null);
    setIsEditing(true);
  }

  async function saveComment() {
    const trimmed = draft.trim();
    if (!trimmed) {
      setError("Enter a comment before saving.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await onSave(itemId, trimmed);
      if (!isModal) setIsEditing(false);
    } finally {
      setSaving(false);
    }
  }

  async function handleSave(event: React.MouseEvent) {
    event.stopPropagation();
    await saveComment();
  }

  if (isModal) {
    return (
      <div className="lnf-comment-composer">
        <textarea
          ref={inputRef}
          value={draft}
          rows={4}
          placeholder="Add a comment…"
          onChange={(event) => {
            setDraft(event.target.value);
            if (error) setError(null);
          }}
          onClick={(event) => event.stopPropagation()}
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              event.stopPropagation();
            }
          }}
          className="one-eyrie-field lnf-comment-composer__textarea"
          aria-label="Item comment"
        />
        {error ? (
          <p className="lnf-comment-composer__error" role="alert">
            {error}
          </p>
        ) : null}
        <div className="lnf-comment-composer__actions">
          <button
            type="button"
            onClick={(event) => void handleSave(event)}
            disabled={saving}
            style={{
              ...START_WORK_BUTTON,
              height: "36px",
              padding: "0 14px",
              fontSize: "13px",
              opacity: saving ? 0.7 : 1,
            }}
            className="one-eyrie-btn one-eyrie-btn--forest one-eyrie-btn--sm"
            {...forestHoverHandlers()}
          >
            {saving ? "Saving…" : "Save Comment"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`lnf-comment-cell__field-wrap${
        isEditing ? " lnf-comment-cell__field-wrap--editing" : ""
      }`}
    >
      {isEditing ? (
        <textarea
          ref={inputRef}
          value={draft}
          rows={3}
          placeholder="Add comment..."
          onChange={(event) => setDraft(event.target.value)}
          onClick={(event) => event.stopPropagation()}
          className="one-eyrie-field one-eyrie-field--compact lnf-comment-cell__textarea"
          aria-label="Item comment"
        />
      ) : (
        <div
          className="lnf-comment-cell__display"
          title={comments?.trim() || undefined}
        >
          {comments?.trim() || "Add comment..."}
        </div>
      )}
      {isEditing ? (
        <button
          type="button"
          className="lnf-comment-cell__icon-btn lnf-comment-cell__icon-btn--save"
          onClick={(event) => void handleSave(event)}
          disabled={saving}
          aria-label="Save comment"
          title="Save"
        >
          <Save size={13} strokeWidth={2.25} />
        </button>
      ) : (
        <button
          type="button"
          className="lnf-comment-cell__icon-btn lnf-comment-cell__icon-btn--edit"
          onClick={startEditing}
          aria-label="Edit comment"
          title="Edit"
        >
          <Pencil size={13} strokeWidth={2.25} />
        </button>
      )}
      {error && isEditing ? (
        <p className="lnf-comment-cell__error" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
