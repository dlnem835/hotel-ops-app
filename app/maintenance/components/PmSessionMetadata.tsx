"use client";

import { ONE_EYRIE } from "@/app/lib/oneEyrieColors";
import AuditMetadataLines from "./AuditMetadataLines";

type PmSessionMetadataProps = {
  locationLabel: string;
  frequencyLabel: string | null;
  createdByLabel: string | null;
  savedByLabel: string | null;
  savedAt: string | null;
  isCompleted: boolean;
  completedByLabel: string | null;
  completedAt: string | null;
};

export default function PmSessionMetadata({
  locationLabel,
  frequencyLabel,
  createdByLabel,
  savedByLabel,
  savedAt,
  isCompleted,
  completedByLabel,
  completedAt,
}: PmSessionMetadataProps) {
  return (
    <div
      className="pm-session-metadata"
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "4px",
        marginTop: "8px",
      }}
    >
      <div style={{ color: ONE_EYRIE.textMuted, fontSize: "13px", lineHeight: 1.55 }}>
        {locationLabel}
      </div>

      {frequencyLabel ? (
        <div style={{ color: ONE_EYRIE.textMuted, fontSize: "13px", lineHeight: 1.55 }}>
          <span style={{ color: ONE_EYRIE.textSubtle }}>Frequency: </span>
          {frequencyLabel}
        </div>
      ) : null}

      <AuditMetadataLines
        createdByLabel={createdByLabel}
        savedByLabel={savedByLabel}
        savedAt={savedAt}
        isCompleted={isCompleted}
        completedByLabel={completedByLabel}
        completedAt={completedAt}
      />
    </div>
  );
}
