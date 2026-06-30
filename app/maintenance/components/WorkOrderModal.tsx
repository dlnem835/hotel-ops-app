"use client";

import { useEffect, useMemo, useState } from "react";
import { forestHoverHandlers, PRIMARY_BUTTON } from "@/app/settings/lib/settings-ui-interactions";
import { BuildingArea } from "@/app/settings/lib/buildings-types";
import { WorkOrderInput, WorkOrderPriority } from "../lib/maintenance-types";
import {
  getActiveGuestRooms,
  getGroupedNonGuestAreas,
  inferInitialLocationSelection,
  resolveWorkOrderLocation,
} from "../lib/work-order-location";
import WorkOrderPhotoField from "./WorkOrderPhotoField";
import "./work-order-modal.css";

export type WorkOrderModalInitialValues = Partial<WorkOrderInput> & {
  subject?: string;
};

type WorkOrderModalProps = {
  open: boolean;
  initialValues?: WorkOrderModalInitialValues;
  createdBy?: string | null;
  onClose: () => void;
  onCreated?: () => void;
};

export default function WorkOrderModal({
  open,
  initialValues,
  createdBy,
  onClose,
  onCreated,
}: WorkOrderModalProps) {
  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<WorkOrderPriority>("Normal");
  const [selectedRoomId, setSelectedRoomId] = useState<number | null>(null);
  const [selectedAreaId, setSelectedAreaId] = useState<number | null>(null);
  const [otherLocation, setOtherLocation] = useState("");
  const [areas, setAreas] = useState<BuildingArea[]>([]);
  const [areasLoading, setAreasLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  const guestRooms = useMemo(() => getActiveGuestRooms(areas), [areas]);
  const groupedAreas = useMemo(() => getGroupedNonGuestAreas(areas), [areas]);
  const nonGuestAreas = useMemo(
    () => groupedAreas.flatMap((group) => group.areas),
    [groupedAreas]
  );

  const showOtherLocation = !selectedRoomId && !selectedAreaId;

  useEffect(() => {
    if (!open) return;

    async function loadAreas() {
      setAreasLoading(true);
      const response = await fetch("/api/buildings-areas");
      const result = await response.json();
      setAreasLoading(false);

      if (response.ok) {
        setAreas(result.areas || []);
      }
    }

    void loadAreas();
  }, [open]);

  useEffect(() => {
    if (!open) return;

    setSubject(initialValues?.subject || "");
    setDescription(
      initialValues?.description || initialValues?.source_note || ""
    );
    setPriority(initialValues?.priority || "Normal");
    setPhotoUrl(initialValues?.photo_url ?? null);
    setUploadingPhoto(false);
    setError(null);

    const selection = inferInitialLocationSelection(
      areas,
      initialValues?.area_id ?? null,
      initialValues?.area_label ?? null
    );
    setSelectedRoomId(selection.selectedRoomId);
    setSelectedAreaId(selection.selectedAreaId);
    setOtherLocation(selection.otherLocation);
  }, [open, initialValues, areas]);

  if (!open) return null;

  async function handlePhotoSelect(file: File) {
    setUploadingPhoto(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch("/api/work-orders/photo", {
        method: "POST",
        body: formData,
      });
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Unable to upload photo");
      }

      setPhotoUrl(result.photoUrl as string);
    } catch (uploadError) {
      setPhotoUrl(null);
      setError(
        uploadError instanceof Error ? uploadError.message : "Unable to upload photo"
      );
    } finally {
      setUploadingPhoto(false);
    }
  }

  async function handleSubmit() {
    if (!subject.trim()) {
      setError("Subject is required.");
      return;
    }

    setSaving(true);
    setError(null);

    const location = resolveWorkOrderLocation({
      selectedRoomId,
      selectedAreaId,
      otherLocation,
      rooms: guestRooms,
      areas: nonGuestAreas,
    });

    const payload: WorkOrderInput = {
      subject: subject.trim(),
      description: description.trim() || null,
      priority,
      area_id: location.area_id,
      area_label: location.area_label,
      source_module: initialValues?.source_module ?? "Maintenance",
      source_record_id: initialValues?.source_record_id ?? null,
      source_note: initialValues?.source_note ?? null,
      photo_url: photoUrl,
      created_by: createdBy || initialValues?.created_by || null,
    };

    const response = await fetch("/api/work-orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const result = await response.json();
    setSaving(false);

    if (!response.ok) {
      setError(result.error || "Unable to create work order.");
      return;
    }

    onCreated?.();
    onClose();
  }

  const submitDisabled = saving || uploadingPhoto;

  return (
    <div className="work-order-modal-overlay" onClick={onClose}>
      <div
        className="work-order-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="work-order-modal-title"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="work-order-modal__header">
          <h2 id="work-order-modal-title" className="work-order-modal__title">
            New Work Order
          </h2>
          <p className="work-order-modal__subtitle">
            Guest-impacting maintenance issue
            {initialValues?.source_module
              ? ` · from ${initialValues.source_module}`
              : ""}
          </p>
        </header>

        <div className="work-order-modal__content">
          {error ? <div className="work-order-modal__error">{error}</div> : null}

          <div
            className={`work-order-modal__form${
              showOtherLocation ? " work-order-modal__form--with-other" : ""
            }`}
          >
            <label className="work-order-modal__field work-order-modal__field--full">
              <span className="work-order-modal__label">Subject</span>
              <input
                className="work-order-modal__input"
                value={subject}
                onChange={(event) => setSubject(event.target.value)}
                placeholder="Brief issue summary"
              />
            </label>

            <label className="work-order-modal__field">
              <span className="work-order-modal__label">Room</span>
              <select
                className="work-order-modal__select"
                value={selectedRoomId ?? ""}
                onChange={(event) => {
                  const value = event.target.value ? Number(event.target.value) : null;
                  setSelectedRoomId(value);
                  if (value) {
                    setSelectedAreaId(null);
                    setOtherLocation("");
                  }
                }}
                disabled={areasLoading}
              >
                <option value="">Select room…</option>
                {guestRooms.map((room) => (
                  <option key={room.id} value={room.id}>
                    Room {room.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="work-order-modal__field">
              <span className="work-order-modal__label">Area</span>
              <select
                className="work-order-modal__select"
                value={selectedAreaId ?? ""}
                onChange={(event) => {
                  const value = event.target.value ? Number(event.target.value) : null;
                  setSelectedAreaId(value);
                  if (value) {
                    setSelectedRoomId(null);
                    setOtherLocation("");
                  }
                }}
                disabled={areasLoading}
              >
                <option value="">Select area…</option>
                {groupedAreas.map((group) => (
                  <optgroup key={group.key} label={group.label}>
                    {group.areas.map((area) => (
                      <option key={area.id} value={area.id}>
                        {area.name}
                        {area.area_type !== "Public Area"
                          ? ` · ${area.area_type}`
                          : ""}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </label>

            <label className="work-order-modal__field work-order-modal__field--priority">
              <span className="work-order-modal__label">Priority</span>
              <select
                className="work-order-modal__select"
                value={priority}
                onChange={(event) =>
                  setPriority(event.target.value as WorkOrderPriority)
                }
              >
                <option value="Normal">Normal</option>
                <option value="Important">Important</option>
                <option value="Urgent">Urgent</option>
              </select>
            </label>

            {showOtherLocation ? (
              <label className="work-order-modal__field work-order-modal__field--full">
                <span className="work-order-modal__label">Other location</span>
                <input
                  className="work-order-modal__input"
                  value={otherLocation}
                  onChange={(event) => setOtherLocation(event.target.value)}
                  placeholder="If room/area is not listed"
                />
              </label>
            ) : null}

            <label className="work-order-modal__field work-order-modal__field--full">
              <span className="work-order-modal__label">Details</span>
              <textarea
                className="work-order-modal__textarea"
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                placeholder="What needs to be fixed?"
                rows={2}
              />
            </label>

            <div className="work-order-modal__photo work-order-modal__photo-field">
              <WorkOrderPhotoField
                compact
                photoUrl={photoUrl}
                uploading={uploadingPhoto}
                disabled={saving}
                onPhotoSelect={(file) => void handlePhotoSelect(file)}
                onPhotoRemove={() => setPhotoUrl(null)}
              />
            </div>
          </div>
        </div>

        <footer className="work-order-modal__footer">
          <button
            type="button"
            className="work-order-modal__btn work-order-modal__btn--cancel"
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            type="button"
            className="work-order-modal__btn work-order-modal__btn--submit"
            disabled={submitDisabled}
            onClick={() => void handleSubmit()}
            style={{
              ...PRIMARY_BUTTON,
              opacity: submitDisabled ? 0.6 : 1,
              cursor: submitDisabled ? "not-allowed" : "pointer",
            }}
            {...forestHoverHandlers(submitDisabled)}
          >
            {saving ? "Creating…" : "Create Work Order"}
          </button>
        </footer>
      </div>
    </div>
  );
}
