"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useMemo, useState } from "react";
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

  const [workOrderModalOpen, setWorkOrderModalOpen] = useState(false);
  const [workOrderInitial, setWorkOrderInitial] = useState<
    WorkOrderModalInitialValues | undefined
  >(undefined);

  const category = useMemo(
    () => content?.categories.find((entry) => entry.key === categoryKey) ?? null,
    [content, categoryKey]
  );

  const items = category?.items ?? [];
  const progress = categoryProgress(categoryKey);

  if (loading) {
    return (
      <div className="one-eyrie-mobile__inner">
        <div className="one-eyrie-mobile-status">Loading category…</div>
      </div>
    );
  }

  if (!category) {
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

  const categoryName = category.name.en;

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
          {progress.answered}/{progress.total} answered
        </div>
      </header>

      <div className="one-eyrie-mobile-inspection-category-items">
        {items.map((item) => {
          const responseKey = itemResponseKey(categoryKey, item.key);
          const outcome = responses[responseKey];

          return (
            <div
              key={item.key}
              id={`mobile-inspection-item-${categoryKey}-${item.key}`}
            >
              <MobileInspectionItemCard
              item={item}
              outcome={outcome}
              notes={notes[responseKey] || ""}
              photoUrl={photos[responseKey] || null}
              uploading={Boolean(uploadingKeys[responseKey])}
              onOutcomeChange={(value) => setOutcome(categoryKey, item.key, value)}
              onNotesChange={(value) => setItemNotes(categoryKey, item.key, value)}
              onPhotoSelect={(file) => void uploadItemPhoto(categoryKey, item.key, file)}
              onPhotoRemove={() => removeItemPhoto(categoryKey, item.key)}
              workOrderButton={
                <CreateWorkOrderButton
                  compact
                  onOpen={(initial) => {
                    setWorkOrderInitial(initial);
                    setWorkOrderModalOpen(true);
                  }}
                  initialValues={{
                    subject: "",
                    description: "",
                    priority: "Important",
                    area_id: areaId,
                    area_label: roomName ? `Room ${roomName}` : null,
                    source_module: "Inspections",
                    source_record_id: String(sessionId),
                    source_note: `${templateName} · ${categoryName} · ${item.label.en}${
                      notes[responseKey] ? ` — ${notes[responseKey]}` : ""
                    }`,
                    photo_url: photos[responseKey] || null,
                    created_by: inspectorName,
                  }}
                />
              }
            />
            </div>
          );
        })}
      </div>

      <MobileInspectionSessionFooter mode="category" categoryKey={categoryKey} />

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
