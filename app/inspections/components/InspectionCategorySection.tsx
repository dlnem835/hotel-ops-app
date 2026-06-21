"use client";

import { ChevronDown } from "lucide-react";
import { ReactNode } from "react";
import { ONE_EYRIE } from "@/app/lib/oneEyrieColors";
import { useIsMobileInspectionLayout } from "../lib/use-inspection-breakpoint";

type InspectionCategorySectionProps = {
  categoryKey: string;
  title: string;
  answeredCount: number;
  totalCount: number;
  expanded: boolean;
  onToggle: () => void;
  children: ReactNode;
};

export default function InspectionCategorySection({
  title,
  answeredCount,
  totalCount,
  expanded,
  onToggle,
  children,
}: InspectionCategorySectionProps) {
  const isMobile = useIsMobileInspectionLayout();

  if (!isMobile) {
    return (
      <div
        style={{
          border: `1px solid ${ONE_EYRIE.border}`,
          borderRadius: "12px",
          background: ONE_EYRIE.surface,
          padding: "16px",
          marginBottom: "14px",
        }}
      >
        <div style={{ color: ONE_EYRIE.gold, fontWeight: 800, marginBottom: "12px" }}>
          {title}
        </div>
        {children}
      </div>
    );
  }

  return (
    <div
      className="inspection-mobile-category-block"
      style={{
        border: `1px solid ${ONE_EYRIE.border}`,
        borderRadius: "12px",
        background: ONE_EYRIE.surface,
        padding: "16px",
        marginBottom: "14px",
      }}
    >
      <button
        type="button"
        className="inspection-mobile-category-header"
        onClick={onToggle}
        aria-expanded={expanded}
      >
        <span
          className="inspection-mobile-category-title"
          style={{ color: ONE_EYRIE.gold, fontWeight: 800 }}
        >
          {title}
        </span>
        <span style={{ display: "inline-flex", alignItems: "center", gap: "10px" }}>
          <span className="inspection-mobile-category-progress">
            {answeredCount}/{totalCount}
          </span>
          <ChevronDown
            size={18}
            className={`inspection-mobile-category-chevron ${
              expanded ? "inspection-mobile-category-chevron--open" : ""
            }`}
          />
        </span>
      </button>

      {expanded && <div style={{ marginTop: "12px" }}>{children}</div>}
    </div>
  );
}
