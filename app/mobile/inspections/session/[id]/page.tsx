"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import CompletedInspectionReview from "@/app/inspections/components/CompletedInspectionReview";
import { useMobileInspectionSession } from "./MobileInspectionSessionProvider";
import MobileInspectionSessionFooter from "../../components/MobileInspectionSessionFooter";

export default function MobileInspectionSessionHubPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const sessionId = params.id;

  const {
    loading,
    content,
    roomName,
    templateName,
    program,
    associateName,
    inspectorName,
    answeredItems,
    totalItems,
    scoreLabel,
    scorePointsLabel,
    isCompleted,
    completedAt,
    earnedPoints,
    possiblePoints,
    scorePercent,
    sessionNotes,
    setSessionNotes,
    responses,
    notes,
    photos,
    categoryProgress,
  } = useMobileInspectionSession();

  if (loading) {
    return (
      <div className="one-eyrie-mobile__inner">
        <div className="one-eyrie-mobile-status">Loading inspection…</div>
      </div>
    );
  }

  if (isCompleted && content) {
    return (
      <div className="one-eyrie-mobile__inner one-eyrie-mobile-inspection-session">
        <CompletedInspectionReview
          roomName={roomName}
          templateName={templateName}
          program={program}
          completedAt={completedAt}
          inspectorName={inspectorName}
          associateName={associateName}
          scorePercent={scorePercent}
          earnedPoints={earnedPoints}
          possiblePoints={possiblePoints}
          sessionNotes={sessionNotes || null}
          content={content}
          responses={responses}
          notes={notes}
          photos={photos}
          isMobileLayout
          expandedCategoryKey={null}
          onToggleCategory={() => undefined}
          onBack={() => router.push("/mobile/inspections")}
          backLabel="Back to inspections"
        />
      </div>
    );
  }

  return (
    <div className="one-eyrie-mobile__inner one-eyrie-mobile-inspection-session">
      <Link href="/mobile/inspections" className="one-eyrie-mobile-back">
        ← Inspections
      </Link>

      <header className="one-eyrie-mobile-inspection-session__header">
        <div className="one-eyrie-mobile-inspection-session__room">{roomName || "—"}</div>
        <div className="one-eyrie-mobile-inspection-session__meta">
          {associateName ? `${associateName} · ` : ""}
          {templateName}
        </div>
        <div className="one-eyrie-mobile-inspection-session__progress">
          {answeredItems}/{totalItems} items
          {scoreLabel ? ` · ${scoreLabel}` : ""}
          {scorePointsLabel ? ` (${scorePointsLabel})` : ""}
        </div>
      </header>

      <div className="one-eyrie-mobile-inspection-category-grid">
        {content?.categories.map((category) => {
          const progress = categoryProgress(category.key);
          return (
            <Link
              key={category.key}
              href={`/mobile/inspections/session/${sessionId}/${category.key}`}
              className={`one-eyrie-mobile-inspection-category-tile${
                progress.complete ? " one-eyrie-mobile-inspection-category-tile--complete" : ""
              }`}
            >
              <span className="one-eyrie-mobile-inspection-category-tile__name">
                {category.name.en}
              </span>
              <span className="one-eyrie-mobile-inspection-category-tile__count">
                {progress.answered}/{progress.total}
              </span>
            </Link>
          );
        })}
      </div>

      <label className="one-eyrie-mobile-field one-eyrie-mobile-inspection-session__notes">
        <span>Session notes</span>
        <textarea
          rows={3}
          value={sessionNotes}
          onChange={(event) => setSessionNotes(event.target.value)}
        />
      </label>

      <MobileInspectionSessionFooter showNotes={false} />
    </div>
  );
}
