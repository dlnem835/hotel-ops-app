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
import { classifyWorkOrderItemIssue } from "@/app/maintenance/lib/work-order-item-issues";
import {
  getInspectionItemGuidance,
  isGuidedInspectionTemplate,
} from "@/app/inspections/lib/inspection-guidance-ui";

export default function MobileInspectionCategoryPage() {
  const params = useParams<{ id: string; categoryKey: string }>();
  const categoryKey = params.categoryKey;
  const sessionId = params.id;

  const {
    loading,
    content,
    roomName,
    templateName,
    templateStandardKey,
    program,
    areaId,
    inspectorName,
    responses,
    notes,
    photos,
    uploadingKeys,
    setOutcome,
    clearOutcome,
    setItemNotes,
    uploadItemPhoto,
    removeItemPhoto,
    categoryProgress,
  } = useMobileInspectionSession();

  const [workOrderModalOpen, setWorkOrderModalOpen] = useState(false);
  const [expandedGuidanceItemKey, setExpandedGuidanceItemKey] = useState<string | null>(null);
  const [workOrderInitial, setWorkOrderInitial] = useState<
    WorkOrderModalInitialValues | undefined
  >(undefined);

  const category = useMemo(
    () => content?.categories.find((entry) => entry.key === categoryKey) ?? null,
    [content, categoryKey]
  );

  const items = category?.items ?? [];
  const progress = categoryProgress(categoryKey);
  const hasGuidedInspectionUx = isGuidedInspectionTemplate(
    templateStandardKey,
    templateName
  );

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
          const guidance = hasGuidedInspectionUx
            ? getInspectionItemGuidance(
                templateStandardKey,
                templateName,
                categoryKey,
                item.key
              )
            : null;

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
              displayGuidance={
                guidance
                  ? {
                      label: guidance.label,
                      inspect: guidance.inspect,
                      expanded: expandedGuidanceItemKey === item.key,
                      onToggle: () =>
                        setExpandedGuidanceItemKey((current) =>
                          current === item.key ? null : item.key
                        ),
                    }
                  : undefined
              }
              onOutcomeChange={(value) => {
                if (hasGuidedInspectionUx && outcome === value) {
                  clearOutcome(categoryKey, item.key);
                  return;
                }
                setOutcome(categoryKey, item.key, value);
              }}
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
                    item: classifyWorkOrderItemIssue({
                      structuredItem: item.label.en,
                      description: notes[responseKey],
                    }),
                    priority: "Important",
                    area_id: areaId,
                    area_label: roomName ? `Room ${roomName}` : null,
                    source_module:
                      program === "RPM" ? "RPM Inspection" : "Room Inspection",
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
