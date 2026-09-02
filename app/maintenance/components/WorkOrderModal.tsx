"use client";

import { useEffect, useMemo, useState } from "react";
import { X } from "lucide-react";
import { forestHoverHandlers, PRIMARY_BUTTON } from "@/app/settings/lib/settings-ui-interactions";
import { BuildingArea } from "@/app/settings/lib/buildings-types";
import { WorkOrderInput, WorkOrderPriority } from "../lib/maintenance-types";
import {
  classifyWorkOrderItemIssue,
  isWorkOrderItemIssue,
  WORK_ORDER_ITEM_ISSUES,
  type WorkOrderItemIssue,
} from "../lib/work-order-item-issues";
import {
  buildWorkOrderLocationOptions,
  inferInitialLocationSelection,
  resolveWorkOrderLocationFromSelection,
} from "../lib/work-order-location";
import WorkOrderLocationField from "./WorkOrderLocationField";
import WorkOrderPhotoField from "./WorkOrderPhotoField";
import WorkOrderDuplicateWarningModal from "./WorkOrderDuplicateWarningModal";
import { uploadWorkOrderPhoto } from "@/app/maintenance/lib/work-order-photo-upload";
import type { DuplicateWorkOrderCandidate } from "@/app/maintenance/lib/work-order-duplicate-types";
import { tenantFetch } from "@/app/lib/tenant/tenant-fetch";
import { useModalScrollLock } from "@/app/lib/use-modal-scroll-lock";
import "./work-order-modal.css";

export type WorkOrderModalInitialValues = Partial<WorkOrderInput> & {
  subject?: string;
  lock_location?: boolean;
};

type WorkOrderModalProps = {
  open: boolean;
  initialValues?: WorkOrderModalInitialValues;
  createdBy?: string | null;
  onClose: () => void;
  onCreated?: () => void;
  onViewExistingWorkOrder?: (id: number) => void;
};

