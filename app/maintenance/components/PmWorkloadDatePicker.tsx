"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Calendar, ChevronLeft, ChevronRight } from "lucide-react";
import {
  buildMonthWorkloadMap,
  formatLongDate,
  formatWorkloadLabel,
  getDayWorkload,
  PmDayWorkload,
  PmDraftPreview,
  PmWorkloadLevel,
} from "../lib/pm-workload-calendar";
import { formatDate, parseDate } from "../lib/schedule-engine";
import { PmAssignmentSchedule } from "../lib/pm-types";
import { FLAT_RED, FOREST, ONE_EYRIE } from "@/app/lib/oneEyrieColors";

type PmWorkloadDatePickerProps = {
  value: string;
  onChange: (value: string) => void;
  schedules: PmAssignmentSchedule[];
  editingTemplateId?: number | null;
  draft?: PmDraftPreview | null;
  inputStyle: React.CSSProperties;
};

const WEEKDAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
const CALENDAR_WIDTH = 260;
const TOOLTIP_WIDTH = 220;
const TOOLTIP_GAP = 8;

function getWorkloadColor(level: PmWorkloadLevel): string {
  switch (level) {
    case "light":
      return FOREST.border;
    case "moderate":
      return ONE_EYRIE.gold;
    case "heavy":
      return FLAT_RED.border;
    default:
      return "transparent";
  }
}

function computeTooltipStyle(anchorRect: DOMRect): React.CSSProperties {
  const centerX = anchorRect.left + anchorRect.width / 2;
  const viewportPadding = 12;
  const spaceAbove = anchorRect.top;
  const spaceBelow = window.innerHeight - anchorRect.bottom;
  const spaceRight = window.innerWidth - anchorRect.right;
  const spaceLeft = anchorRect.left;

  if (spaceAbove >= 120) {
    const left = Math.min(
      Math.max(viewportPadding + TOOLTIP_WIDTH / 2, centerX),
      window.innerWidth - viewportPadding - TOOLTIP_WIDTH / 2
    );

    return {
      top: anchorRect.top - TOOLTIP_GAP,
      left,
      transform: "translate(-50%, -100%)",
    };
  }

  if (spaceRight >= TOOLTIP_WIDTH + TOOLTIP_GAP) {
    return {
      top: anchorRect.top + anchorRect.height / 2,
      left: anchorRect.right + TOOLTIP_GAP,
      transform: "translateY(-50%)",
    };
  }

  if (spaceLeft >= TOOLTIP_WIDTH + TOOLTIP_GAP) {
    return {
      top: anchorRect.top + anchorRect.height / 2,
      left: anchorRect.left - TOOLTIP_GAP,
      transform: "translate(-100%, -50%)",
    };
  }

  if (spaceBelow >= 120) {
    const left = Math.min(
      Math.max(viewportPadding + TOOLTIP_WIDTH / 2, centerX),
      window.innerWidth - viewportPadding - TOOLTIP_WIDTH / 2
    );

    return {
      top: anchorRect.bottom + TOOLTIP_GAP,
      left,
      transform: "translateX(-50%)",
    };
  }

  return {
    top: Math.max(viewportPadding, anchorRect.top - TOOLTIP_GAP),
    left: Math.min(
      window.innerWidth - viewportPadding - TOOLTIP_WIDTH,
      Math.max(viewportPadding, anchorRect.right + TOOLTIP_GAP)
    ),
    transform: "translateY(-100%)",
  };
}

