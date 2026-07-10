"use client";

import { useEffect, useMemo, useState } from "react";
import { X } from "lucide-react";
import { forestHoverHandlers, PRIMARY_BUTTON } from "@/app/settings/lib/settings-ui-interactions";
import { BuildingArea } from "@/app/settings/lib/buildings-types";
import { WorkOrderInput, WorkOrderPriority } from "../lib/maintenance-types";
import { WORK_ORDER_CATEGORIES, WorkOrderCategory } from "../lib/work-order-categories";
import {
  buildWorkOrderLocationOptions,
  inferInitialLocationSelection,
  resolveWorkOrderLocationFromSelection,
} from "../lib/work-order-location";
import WorkOrderLocationField from "./WorkOrderLocationField";
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
  const [category, setCategory] = useState<WorkOrderCategory | "">("");
  const [item, setItem] = useState("");
  const [priority, setPriority] = useState<WorkOrderPriority>("Normal");
  const [selectedLocationId, setSelectedLocationId] = useState<number | null>(null);
  const [selectedLocationLabel, setSelectedLocationLabel] = useState("");
  const [customLocation, setCustomLocation] = useState("");
  const [areas, setAreas] = useState<BuildingArea[]>([]);
  const [areasLoading, setAreasLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  const activeAreas = useMemo(
    () => areas.filter((area) => area.status === "Active"),
    [areas]
  );
  const locationOptions = useMemo(
    () => buildWorkOrderLocationOptions(areas),
    [areas]
  );

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

    setSubject(initialValues?.subject ?? "");
    setDescription(
      initialValues?.description !== undefined && initialValues?.description !== null
        ? initialValues.description
        : initialValues?.source_note || ""
    );
    setCategory(initialValues?.category || "");
    setItem(initialValues?.item || "");
    setPriority(initialValues?.priority || "Normal");
    setPhotoUrl(initialValues?.photo_url ?? null);
    setUploadingPhoto(false);
    setError(null);

    const selection = inferInitialLocationSelection(
      areas,
      initialValues?.area_id ?? null,
      initialValues?.area_label ?? null
    );
    setSelectedLocationId(selection.selectedLocationId);
    setSelectedLocationLabel(selection.selectedLocationLabel);
    setCustomLocation(selection.customLocation);
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

  function handleLocationSelect(id: number, label: string) {
    setSelectedLocationId(id);
    setSelectedLocationLabel(label);
    setCustomLocation("");
  }

  function handleLocationClear() {
    setSelectedLocationId(null);
    setSelectedLocationLabel("");
  }

  function handleCustomLocationChange(value: string) {
    setCustomLocation(value);
    if (value.trim()) {
      setSelectedLocationId(null);
      setSelectedLocationLabel("");
    }
  }

  async function handleSubmit() {
    if (!subject.trim()) {
      setError("Work order title is required.");
      return;
    }

    const location = resolveWorkOrderLocationFromSelection({
      selectedLocationId,
      customLocation,
      areas: activeAreas,
    });
    if (!location.area_id && !location.area_label) {
      setError("Location or custom location is required.");
      return;
    }

    if (!category) {
      setError("Category is required.");
      return;
    }

    if (!description.trim()) {
      setError("Details are required.");
      return;
    }

    setSaving(true);
    setError(null);

    const payload: WorkOrderInput = {
      subject: subject.trim(),
      description: description.trim(),
      category,
      item: item.trim() || null,
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
    <div className="work-order-modal-overlay one-eyrie-modal-overlay" onClick={onClose}>
      <div
        className="work-order-modal one-eyrie-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="work-order-modal-title"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="work-order-modal__header one-eyrie-modal__header">
          <div className="one-eyrie-modal__header-main">
            <h2 id="work-order-modal-title" className="work-order-modal__title one-eyrie-modal__title">
              New Work Order
            </h2>
            <p className="work-order-modal__subtitle">
              Guest-impacting maintenance issue
              {initialValues?.source_module
                ? ` · from ${initialValues.source_module}`
                : ""}
            </p>
          </div>
          <button
            type="button"
            className="one-eyrie-modal__close one-eyrie-modal__close--desktop-only"
            onClick={onClose}
            aria-label="Close"
          >
            <X size={22} />
          </button>
        </header>

        <div className="work-order-modal__content">
          {error ? <div className="work-order-modal__error">{error}</div> : null}

          <div className="work-order-modal__form">
            <label className="work-order-modal__field work-order-modal__field--full">
              <span className="work-order-modal__label">Work Order Title</span>
              <input
                className="work-order-modal__input"
                value={subject}
                onChange={(event) => setSubject(event.target.value)}
                placeholder="Example: Refrigerator not cooling"
              />
            </label>

            <div className="work-order-modal__field work-order-modal__field--full">
              <span className="work-order-modal__label">Location</span>
              <WorkOrderLocationField
                options={locationOptions}
                loading={areasLoading}
                selectedId={selectedLocationId}
                selectedLabel={selectedLocationLabel}
                onSelect={handleLocationSelect}
                onClearSelection={handleLocationClear}
                disabled={saving}
              />
            </div>

            <label className="work-order-modal__field work-order-modal__field--full">
              <span className="work-order-modal__label">Custom Location (optional)</span>
              <input
                className="work-order-modal__input"
                value={customLocation}
                onChange={(event) => handleCustomLocationChange(event.target.value)}
                placeholder="If location is not listed"
              />
            </label>

            <label className="work-order-modal__field">
              <span className="work-order-modal__label">Category</span>
              <select
                className="work-order-modal__select"
                value={category}
                onChange={(event) =>
                  setCategory(event.target.value as WorkOrderCategory | "")
                }
              >
                <option value="">Select category…</option>
                {WORK_ORDER_CATEGORIES.map((entry) => (
                  <option key={entry} value={entry}>
                    {entry}
                  </option>
                ))}
              </select>
            </label>

            <label className="work-order-modal__field">
              <span className="work-order-modal__label">Item</span>
              <input
                className="work-order-modal__input"
                value={item}
                onChange={(event) => setItem(event.target.value)}
                placeholder="Example: Toilet, PTAC, TV, refrigerator"
              />
            </label>

            <label className="work-order-modal__field">
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

            <label className="work-order-modal__field work-order-modal__field--full">
              <span className="work-order-modal__label">Details</span>
              <textarea
                className="work-order-modal__textarea"
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                placeholder="Describe the issue"
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
              height: "38px",
              padding: "0 16px",
              fontSize: "13px",
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