export default function WorkOrderModal({
  open,
  initialValues,
  createdBy,
  onClose,
  onCreated,
  onViewExistingWorkOrder,
}: WorkOrderModalProps) {
  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");
  const [item, setItem] = useState<WorkOrderItemIssue | "">("");
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
  const [duplicateCandidates, setDuplicateCandidates] = useState<
    DuplicateWorkOrderCandidate[]
  >([]);
  const [duplicateWarningOpen, setDuplicateWarningOpen] = useState(false);
  const [pendingPayload, setPendingPayload] = useState<WorkOrderInput | null>(null);
  useModalScrollLock(open);

  const locationEligibleAreas = useMemo(
    () =>
      areas.filter(
        (area) =>
          area.status === "Active" || area.status === "Out of Service"
      ),
    [areas]
  );
  const locationOptions = useMemo(
    () => buildWorkOrderLocationOptions(locationEligibleAreas),
    [locationEligibleAreas]
  );

  useEffect(() => {
    if (!open) return;

    async function loadAreas() {
      setAreasLoading(true);
      const response = await tenantFetch("/api/buildings-areas");
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

    const timeoutId = window.setTimeout(() => {
      setSubject(initialValues?.subject ?? "");
      setDescription(
        initialValues?.description !== undefined &&
          initialValues?.description !== null
          ? initialValues.description
          : initialValues?.source_note || ""
      );
      const initialItem = String(initialValues?.item || "").trim();
      setItem(
        isWorkOrderItemIssue(initialItem)
          ? initialItem
          : initialValues?.source_module
            ? classifyWorkOrderItemIssue({
                structuredItem: initialItem,
                description: initialValues.description,
                details: initialValues.source_note,
              })
            : ""
      );
      setPriority(initialValues?.priority || "Normal");
      setPhotoUrl(initialValues?.photo_url ?? null);
      setUploadingPhoto(false);
      setError(null);
      setDuplicateCandidates([]);
      setDuplicateWarningOpen(false);
      setPendingPayload(null);

      const selection = inferInitialLocationSelection(
        areas,
        initialValues?.area_id ?? null,
        initialValues?.area_label ?? null
      );
      setSelectedLocationId(selection.selectedLocationId);
      setSelectedLocationLabel(selection.selectedLocationLabel);
      setCustomLocation(selection.customLocation);
    }, 0);
    return () => window.clearTimeout(timeoutId);
  }, [open, initialValues, areas]);

  if (!open) return null;

  async function handlePhotoSelect(file: File) {
    setUploadingPhoto(true);
    setError(null);

    try {
      const uploadedUrl = await uploadWorkOrderPhoto(file);
      setPhotoUrl(uploadedUrl);
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

  async function createWorkOrder(payload: WorkOrderInput) {
    setSaving(true);
    setError(null);

    const response = await tenantFetch("/api/work-orders", {
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

    setDuplicateWarningOpen(false);
    setPendingPayload(null);
    setDuplicateCandidates([]);
    onCreated?.();
    onClose();
  }

  async function handleSubmit(options?: { skipDuplicateCheck?: boolean }) {
    if (!subject.trim()) {
      setError("Work order title is required.");
      return;
    }

    const location = initialValues?.lock_location
      ? {
          area_id: initialValues.area_id ?? null,
          area_label: initialValues.area_label?.trim() || null,
        }
      : resolveWorkOrderLocationFromSelection({
          selectedLocationId,
          customLocation,
          areas: locationEligibleAreas,
        });
    if (!location.area_id && !location.area_label) {
      setError("Location or custom location is required.");
      return;
    }

    if (!item) {
      setError("Item / Issue is required.");
      return;
    }

    if (!description.trim()) {
      setError("Details are required.");
      return;
    }

    const payload: WorkOrderInput = {
      subject: subject.trim(),
      description: description.trim(),
      category: initialValues?.category ?? null,
      item,
      priority,
      area_id: location.area_id,
      area_label: location.area_label,
      source_module: initialValues?.source_module ?? "Maintenance",
      source_record_id: initialValues?.source_record_id ?? null,
      source_note: initialValues?.source_note ?? null,
      photo_url: photoUrl,
      created_by: createdBy || initialValues?.created_by || null,
    };

    if (!options?.skipDuplicateCheck) {
      setSaving(true);
      setError(null);
      try {
        const dupResponse = await tenantFetch("/api/work-orders/duplicates", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            subject: payload.subject,
            description: payload.description,
            item: payload.item,
            area_id: payload.area_id,
            area_label: payload.area_label,
          }),
        });
        const dupResult = await dupResponse.json();
        if (
          dupResponse.ok &&
          Array.isArray(dupResult.candidates) &&
          dupResult.candidates.length > 0
        ) {
          setPendingPayload(payload);
          setDuplicateCandidates(dupResult.candidates);
          setDuplicateWarningOpen(true);
          setSaving(false);
          return;
        }
      } catch {
        // If duplicate check fails, continue with create (warning is non-blocking).
      }
    }

    await createWorkOrder(payload);
  }

  const submitDisabled = saving || uploadingPhoto;

  return (
    <>
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
              {initialValues?.lock_location ? (
                <div className="work-order-modal__input">
                  {initialValues.area_label || selectedLocationLabel}
                </div>
              ) : (
                <WorkOrderLocationField
                  options={locationOptions}
                  loading={areasLoading}
                  selectedId={selectedLocationId}
                  selectedLabel={selectedLocationLabel}
                  onSelect={handleLocationSelect}
                  onClearSelection={handleLocationClear}
                  disabled={saving}
                />
              )}
            </div>

            {!initialValues?.lock_location ? (
              <label className="work-order-modal__field work-order-modal__field--full">
                <span className="work-order-modal__label">
                  Custom Location (optional)
                </span>
                <input
                  className="work-order-modal__input"
                  value={customLocation}
                  onChange={(event) =>
                    handleCustomLocationChange(event.target.value)
                  }
                  placeholder="If location is not listed"
                />
              </label>
            ) : null}

            <label className="work-order-modal__field">
              <span className="work-order-modal__label">Item / Issue</span>
              <select
                className="work-order-modal__select"
                value={item}
                onChange={(event) =>
                  setItem(event.target.value as WorkOrderItemIssue | "")
                }
              >
                <option value="">Select item / issue…</option>
                {WORK_ORDER_ITEM_ISSUES.map((entry) => (
                  <option key={entry} value={entry}>
                    {entry}
                  </option>
                ))}
              </select>
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
    {duplicateWarningOpen ? (
      <WorkOrderDuplicateWarningModal
        candidates={duplicateCandidates}
        busy={saving}
        onCancel={() => {
          setDuplicateWarningOpen(false);
          setPendingPayload(null);
        }}
        onCreateAnyway={() => {
          if (pendingPayload) {
            void createWorkOrder(pendingPayload);
          } else {
            void handleSubmit({ skipDuplicateCheck: true });
          }
        }}
        onViewExisting={(id) => {
          setDuplicateWarningOpen(false);
          setPendingPayload(null);
          if (onViewExistingWorkOrder) {
            onViewExistingWorkOrder(id);
            return;
          }
          window.location.href = `/mobile/work-orders/${id}`;
        }}
      />
    ) : null}
    </>
  );
}
