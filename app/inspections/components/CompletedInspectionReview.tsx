"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, Calendar, Clock, Printer, Timer, User, Users } from "lucide-react";
import FailedItemDetails from "./FailedItemDetails";
import OutcomeBadge from "./OutcomeBadge";
import InspectionCategorySection from "./InspectionCategorySection";
import { AMBER, FLAT_RED, FOREST, NEUTRAL_PILL, ONE_EYRIE } from "@/app/lib/oneEyrieColors";
import { formatInspectionScoreDisplay } from "../lib/scoring";
import { PropertyTemplateContent } from "../standards/types";
import { SETTINGS_BUTTON_BASE } from "@/app/settings/lib/settings-ui-interactions";

type Outcome = "pass" | "fail" | "na";

type CompletedInspectionReviewProps = {
  roomName: string;
  templateName: string;
  program: string;
  completedAt: string | null;
  inspectorName: string | null;
  associateName: string | null;
  scorePercent: number | null;
  earnedPoints: number;
  possiblePoints: number;
  sessionNotes: string | null;
  content: PropertyTemplateContent;
  responses: Record<string, Outcome | undefined>;
  notes: Record<string, string>;
  photos: Record<string, string>;
  isMobileLayout: boolean;
  expandedCategoryKey: string | null;
  onToggleCategory: (key: string) => void;
  onBack: () => void;
  backLabel?: string;
  headerBadgeLabel?: string;
  startedAt?: string | null;
  durationLabel?: string | null;
  highlightItemKey?: string | null;
  /** Full-height scroll layout for embedded report viewer modals. */
  embeddedScrollLayout?: boolean;
  /** Show every checklist section expanded (report viewer). */
  expandAllCategories?: boolean;
};

function itemKey(categoryKey: string, itemKeyValue: string) {
  return `${categoryKey}::${itemKeyValue}`;
}

function formatReviewDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function scoreAccent(scorePercent: number | null): string {
  if (scorePercent === null) return ONE_EYRIE.text;
  if (scorePercent >= 90) return FOREST.text;
  if (scorePercent >= 80) return AMBER.text;
  return FLAT_RED.text;
}