function WorkloadTooltip({
  workload,
  anchorRect,
}: {
  workload: PmDayWorkload;
  anchorRect: DOMRect | null;
}) {
  if (!anchorRect || workload.pmCount === 0 || typeof document === "undefined") {
    return null;
  }

  return createPortal(
    <div
      className="one-eyrie-pm-workload-tooltip"
      style={computeTooltipStyle(anchorRect)}
      role="tooltip"
    >
      <div className="one-eyrie-pm-workload-tooltip__title">
        {formatLongDate(workload.date)}
      </div>
      <div className="one-eyrie-pm-workload-tooltip__stat">
        {workload.pmCount} PM{workload.pmCount === 1 ? "" : "s"} Scheduled
      </div>
      <div className="one-eyrie-pm-workload-tooltip__label">PMs:</div>
      <ul className="one-eyrie-pm-workload-tooltip__list">
        {workload.pms.map((pm, index) => (
          <li key={`${pm.name}-${index}`}>{pm.name}</li>
        ))}
      </ul>
    </div>,
    document.body
  );
}
function SelectedDaySummary({ workload }: { workload: PmDayWorkload }) {
  if (!workload.date) return null;

  return (
    <div
      className="one-eyrie-pm-workload-summary"
      data-level={workload.level}
    >
      <div className="one-eyrie-pm-workload-summary__title">
        {formatLongDate(workload.date)}
      </div>
      <div className="one-eyrie-pm-workload-summary__row">
        {workload.pmCount} PM{workload.pmCount === 1 ? "" : "s"} scheduled
      </div>
      <div
        className="one-eyrie-pm-workload-summary__badge"
        data-level={workload.level}
      >
        {formatWorkloadLabel(workload.level)}
      </div>
    </div>
  );
}

