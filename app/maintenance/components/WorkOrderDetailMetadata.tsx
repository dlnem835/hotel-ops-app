"use client";

import AuditMetadataLines from "./AuditMetadataLines";

type WorkOrderDetailMetadataProps = {
  locationLabel: string;
  sourceModule?: string | null;
  createdByLabel: string | null;
  createdAt: string | null;
  isCompleted: boolean;
  completedByLabel: string | null;
  completedAt: string | null;
};

export default function WorkOrderDetailMetadata({
  locationLabel,
  sourceModule,
  createdByLabel,
  createdAt,
  isCompleted,
  completedByLabel,
  completedAt,
}: WorkOrderDetailMetadataProps) {
  return (
    <div
      className="maintenance-wo-detail-metadata"
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "4px",
        marginBottom: "18px",
      }}
    >
      <div style={{ color: "#9ca3af", fontSize: "13px", lineHeight: 1.55 }}>
        {locationLabel}
        {sourceModule ? ` · from ${sourceModule}` : ""}
      </div>

      <AuditMetadataLines
        createdByLabel={createdByLabel}
        createdAt={createdAt}
        isCompleted={isCompleted}
        completedByLabel={completedByLabel}
        completedAt={completedAt}
      />
    </div>
  );
}