export default function CompletedInspectionReview({
  roomName,
  templateName,
  program,
  completedAt,
  inspectorName,
  associateName,
  scorePercent,
  earnedPoints,
  possiblePoints,
  sessionNotes,
  content,
  responses,
  notes,
  photos,
  isMobileLayout,
  expandedCategoryKey,
  onToggleCategory,
  onBack,
  backLabel = "Back to dashboard",
  headerBadgeLabel = "Completed Inspection Review",
  startedAt = null,
  durationLabel = null,
  highlightItemKey = null,
  embeddedScrollLayout = false,
  expandAllCategories = false,
}: CompletedInspectionReviewProps) {
  const [failuresOnly, setFailuresOnly] = useState(false);
  const [showItemHighlight, setShowItemHighlight] = useState(Boolean(highlightItemKey));
  const bodyScrollRef = useRef<HTMLDivElement | null>(null);
  const highlightedItemRef = useRef<HTMLDivElement | null>(null);
  const hasScrolledToHighlightRef = useRef(false);

  useEffect(() => {
    if (!highlightItemKey) {
      setShowItemHighlight(false);
      hasScrolledToHighlightRef.current = false;
      return;
    }

    setShowItemHighlight(true);
    hasScrolledToHighlightRef.current = false;

    const fadeTimer = window.setTimeout(() => {
      setShowItemHighlight(false);
    }, 4000);

    return () => {
      window.clearTimeout(fadeTimer);
    };
  }, [highlightItemKey]);

  useEffect(() => {
    if (!highlightItemKey || hasScrolledToHighlightRef.current) return;

    const scrollTimer = window.setTimeout(() => {
      const container = bodyScrollRef.current;
      const target = highlightedItemRef.current;
      if (!container || !target) return;

      const containerRect = container.getBoundingClientRect();
      const targetRect = target.getBoundingClientRect();
      const offset =
        targetRect.top -
        containerRect.top +
        container.scrollTop -
        container.clientHeight / 2 +
        targetRect.height / 2;

      container.scrollTo({
        top: Math.max(0, offset),
        behavior: "smooth",
      });
      hasScrolledToHighlightRef.current = true;
    }, 150);

    return () => {
      window.clearTimeout(scrollTimer);
    };
  }, [highlightItemKey, content, expandAllCategories, failuresOnly]);

  const counts = useMemo(() => {
    let pass = 0;
    let fail = 0;
    let na = 0;
    for (const outcome of Object.values(responses)) {
      if (outcome === "pass") pass += 1;
      else if (outcome === "fail") fail += 1;
      else if (outcome === "na") na += 1;
    }
    return { pass, fail, na };
  }, [responses]);

  const scoreDisplay = formatInspectionScoreDisplay({
    earnedPoints,
    possiblePoints,
    scorePercent,
  });

  const failedItems = useMemo(() => {
    const list: Array<{
      key: string;
      categoryKey: string;
      categoryName: string;
      label: string;
      notes: string;
      photoUrl: string | null;
    }> = [];

    for (const category of content.categories) {
      for (const item of category.items) {
        const key = itemKey(category.key, item.key);
        if (responses[key] !== "fail") continue;
        list.push({
          key,
          categoryKey: category.key,
          categoryName: category.name.en,
          label: item.label.en,
          notes: notes[key] || "",
          photoUrl: photos[key] || null,
        });
      }
    }
    return list;
  }, [content, responses, notes, photos]);

  function countAnsweredInCategory(categoryKeyValue: string): number {
    const category = content.categories.find((entry) => entry.key === categoryKeyValue);
    if (!category) return 0;
    return category.items.filter(
      (item) => responses[itemKey(categoryKeyValue, item.key)] !== undefined
    ).length;
  }

  return (
    <div
      className="inspection-review-print-root"
      style={
        embeddedScrollLayout
          ? {
              display: "flex",
              flexDirection: "column",
              height: "100%",
              minHeight: 0,
              overflow: "hidden",
            }
          : undefined
      }
    >
      <div
        style={{
          background: ONE_EYRIE.surface,
          borderBottom: `1px solid ${ONE_EYRIE.border}`,
          flexShrink: embeddedScrollLayout ? 0 : undefined,
          position: embeddedScrollLayout ? "sticky" : undefined,
          top: embeddedScrollLayout ? 0 : undefined,
          zIndex: embeddedScrollLayout ? 2 : undefined,
        }}
      >
        <div
          style={{
            height: "4px",
            background: `linear-gradient(90deg, ${ONE_EYRIE.gold} 0%, ${ONE_EYRIE.goldLight} 50%, ${ONE_EYRIE.gold} 100%)`,
          }}
        />

        <div
          className="inspection-review-header inspection-mobile-session-header"
          style={{ padding: "24px 32px 28px" }}
        >
          <div
            className="inspection-review-no-print"
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: "12px",
              marginBottom: "18px",
              flexWrap: "wrap",
            }}
          >
            <button
              type="button"
              onClick={onBack}
              style={{
                ...SETTINGS_BUTTON_BASE,
                background: "transparent",
                border: "none",
                color: ONE_EYRIE.gold,
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                fontWeight: 700,
                fontSize: "13px",
                padding: 0,
              }}
            >
              <ArrowLeft size={16} />
              {backLabel}
            </button>

            <button
              type="button"
              onClick={() => window.print()}
              style={{
                ...SETTINGS_BUTTON_BASE,
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                background: "transparent",
                border: `1px solid ${ONE_EYRIE.gold}`,
                color: ONE_EYRIE.gold,
                borderRadius: "10px",
                padding: "8px 14px",
                fontSize: "13px",
                fontWeight: 800,
                whiteSpace: "nowrap",
              }}
            >
              <Printer size={16} />
              Print
            </button>
          </div>

          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "8px",
              marginBottom: "16px",
              padding: "5px 12px",
              borderRadius: "999px",
              border: `1px solid ${FOREST.border}`,
              background: FOREST.bgSoft,
              color: FOREST.text,
              fontSize: "11px",
              fontWeight: 800,
              letterSpacing: "0.04em",
              textTransform: "uppercase",
            }}
          >
            {headerBadgeLabel}
          </div>

          <h1
            style={{
              margin: "0 0 8px",
              fontSize: "28px",
              fontWeight: 800,
              lineHeight: 1.2,
            }}
          >
            Room {roomName}
          </h1>
          <div
            style={{
              color: ONE_EYRIE.gold,
              fontWeight: 700,
              fontSize: "14px",
              lineHeight: 1.4,
            }}
          >
            {templateName} · {program}
          </div>
        </div>
      </div>

      <div
        ref={bodyScrollRef}
        className="inspection-review-body inspection-mobile-session-body"
        style={{
          flex: embeddedScrollLayout ? 1 : undefined,
          minHeight: embeddedScrollLayout ? 0 : undefined,
          overflowY: "auto",
          padding: "28px 32px 40px",
        }}
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
            gap: "10px",
            marginBottom: "16px",
          }}
        >
          <div
            style={{
              gridColumn: "span 1",
              minWidth: 0,
              padding: "16px",
              borderRadius: "12px",
              border: `1px solid ${ONE_EYRIE.border}`,
              background: ONE_EYRIE.surfacePanel,
            }}
          >
            <div style={{ color: ONE_EYRIE.textSubtle, fontSize: "11px", fontWeight: 700 }}>
              Score
            </div>
            <div
              style={{
                color: scoreAccent(scorePercent),
                fontSize: "32px",
                fontWeight: 800,
                lineHeight: 1.1,
                marginTop: "4px",
              }}
            >
              {scoreDisplay.percentLabel}
            </div>
            <div style={{ color: ONE_EYRIE.textMuted, fontSize: "12px", marginTop: "4px" }}>
              {scoreDisplay.pointsLabel}
            </div>
          </div>

          {[
            { label: "Passed", value: counts.pass, color: FOREST.text },
            { label: "Failed", value: counts.fail, color: FLAT_RED.text },
            { label: "N/A", value: counts.na, color: NEUTRAL_PILL.text },
          ].map((stat) => (
            <div
              key={stat.label}
              style={{
                padding: "16px",
                borderRadius: "12px",
                border: `1px solid ${ONE_EYRIE.border}`,
                background: ONE_EYRIE.surfacePanel,
              }}
            >
              <div style={{ color: ONE_EYRIE.textSubtle, fontSize: "11px", fontWeight: 700 }}>
                {stat.label}
              </div>
              <div
                style={{
                  color: stat.value > 0 ? stat.color : ONE_EYRIE.textMuted,
                  fontSize: "28px",
                  fontWeight: 800,
                  marginTop: "4px",
                }}
              >
                {stat.value}
              </div>
            </div>
          ))}
        </div>

        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: "14px 20px",
            padding: "14px 16px",
            marginBottom: "18px",
            borderRadius: "12px",
            border: `1px solid ${ONE_EYRIE.border}`,
            background: ONE_EYRIE.surfaceInset,
            color: ONE_EYRIE.textMuted,
            fontSize: "13px",
            lineHeight: 1.5,
          }}
        >
          {startedAt ? (
            <span style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
              <Clock size={14} color={ONE_EYRIE.gold} />
              Started: {formatReviewDate(startedAt)}
            </span>
          ) : null}
          <span style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
            <Calendar size={14} color={ONE_EYRIE.gold} />
            {startedAt ? `Completed: ${formatReviewDate(completedAt)}` : formatReviewDate(completedAt)}
          </span>
          {durationLabel ? (
            <span style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
              <Timer size={14} color={ONE_EYRIE.gold} />
              Duration: {durationLabel}
            </span>
          ) : null}
          {inspectorName && (
            <span style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
              <User size={14} color={ONE_EYRIE.gold} />
              Inspector: {inspectorName}
            </span>
          )}
          {associateName && (
            <span style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
              <Users size={14} color={ONE_EYRIE.gold} />
              Associate: {associateName}
            </span>
          )}
        </div>

        {failedItems.length > 0 && (
          <div
            style={{
              marginBottom: "18px",
              padding: "16px",
              borderRadius: "12px",
              border: `1px solid ${FLAT_RED.border}`,
              background: FLAT_RED.bg,
            }}
          >
            <div
              style={{
                color: FLAT_RED.text,
                fontWeight: 800,
                fontSize: "13px",
                marginBottom: "12px",
                letterSpacing: "0.02em",
                textTransform: "uppercase",
              }}
            >
              Deficiencies ({failedItems.length})
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              {failedItems.map((item) => (
                <div
                  key={item.key}
                  style={{
                    padding: "12px",
                    borderRadius: "10px",
                    border: `1px solid ${FLAT_RED.border}`,
                    background: "rgba(0,0,0,0.2)",
                  }}
                >
                  <div style={{ color: ONE_EYRIE.textSubtle, fontSize: "11px", fontWeight: 700 }}>
                    {item.categoryName}
                  </div>
                  <div
                    style={{
                      color: ONE_EYRIE.text,
                      fontWeight: 700,
                      fontSize: "14px",
                      marginTop: "4px",
                      lineHeight: 1.4,
                    }}
                  >
                    {item.label}
                  </div>
                  {(item.notes || item.photoUrl) && (
                    <div style={{ marginTop: "10px", display: "flex", flexDirection: "column", gap: "8px" }}>
                      {item.notes && (
                        <div
                          style={{
                            color: ONE_EYRIE.textSubtle,
                            fontSize: "13px",
                            lineHeight: 1.45,
                            whiteSpace: "pre-wrap",
                          }}
                        >
                          {item.notes}
                        </div>
                      )}
                      {item.photoUrl && (
                        <a
                          href={item.photoUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{ display: "inline-block" }}
                        >
                          <img
                            src={item.photoUrl}
                            alt={`Photo for ${item.label}`}
                            style={{
                              width: "88px",
                              height: "88px",
                              objectFit: "cover",
                              borderRadius: "8px",
                              border: `1px solid ${ONE_EYRIE.border}`,
                            }}
                          />
                        </a>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "12px",
            marginBottom: "14px",
          }}
        >
          <div style={{ color: ONE_EYRIE.gold, fontWeight: 800, fontSize: "15px" }}>
            Full Checklist
          </div>
          <button
            type="button"
            className="inspection-review-no-print"
            onClick={() => setFailuresOnly((current) => !current)}
            style={{
              ...SETTINGS_BUTTON_BASE,
              background: failuresOnly ? FLAT_RED.bg : "transparent",
              border: `1px solid ${failuresOnly ? FLAT_RED.border : ONE_EYRIE.border}`,
              color: failuresOnly ? FLAT_RED.text : ONE_EYRIE.textSubtle,
              borderRadius: "999px",
              padding: "7px 14px",
              fontSize: "12px",
              fontWeight: 800,
            }}
          >
            {failuresOnly ? "Showing failures only" : "Show failures only"}
          </button>
        </div>

        {content.categories.map((category) => {
          const visibleItems = failuresOnly
            ? category.items.filter(
                (item) => responses[itemKey(category.key, item.key)] === "fail"
              )
            : category.items;

          if (visibleItems.length === 0) {
            return null;
          }

          return (
            <InspectionCategorySection
              key={category.key}
              categoryKey={category.key}
              title={category.name.en}
              answeredCount={countAnsweredInCategory(category.key)}
              totalCount={category.items.length}
              expanded={expandAllCategories || expandedCategoryKey === category.key}
              alwaysExpanded={expandAllCategories}
              onToggle={() => onToggleCategory(category.key)}
            >
              {visibleItems.map((item, index) => {
                const key = itemKey(category.key, item.key);
                const outcome = responses[key];
                if (!outcome) return null;

                const isHighlighted = showItemHighlight && highlightItemKey === key;
                const isScrollTarget = highlightItemKey === key;

                return (
                  <div
                    key={item.key}
                    ref={isScrollTarget ? highlightedItemRef : undefined}
                    style={{ marginBottom: "8px" }}
                  >
                    <div
                      className={isMobileLayout ? "inspection-mobile-item-card" : undefined}
                      style={{
                        padding: "12px 14px",
                        borderRadius: "10px",
                        background:
                          index % 2 === 0 ? ONE_EYRIE.row : ONE_EYRIE.surfaceInset,
                        border: `1px solid ${
                          isHighlighted
                            ? ONE_EYRIE.gold
                            : outcome === "fail"
                              ? FLAT_RED.border
                              : ONE_EYRIE.borderDivider
                        }`,
                        boxShadow: isHighlighted ? `0 0 0 2px ${ONE_EYRIE.gold}` : undefined,
                        transition: "border-color 0.4s ease, box-shadow 0.4s ease",
                      }}
                    >
                      <div
                        className={isMobileLayout ? "inspection-mobile-item-row" : undefined}
                        style={{
                          display: "flex",
                          gap: "12px",
                          alignItems: "flex-start",
                          justifyContent: "space-between",
                          flexWrap: "wrap",
                        }}
                      >
                      <div style={{ flex: 1, minWidth: "180px" }}>
                        <div
                          className={isMobileLayout ? "inspection-mobile-item-label" : undefined}
                          style={{ fontWeight: 700, lineHeight: 1.45, fontSize: "14px" }}
                        >
                          {item.label.en}
                        </div>
                        <div
                          style={{
                            color: ONE_EYRIE.textSubtle,
                            fontSize: "12px",
                            marginTop: "4px",
                          }}
                        >
                          Weight {item.pointValue}
                          {item.required ? " · Required" : ""}
                        </div>
                      </div>
                      <OutcomeBadge outcome={outcome} />
                    </div>
                    </div>

                    {outcome === "fail" && (notes[key] || photos[key]) && (
                      <FailedItemDetails
                          notes={notes[key] || ""}
                          photoUrl={photos[key] || null}
                          readOnly
                          onNotesChange={() => {}}
                          onPhotoSelect={() => {}}
                          onPhotoRemove={() => {}}
                      />
                    )}
                  </div>
                );
              })}
            </InspectionCategorySection>
          );
        })}

        {sessionNotes && (
          <div
            style={{
              marginTop: "8px",
              padding: "16px",
              borderRadius: "12px",
              border: `1px solid ${ONE_EYRIE.border}`,
              background: ONE_EYRIE.surfacePanel,
            }}
          >
            <div
              style={{
                color: ONE_EYRIE.gold,
                fontSize: "12px",
                fontWeight: 800,
                marginBottom: "8px",
                letterSpacing: "0.02em",
                textTransform: "uppercase",
              }}
            >
              Session Notes
            </div>
            <div
              style={{
                color: ONE_EYRIE.text,
                fontSize: "14px",
                lineHeight: 1.55,
                whiteSpace: "pre-wrap",
              }}
            >
              {sessionNotes}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