export default function PmWorkloadDatePicker({
  value,
  onChange,
  schedules,
  editingTemplateId = null,
  draft = null,
  inputStyle,
}: PmWorkloadDatePickerProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const fieldRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [hoverDate, setHoverDate] = useState<string | null>(null);
  const [tooltipRect, setTooltipRect] = useState<DOMRect | null>(null);
  const [calendarPos, setCalendarPos] = useState({ top: 0, left: 0 });

  const selectedDate = value ? parseDate(value) : new Date();
  const [viewYear, setViewYear] = useState(selectedDate.getFullYear());
  const [viewMonth, setViewMonth] = useState(selectedDate.getMonth());

  useEffect(() => {
    if (!open || !fieldRef.current) return;

    function updatePosition() {
      if (!fieldRef.current) return;
      const rect = fieldRef.current.getBoundingClientRect();
      const width = CALENDAR_WIDTH;
      const left = Math.min(
        Math.max(12, rect.left),
        window.innerWidth - width - 12
      );
      const top = rect.bottom + 8;
      setCalendarPos({ top, left });
    }

    updatePosition();
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [open, viewMonth, viewYear]);

  useEffect(() => {
    if (!value) return;
    const parsed = parseDate(value);
    setViewYear(parsed.getFullYear());
    setViewMonth(parsed.getMonth());
  }, [value, open]);

  useEffect(() => {
    if (!open) return;

    function handlePointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
        setHoverDate(null);
        setTooltipRect(null);
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [open]);

  const previewDate = hoverDate || null;

  const monthWorkload = useMemo(
    () =>
      buildMonthWorkloadMap(schedules, viewYear, viewMonth, {
        excludeTemplateId: editingTemplateId,
        draft,
        draftOnDate: previewDate,
      }),
    [schedules, viewYear, viewMonth, editingTemplateId, draft, previewDate]
  );

  const selectedWorkload = useMemo(() => {
    if (!value) {
      return getDayWorkload(new Map(), "");
    }

    const map = buildMonthWorkloadMap(
      schedules,
      parseDate(value).getFullYear(),
      parseDate(value).getMonth(),
      {
        excludeTemplateId: editingTemplateId,
        draft,
        draftOnDate: value,
      }
    );

    return getDayWorkload(map, value);
  }, [value, schedules, editingTemplateId, draft]);

  const hoverWorkload = hoverDate
    ? getDayWorkload(monthWorkload, hoverDate)
    : null;

  const monthLabel = new Date(viewYear, viewMonth, 1).toLocaleDateString(
    undefined,
    { month: "long", year: "numeric" }
  );

  const firstWeekday = new Date(viewYear, viewMonth, 1).getDay();
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const todayIso = formatDate(new Date());

  const cells: Array<{ date: string | null; day: number | null }> = [];
  for (let i = 0; i < firstWeekday; i++) {
    cells.push({ date: null, day: null });
  }
  for (let day = 1; day <= daysInMonth; day++) {
    cells.push({
      day,
      date: formatDate(new Date(viewYear, viewMonth, day)),
    });
  }

  function shiftMonth(delta: number) {
    const next = new Date(viewYear, viewMonth + delta, 1);
    setViewYear(next.getFullYear());
    setViewMonth(next.getMonth());
    setHoverDate(null);
    setTooltipRect(null);
  }

  function handleSelect(date: string) {
    onChange(date);
    setOpen(false);
    setHoverDate(null);
    setTooltipRect(null);
  }

  const displayValue = value
    ? parseDate(value).toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    : "";

  return (
    <div className="one-eyrie-date-picker" ref={rootRef}>
      <div className="one-eyrie-date-picker__field" ref={fieldRef}>
        <input
          readOnly
          value={displayValue}
          placeholder="Select date…"
          className="one-eyrie-date-input one-eyrie-date-picker__input"
          style={inputStyle}
          onClick={() => setOpen((current) => !current)}
        />
        <button
          type="button"
          className="one-eyrie-date-picker__icon"
          aria-label="Open calendar"
          onClick={() => setOpen((current) => !current)}
        >
          <Calendar size={16} />
        </button>
      </div>

      {open && (
        <div
          className="one-eyrie-pm-workload-calendar one-eyrie-pm-workload-calendar--floating"
          style={{ top: calendarPos.top, left: calendarPos.left }}
        >
          <div className="one-eyrie-pm-workload-calendar__header">
            <button
              type="button"
              className="one-eyrie-pm-workload-calendar__nav"
              onClick={() => shiftMonth(-1)}
              aria-label="Previous month"
            >
              <ChevronLeft size={16} />
            </button>
            <div className="one-eyrie-pm-workload-calendar__title">
              {monthLabel}
            </div>
            <button
              type="button"
              className="one-eyrie-pm-workload-calendar__nav"
              onClick={() => shiftMonth(1)}
              aria-label="Next month"
            >
              <ChevronRight size={16} />
            </button>
          </div>

          <div className="one-eyrie-pm-workload-calendar__weekdays">
            {WEEKDAYS.map((day) => (
              <span key={day}>{day}</span>
            ))}
          </div>

          <div className="one-eyrie-pm-workload-calendar__grid">
            {cells.map((cell, index) => {
              if (!cell.date || !cell.day) {
                return (
                  <div
                    key={`empty-${index}`}
                    className="one-eyrie-pm-workload-calendar__day one-eyrie-pm-workload-calendar__day--empty"
                  />
                );
              }

              const workload = getDayWorkload(monthWorkload, cell.date);
              const isSelected = value === cell.date;
              const isToday = todayIso === cell.date;

              return (
                <button
                  key={cell.date}
                  type="button"
                  className="one-eyrie-pm-workload-calendar__day"
                  data-selected={isSelected ? "true" : "false"}
                  data-today={isToday ? "true" : "false"}
                  onClick={() => handleSelect(cell.date!)}
                  onMouseEnter={(event) => {
                    setHoverDate(cell.date);
                    setTooltipRect(event.currentTarget.getBoundingClientRect());
                  }}
                  onMouseLeave={() => {
                    setHoverDate(null);
                    setTooltipRect(null);
                  }}
                >
                  <span className="one-eyrie-pm-workload-calendar__day-num">
                    {cell.day}
                  </span>
                  {workload.level !== "none" && (
                    <span
                      className="one-eyrie-pm-workload-calendar__indicator"
                      style={{ background: getWorkloadColor(workload.level) }}
                    />
                  )}
                </button>
              );
            })}
          </div>

          <div className="one-eyrie-pm-workload-calendar__legend">
            <span>
              <i style={{ background: FOREST.border }} />
              Light
            </span>
            <span>
              <i style={{ background: ONE_EYRIE.gold }} />
              Moderate
            </span>
            <span>
              <i style={{ background: FLAT_RED.border }} />
              Heavy
            </span>
          </div>
        </div>
      )}

      {open && hoverWorkload && (
        <WorkloadTooltip workload={hoverWorkload} anchorRect={tooltipRect} />
      )}

      {value && <SelectedDaySummary workload={selectedWorkload} />}
    </div>
  );
}
