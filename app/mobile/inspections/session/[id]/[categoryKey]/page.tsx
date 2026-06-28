"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import CreateWorkOrderButton from "@/app/maintenance/components/CreateWorkOrderButton";
import WorkOrderModal, {
  WorkOrderModalInitialValues,
} from "@/app/maintenance/components/WorkOrderModal";
import MobileInspectionItemCard from "../../../components/MobileInspectionItemCard";
import MobileInspectionSessionFooter from "../../../components/MobileInspectionSessionFooter";
import {
  itemResponseKey,
  useMobileInspectionSession,
} from "../MobileInspectionSessionProvider";

export default function MobileInspectionCategoryPage() {
  const params = useParams<{ id: string; categoryKey: string }>();
  const categoryKey = params.categoryKey;
  const sessionId = params.id;

  const {
    loading,
    content,
    roomName,
    templateName,
    areaId,
    inspectorName,
    responses,
    notes,
    photos,
    uploadingKeys,
    setOutcome,
    setItemNotes,
    uploadItemPhoto,
    removeItemPhoto,
    categoryProgress,
  } = useMobileInspectionSession();

  const [itemIndex, setItemIndex] = useState(0);
  const [workOrderModalOpen, setWorkOrderModalOpen] = useState(false);
  const [workOrderInitial, setWorkOrderInitial] = useState<
    WorkOrderModalInitialValues | undefined
  >(undefined);

  const category = useMemo(
    () => content?.categories.find((entry) => entry.key === categoryKey) ?? null,
    [content, categoryKey]
  );

  const items = category?.items ?? [];
  const currentItem = items[itemIndex] ?? null;
  const progress = categoryProgress(categoryKey);

  useEffect(() => {
    setItemIndex(0);
  }, [categoryKey]);

  useEffect(() => {
    if (itemIndex > 0 && itemIndex >= items.length) {
      setItemIndex(Math.max(0, items.length - 1));
    }
  }, [itemIndex, items.length]);

  if (loading) {
    return (
      <div className="one-eyrie-mobile__inner">
        <div className="one-eyrie-mobile-status">Loading category…</div>
      </div>
    );
  }

  if (!category || !currentItem) {
    return (
      <div className="one-eyrie-mobile__inner one-eyrie-mobile-inspection-session">
        <Link
          href={`/mobile/inspections/session/${sessionId}`}
          className="one-eyrie-mobile-back"
        >
          ← Categories
        </Link>
        <div className="one-eyrie-mobile-status">Category not found.</div>
      </div>
    );
  }

  const responseKey = itemResponseKey(categoryKey, currentItem.key);
  const outcome = responses[responseKey];
  const categoryName = category.name.en;

  function goToNextItem() {
    if (itemIndex < items.length - 1) {
      setItemIndex(itemIndex + 1);
    }
  }

  function goToPreviousItem() {
    if (itemIndex > 0) {
      setItemIndex(itemIndex - 1);
    }
  }

  function handleOutcomeChange(value: "pass" | "fail" | "na") {
    setOutcome(categoryKey, currentItem.key, value);
    if (value !== "fail" && itemIndex < items.length - 1) {
      window.setTimeout(() => setItemIndex(itemIndex + 1), 180);
    }
  }

  return (
    <div className="one-eyrie-mobile__inner one-eyrie-mobile-inspection-session">
      <Link
        href={`/mobile/inspections/session/${sessionId}`}
        className="one-eyrie-mobile-back"
      >
        ← Categories
      </Link>

      <header className="one-eyrie-mobile-inspection-session__header">
        <div className="one-eyrie-mobile-inspection-session__room">{roomName || "—"}</div>
        <div className="one-eyrie-mobile-inspection-session__meta">{categoryName}</div>
        <div className="one-eyrie-mobile-inspection-session__progress">
          Item {itemIndex + 1} of {items.length} · {progress.answered}/{progress.total} answered
        </div>
      </header>

      <MobileInspectionItemCard
        item={currentItem}
        outcome={outcome}
        notes={notes[responseKey] || ""}
        photoUrl={photos[responseKey] || null}
        uploading={Boolean(uploadingKeys[responseKey])}
        onOutcomeChange={handleOutcomeChange}
        onNotesChange={(value) => setItemNotes(categoryKey, currentItem.key, value)}
        onPhotoSelect={(file) => void uploadItemPhoto(categoryKey, currentItem.key, file)}
        onPhotoRemove={() => removeItemPhoto(categoryKey, currentItem.key)}
        workOrderButton={
          <CreateWorkOrderButton
            compact
            onOpen={(initial) => {
              setWorkOrderInitial(initial);
              setWorkOrderModalOpen(true);
            }}
            initialValues={{
              subject: `Inspection fail: ${currentItem.label.en}`,
              description: notes[responseKey] || "",
              priority: "Important",
              area_id: areaId,
              area_label: roomName ? `Room ${roomName}` : null,
              source_module: "Inspections",
              source_record_id: String(sessionId),
              source_note: `${templateName} · ${categoryName} · ${currentItem.label.en}${
                notes[responseKey] ? ` — ${notes[responseKey]}` : ""
              }`,
              created_by: inspectorName,
            }}
          />
        }
      />

      <div className="one-eyrie-mobile-inspection-item-nav">
        <button
          type="button"
          className="one-eyrie-mobile-btn one-eyrie-mobile-btn--ghost"
          disabled={itemIndex === 0}
          onClick={goToPreviousItem}
        >
          Previous
        </button>
        <button
          type="button"
          className="one-eyrie-mobile-btn one-eyrie-mobile-btn--ghost"
          disabled={itemIndex >= items.length - 1}
          onClick={goToNextItem}
        >
          Next
        </button>
      </div>

      <MobileInspectionSessionFooter />

      <WorkOrderModal
        open={workOrderModalOpen}
        initialValues={workOrderInitial}
        createdBy={inspectorName}
        onClose={() => setWorkOrderModalOpen(false)}
        onCreated={() => setWorkOrderModalOpen(false)}
      />
    </div>
  );
}
