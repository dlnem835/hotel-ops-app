"use client";

import { ONE_EYRIE } from "@/app/lib/oneEyrieColors";
import { formatPmSessionTimestamp } from "../lib/pm-session-display";

function MetadataLine({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ color: ONE_EYRIE.textMuted, fontSize: "13px", lineHeight: 1.55 }}>
      <span style={{ color: ONE_EYRIE.textSubtle }}>{label}: </span>
      {value}
    </div>
  );
}

type AuditMetadataLinesProps = {
  createdByLabel?: string | null;
  createdAt?: string | null;
  savedByLabel?: string | null;
  savedAt?: string | null;
  isCompleted?: boolean;
  completedByLabel?: string | null;
  completedAt?: string | null;
};

export default function AuditMetadataLines({
  createdByLabel,
  createdAt,
  savedByLabel,
  savedAt,
  isCompleted = false,
  completedByLabel,
  completedAt,
}: AuditMetadataLinesProps) {
  return (
    <>
      {createdByLabel ? <MetadataLine label="Created by" value={createdByLabel} /> : null}
      {createdAt ? (
        <MetadataLine label="Created" value={formatPmSessionTimestamp(createdAt)} />
      ) : null}

      {savedByLabel ? <MetadataLine label="Saved by" value={savedByLabel} /> : null}
      {savedAt ? <MetadataLine label="Saved" value={formatPmSessionTimestamp(savedAt)} /> : null}

      {isCompleted && completedByLabel ? (
        <MetadataLine label="Completed by" value={completedByLabel} />
      ) : null}
      {isCompleted && completedAt ? (
        <MetadataLine label="Completed" value={formatPmSessionTimestamp(completedAt)} />
      ) : null}
    </>
  );
}
