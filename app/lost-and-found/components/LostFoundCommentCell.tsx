"use client";

import { useEffect, useRef, useState } from "react";
import { Pencil, Save } from "lucide-react";

type LostFoundCommentCellProps = {
  itemId: string | number;
  comments: string | null;
  onSave: (id: string | number, comments: string) => Promise<void>;
};

export default function LostFoundCommentCell({
  itemId,
  comments,
  onSave,
}: LostFoundCommentCellProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState(comments || "");
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isEditing) {
      setDraft(comments || "");
    }
  }, [comments, isEditing]);

  useEffect(() => {
    if (isEditing) {
      inputRef.current?.focus();
    }
  }, [isEditing]);

  function startEditing(event: React.MouseEvent) {
    event.stopPropagation();
    setDraft(comments || "");
    setIsEditing(true);
  }

  async function saveComment() {
    setSaving(true);
    try {
      await onSave(itemId, draft);
      setIsEditing(false);
    } finally {
      setSaving(false);
    }
  }

  async function handleSave(event: React.MouseEvent) {
    event.stopPropagation();
    await saveComment();
  }

  return (
    <div
      className={`lnf-comment-cell__field-wrap${
        isEditing ? " lnf-comment-cell__field-wrap--editing" : ""
      }`}
    >
      <input
        ref={inputRef}
        type="text"
        value={draft}
        readOnly={!isEditing}
        placeholder="Add comment..."
        onChange={(event) => setDraft(event.target.value)}
        onClick={(event) => event.stopPropagation()}
        onKeyDown={(event) => {
          if (isEditing && event.key === "Enter") {
            event.preventDefault();
            void saveComment();
          }
        }}
        className="one-eyrie-field one-eyrie-field--compact lnf-comment-cell__input"
        aria-label="Item comment"
      />
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
    </div>
  );
}
