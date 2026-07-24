"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import {
  ONE_EYRIE_MODAL_BOX,
  ONE_EYRIE_MODAL_CLOSE_BUTTON,
  ONE_EYRIE_MODAL_FOOTER,
  ONE_EYRIE_MODAL_HEADER,
  ONE_EYRIE_MODAL_OVERLAY,
} from "@/app/lib/one-eyrie-modal-styles";
import { ONE_EYRIE } from "@/app/lib/oneEyrieColors";
import {
  forestHoverHandlers,
  NEUTRAL_BUTTON,
  neutralHoverHandlers,
  START_WORK_BUTTON,
  SECONDARY_BUTTON,
} from "@/app/lib/oneEyrieButtons";

export type LostFoundAddItemFormData = {
  item_name: string;
  guest_last_name: string;
  room_number: string;
  other_location: string;
  found_by: string;
  status: string;
  comments: string;
};

type LostFoundAddItemModalProps = {
  open: boolean;
  defaultFoundBy: string;
  onClose: () => void;
  onSubmit: (data: LostFoundAddItemFormData, keepOpen: boolean) => Promise<boolean>;
};

const EMPTY_FORM: LostFoundAddItemFormData = {
  item_name: "",
  guest_last_name: "",
  room_number: "",
  other_location: "",
  found_by: "",
  status: "Stored",
  comments: "",
};

const fieldLabel: React.CSSProperties = {
  display: "block",
  color: ONE_EYRIE.textSubtle,
  fontSize: "12px",
  fontWeight: 700,
  marginBottom: "6px",
};

const fieldInput: React.CSSProperties = {
  width: "100%",
  boxSizing: "border-box",
  outline: "none",
};

export function combineLostFoundLocation(roomNumber: string, otherLocation: string): string {
  const room = roomNumber.trim();
  const other = otherLocation.trim();
  if (room && other) return `${room} · ${other}`;
  return room || other;
}

