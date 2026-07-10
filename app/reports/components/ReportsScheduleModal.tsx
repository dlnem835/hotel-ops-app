"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import {
  ONE_EYRIE_MODAL_BOX,
  ONE_EYRIE_MODAL_CLOSE_BUTTON,
  ONE_EYRIE_MODAL_FOOTER,
  ONE_EYRIE_MODAL_HEADER,
  ONE_EYRIE_MODAL_OVERLAY,
} from "@/app/lib/one-eyrie-modal-styles";
import { ONE_EYRIE } from "@/app/lib/oneEyrieColors";
import {
  GOLD_FILLED_BUTTON,
  goldFilledHoverHandlers,
  NEUTRAL_BUTTON,
  neutralHoverHandlers,
} from "@/app/lib/oneEyrieButtons";
import { useReportPropertyName } from "@/app/reports/hooks/useReportPropertyName";
import {
  saveReportSchedule,
} from "@/app/reports/lib/report-schedule-storage";
import {
  buildDefaultScheduleForm,
  frequencyToIntervalUnit,
  intervalUnitLabel,
  REPORT_SCHEDULE_WEEKDAYS,
  type ReportScheduleContext,
  type ReportScheduleFormValues,
  type ReportScheduleFrequency,
} from "@/app/reports/lib/report-schedule-types";
import { resolveClientTimezone } from "@/app/reports/lib/report-schedule-next-run";

type ReportsScheduleModalProps = {
  open: boolean;
  context: ReportScheduleContext | null;
  onClose: () => void;
  onSaved?: () => void;
};

const fieldLabel: React.CSSProperties = {
  display: "block",
  color: ONE_EYRIE.textSubtle,
  fontSize: "12px",
  fontWeight: 700,
  marginBottom: "6px",
};

