"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import {
  formatMonthYearLabel,
  isAtOrAfterCurrentMonth,
  shiftCalendarMonth,
} from "../lib/period-utils";

type InspectionMtdMonthSelectorProps = {
  year: number;
  month: number;
  onChange: (year: number, month: number) => void;
};

export default function InspectionMtdMonthSelector({
  year,
  month,
  onChange,
}: InspectionMtdMonthSelectorProps) {
  const canGoNext = !isAtOrAfterCurrentMonth(year, month);

  function goPrevious() {
    const previous = shiftCalendarMonth(year, month, -1);
    onChange(previous.year, previous.month);
  }

  function goNext() {
    if (!canGoNext) return;
    const next = shiftCalendarMonth(year, month, 1);
    onChange(next.year, next.month);
  }

  return (
    <div className="inspections-mtd-month-selector">
      <button
        type="button"
        className="inspections-mtd-month-selector__arrow"
        onClick={goPrevious}
        aria-label="Previous month"
      >
        <ChevronLeft size={18} strokeWidth={2.5} aria-hidden />
      </button>
      <span className="inspections-mtd-month-selector__label">
        {formatMonthYearLabel(year, month)}
      </span>
      <button
        type="button"
        className="inspections-mtd-month-selector__arrow"
        onClick={goNext}
        disabled={!canGoNext}
        aria-label="Next month"
      >
        <ChevronRight size={18} strokeWidth={2.5} aria-hidden />
      </button>
    </div>
  );
}