export default function LostFoundAddItemModal({
  open,
  defaultFoundBy,
  onClose,
  onSubmit,
}: LostFoundAddItemModalProps) {
  const [form, setForm] = useState<LostFoundAddItemFormData>(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setForm({
      ...EMPTY_FORM,
      found_by: defaultFoundBy,
    });
    setError(null);
    setSubmitting(false);
  }, [open, defaultFoundBy]);

  if (!open) return null;

  function updateField<K extends keyof LostFoundAddItemFormData>(
    key: K,
    value: LostFoundAddItemFormData[K]
  ) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function handleSubmit(keepOpen: boolean) {
    const itemName = form.item_name.trim();
    const guestLastName = form.guest_last_name.trim();
    const location = combineLostFoundLocation(form.room_number, form.other_location);

    if (!itemName) {
      setError("Item name is required.");
      return;
    }

    if (!guestLastName) {
      setError("Guest last name is required.");
      return;
    }

    if (!location) {
      setError("Enter a room number or other location.");
      return;
    }

    setError(null);
    setSubmitting(true);

    const success = await onSubmit(
      {
        ...form,
        item_name: itemName,
        guest_last_name: guestLastName,
        room_number: form.room_number.trim(),
        other_location: form.other_location.trim(),
        found_by: form.found_by.trim(),
        comments: form.comments.trim(),
      },
      keepOpen
    );

    setSubmitting(false);

    if (!success) return;

    if (keepOpen) {
      setForm({
        ...EMPTY_FORM,
        found_by: form.found_by.trim() || defaultFoundBy,
        status: form.status,
      });
    }
  }

  return (
    <div style={ONE_EYRIE_MODAL_OVERLAY} onClick={onClose}>
      <div
        className="one-eyrie-modal"
        style={{ ...ONE_EYRIE_MODAL_BOX, width: "520px" }}
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="lost-found-add-item-title"
      >
        <div style={ONE_EYRIE_MODAL_HEADER}>
          <h2 id="lost-found-add-item-title" style={{ margin: 0, color: ONE_EYRIE.gold }}>
            Add Lost Item
          </h2>
          <button
            type="button"
            onClick={onClose}
            style={ONE_EYRIE_MODAL_CLOSE_BUTTON}
            aria-label="Close"
            disabled={submitting}
          >
            <X size={22} />
          </button>
        </div>

        <form
          onSubmit={(event) => {
            event.preventDefault();
            void handleSubmit(false);
          }}
          style={{ display: "flex", flexDirection: "column", gap: "14px" }}
        >
          <label>
            <span style={fieldLabel}>Item Name</span>
            <input
              value={form.item_name}
              onChange={(event) => updateField("item_name", event.target.value)}
              placeholder="e.g. Black wallet"
              required
              className="one-eyrie-field"
              style={fieldInput}
              autoFocus
            />
          </label>

          <label>
            <span style={fieldLabel}>Guest Last Name</span>
            <input
              value={form.guest_last_name}
              onChange={(event) => updateField("guest_last_name", event.target.value)}
              placeholder="Guest last name"
              required
              className="one-eyrie-field"
              style={fieldInput}
            />
          </label>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: "12px",
            }}
          >
            <label>
              <span style={fieldLabel}>Room #</span>
              <input
                value={form.room_number}
                onChange={(event) => updateField("room_number", event.target.value)}
                placeholder="e.g. 204"
                className="one-eyrie-field"
                style={fieldInput}
              />
            </label>

            <label>
              <span style={fieldLabel}>Location / Other Location</span>
              <input
                value={form.other_location}
                onChange={(event) => updateField("other_location", event.target.value)}
                placeholder="e.g. Pool, Lobby"
                className="one-eyrie-field"
                style={fieldInput}
              />
            </label>
          </div>

          <label>
            <span style={fieldLabel}>Found By</span>
            <input
              value={form.found_by}
              onChange={(event) => updateField("found_by", event.target.value)}
              placeholder="Team member name"
              className="one-eyrie-field"
              style={fieldInput}
            />
          </label>

          <label>
            <span style={fieldLabel}>Status</span>
            <select
              value={form.status}
              onChange={(event) => updateField("status", event.target.value)}
              className="one-eyrie-field"
              style={fieldInput}
            >
              <option>Found</option>
              <option>Stored</option>
              <option>Awaiting Guest Payment</option>
              <option>Label sent</option>
              <option>Ready to be shipped</option>
              <option>Shipped</option>
              <option>Delivered</option>
              <option>Discarded</option>
            </select>
          </label>

          <label>
            <span style={fieldLabel}>Comments (optional)</span>
            <textarea
              value={form.comments}
              onChange={(event) => updateField("comments", event.target.value)}
              placeholder="Add any notes about this item..."
              rows={3}
              className="one-eyrie-field"
              style={{ ...fieldInput, resize: "vertical", lineHeight: 1.45 }}
            />
          </label>

          {error ? (
            <p style={{ margin: 0, color: "#f87171", fontSize: "13px", fontWeight: 600 }}>
              {error}
            </p>
          ) : null}

          <div style={ONE_EYRIE_MODAL_FOOTER} className="one-eyrie-modal-footer--wrap">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              style={{
                ...NEUTRAL_BUTTON,
                opacity: submitting ? 0.6 : 1,
                cursor: submitting ? "not-allowed" : "pointer",
              }}
              className="one-eyrie-btn one-eyrie-btn--neutral one-eyrie-btn--md"
              {...neutralHoverHandlers(submitting)}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => void handleSubmit(true)}
              disabled={submitting}
              style={{
                ...SECONDARY_BUTTON,
                opacity: submitting ? 0.6 : 1,
                cursor: submitting ? "not-allowed" : "pointer",
              }}
            >
              Save and add another
            </button>
            <button
              type="submit"
              disabled={submitting}
              style={{
                ...START_WORK_BUTTON,
                opacity: submitting ? 0.6 : 1,
                cursor: submitting ? "not-allowed" : "pointer",
              }}
              className="one-eyrie-btn one-eyrie-btn--start-work one-eyrie-btn--lg"
              {...forestHoverHandlers(submitting)}
            >
              Add Item
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