export default function ReportsScheduleModal({
  open,
  context,
  onClose,
  onSaved,
}: ReportsScheduleModalProps) {
  const [form, setForm] = useState<ReportScheduleFormValues | null>(null);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const { propertyName, loading: propertyLoading } = useReportPropertyName();

  useEffect(() => {
    if (open && context) {
      setForm({
        ...buildDefaultScheduleForm(context),
        property: propertyName || context.propertyName,
      });
      setSaveMessage(null);
    }
  }, [open, context, propertyName]);

  if (!open || !context || !form) return null;

  function updateForm<K extends keyof ReportScheduleFormValues>(
    key: K,
    value: ReportScheduleFormValues[K]
  ) {
    setForm((prev) => (prev ? { ...prev, [key]: value } : prev));
    setSaveMessage(null);
  }

  function updateFrequency(frequency: ReportScheduleFrequency) {
    setForm((prev) =>
      prev
        ? {
            ...prev,
            frequency,
            intervalUnit: frequencyToIntervalUnit(frequency),
          }
        : prev
    );
    setSaveMessage(null);
  }

  async function handleSave() {
    if (!form || !context || saving) return;

    setSaving(true);
    setSaveMessage(null);

    try {
      await saveReportSchedule({
        schedule: form,
        context,
        timezone: resolveClientTimezone(),
      });
      setSaveMessage("Schedule saved. The next delivery will run automatically.");
      onSaved?.();
    } catch (saveError) {
      setSaveMessage(
        saveError instanceof Error ? saveError.message : "Unable to save schedule."
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="reports-schedule-modal-overlay"
      style={{ ...ONE_EYRIE_MODAL_OVERLAY, zIndex: 1100 }}
      role="presentation"
      onClick={onClose}
    >
      <div
        className="reports-schedule-modal"
        style={{
          ...ONE_EYRIE_MODAL_BOX,
          width: "min(640px, 96vw)",
          maxHeight: "92vh",
          overflow: "auto",
        }}
        role="dialog"
        aria-modal="true"
        aria-labelledby="reports-schedule-modal-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div style={ONE_EYRIE_MODAL_HEADER}>
          <div>
            <h2
              id="reports-schedule-modal-title"
              style={{ margin: 0, color: ONE_EYRIE.gold, fontSize: "20px", fontWeight: 800 }}
            >
              Schedule Report
            </h2>
            <p style={{ margin: "6px 0 0", color: ONE_EYRIE.textSubtle, fontSize: "13px" }}>
              Set up a recurring report run with the current filters.
            </p>
          </div>
          <button
            type="button"
            style={ONE_EYRIE_MODAL_CLOSE_BUTTON}
            onClick={onClose}
            aria-label="Close schedule modal"
          >
            <X size={22} />
          </button>
        </div>

        <div className="reports-pm-modal__form">
          <label className="reports-pm-modal__field">
            <span style={fieldLabel}>Report Name</span>
            <input
              type="text"
              className="one-eyrie-field"
              value={form.reportName}
              onChange={(event) => updateForm("reportName", event.target.value)}
            />
          </label>

          <label className="reports-pm-modal__field">
            <span style={fieldLabel}>Property</span>
            <input
              type="text"
              className="one-eyrie-field"
              readOnly
              value={propertyLoading ? "Loading…" : form.property || "—"}
              aria-readonly="true"
            />
          </label>

          <label className="reports-pm-modal__field">
            <span style={fieldLabel}>Recipients</span>
            <textarea
              className="one-eyrie-field reports-schedule-modal__textarea"
              value={form.recipients}
              onChange={(event) => updateForm("recipients", event.target.value)}
              placeholder="Enter email addresses separated by commas"
              rows={3}
            />
          </label>

          <fieldset className="reports-schedule-modal__fieldset">
            <legend style={fieldLabel}>Frequency</legend>
            <div className="reports-date-presets" role="group" aria-label="Schedule frequency">
              {(["daily", "weekly", "monthly"] as const).map((option) => (
                <button
                  key={option}
                  type="button"
                  className={
                    form.frequency === option
                      ? "reports-date-presets__btn reports-date-presets__btn--active"
                      : "reports-date-presets__btn"
                  }
                  aria-pressed={form.frequency === option}
                  onClick={() => updateFrequency(option)}
                >
                  {option.charAt(0).toUpperCase() + option.slice(1)}
                </button>
              ))}
            </div>
          </fieldset>

          <div className="reports-pm-modal__date-row">
            <label className="reports-pm-modal__field">
              <span style={fieldLabel}>Repeat every</span>
              <div className="reports-schedule-modal__repeat-row">
                <input
                  type="number"
                  min={1}
                  className="one-eyrie-field"
                  value={form.repeatEvery}
                  onChange={(event) =>
                    updateForm("repeatEvery", Math.max(1, Number(event.target.value) || 1))
                  }
                />
                <span className="reports-schedule-modal__repeat-unit">
                  {intervalUnitLabel(form.intervalUnit, form.repeatEvery)}
                </span>
              </div>
            </label>
          </div>

          {form.frequency === "weekly" ? (
            <label className="reports-pm-modal__field">
              <span style={fieldLabel}>Day</span>
              <select
                className="one-eyrie-field"
                value={form.weeklyDay}
                onChange={(event) =>
                  updateForm("weeklyDay", event.target.value as ReportScheduleFormValues["weeklyDay"])
                }
              >
                {REPORT_SCHEDULE_WEEKDAYS.map((day) => (
                  <option key={day} value={day}>
                    {day}
                  </option>
                ))}
              </select>
            </label>
          ) : null}

          {form.frequency === "monthly" ? (
            <label className="reports-pm-modal__field">
              <span style={fieldLabel}>Day of month</span>
              <input
                type="number"
                min={1}
                max={31}
                className="one-eyrie-field"
                value={form.monthlyDay}
                onChange={(event) =>
                  updateForm(
                    "monthlyDay",
                    Math.min(31, Math.max(1, Number(event.target.value) || 1))
                  )
                }
              />
            </label>
          ) : null}

          <label className="reports-pm-modal__field">
            <span style={fieldLabel}>Time</span>
            <input
              type="time"
              className="one-eyrie-field"
              value={form.time}
              onChange={(event) => updateForm("time", event.target.value)}
            />
          </label>

          <div className="reports-pm-modal__date-row">
            <label className="reports-pm-modal__field">
              <span style={fieldLabel}>Start Date</span>
              <input
                type="date"
                className="one-eyrie-field"
                value={form.startDate}
                onChange={(event) => updateForm("startDate", event.target.value)}
              />
            </label>
            <label className="reports-pm-modal__field">
              <span style={fieldLabel}>End Date (optional)</span>
              <input
                type="date"
                className="one-eyrie-field"
                value={form.endDate}
                onChange={(event) => updateForm("endDate", event.target.value)}
              />
            </label>
          </div>

          <label className="reports-schedule-modal__toggle">
            <input
              type="checkbox"
              checked={form.active}
              onChange={(event) => updateForm("active", event.target.checked)}
            />
            <span>Active</span>
          </label>

          <div className="reports-schedule-modal__filters">
            <span style={fieldLabel}>Saved report filters</span>
            <ul className="reports-schedule-modal__filter-list">
              <li>Date range: {context.dateRangeLabel}</li>
              {context.filterLines.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          </div>

          {saveMessage ? (
            <p className="reports-schedule-modal__save-message" role="status">
              {saveMessage}
            </p>
          ) : null}
        </div>

        <div style={ONE_EYRIE_MODAL_FOOTER}>
          <button
            type="button"
            style={NEUTRAL_BUTTON}
            {...neutralHoverHandlers}
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            type="button"
            style={GOLD_FILLED_BUTTON}
            {...goldFilledHoverHandlers}
            disabled={saving}
            onClick={() => void handleSave()}
          >
            {saving ? "Saving…" : "Save Schedule"}
          </button>
        </div>
      </div>
    </div>
  );
}
