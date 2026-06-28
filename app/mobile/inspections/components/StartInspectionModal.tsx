"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AssociateOption,
  matchingTemplates,
  TemplateOption,
} from "../lib/inspection-shared";

type StartInspectionModalProps = {
  open: boolean;
  roomName: string;
  program: "VR" | "RPM";
  templates: TemplateOption[];
  associates: AssociateOption[];
  defaultTemplateId: number | null;
  starting?: boolean;
  onClose: () => void;
  onStart: (templateId: number, associateId: string | null) => void;
};

export default function StartInspectionModal({
  open,
  roomName,
  program,
  templates,
  associates,
  defaultTemplateId,
  starting = false,
  onClose,
  onStart,
}: StartInspectionModalProps) {
  const filteredTemplates = useMemo(
    () => matchingTemplates(templates, program),
    [templates, program]
  );

  const [templateId, setTemplateId] = useState<number | null>(defaultTemplateId);
  const [associateId, setAssociateId] = useState<string>("");

  useEffect(() => {
    if (!open) return;
    setTemplateId(defaultTemplateId ?? filteredTemplates[0]?.id ?? null);
    setAssociateId("");
  }, [open, defaultTemplateId, filteredTemplates]);

  if (!open) return null;

  const canStart = Boolean(templateId) && !starting;

  return (
    <div className="one-eyrie-mobile-inspection-modal" role="dialog" aria-modal="true">
      <button
        type="button"
        className="one-eyrie-mobile-inspection-modal__backdrop"
        aria-label="Close"
        onClick={onClose}
      />
      <div className="one-eyrie-mobile-inspection-modal__panel">
        <div className="one-eyrie-mobile-inspection-modal__title">Start Inspection</div>
        <div className="one-eyrie-mobile-inspection-modal__room">Room {roomName}</div>

        <label className="one-eyrie-mobile-field">
          <span>Inspection type</span>
          <select
            value={templateId ?? ""}
            onChange={(event) =>
              setTemplateId(event.target.value ? Number(event.target.value) : null)
            }
          >
            <option value="">Select type…</option>
            {filteredTemplates.map((template) => (
              <option key={template.id} value={template.id}>
                {template.name}
              </option>
            ))}
          </select>
        </label>

        <label className="one-eyrie-mobile-field">
          <span>Housekeeper</span>
          <select
            value={associateId}
            onChange={(event) => setAssociateId(event.target.value)}
          >
            <option value="">Optional…</option>
            {associates.map((associate) => (
              <option key={associate.id} value={associate.id}>
                {associate.name}
              </option>
            ))}
          </select>
        </label>

        <div className="one-eyrie-mobile-inspection-modal__actions">
          <button
            type="button"
            className="one-eyrie-mobile-btn one-eyrie-mobile-btn--ghost"
            onClick={onClose}
            disabled={starting}
          >
            Cancel
          </button>
          <button
            type="button"
            className="one-eyrie-mobile-btn one-eyrie-mobile-btn--gold"
            disabled={!canStart}
            onClick={() => {
              if (!templateId) return;
              onStart(templateId, associateId || null);
            }}
          >
            {starting ? "Starting…" : "Next"}
          </button>
        </div>
      </div>
    </div>
  );
}
