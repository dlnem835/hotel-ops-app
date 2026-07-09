"use client";

import { ONE_EYRIE } from "@/app/lib/oneEyrieColors";

type ReportsPropertyNameFieldProps = {
  propertyName: string;
  loading?: boolean;
};

const fieldLabel: React.CSSProperties = {
  display: "block",
  color: ONE_EYRIE.textSubtle,
  fontSize: "12px",
  fontWeight: 700,
  marginBottom: "6px",
};

export default function ReportsPropertyNameField({
  propertyName,
  loading = false,
}: ReportsPropertyNameFieldProps) {
  return (
    <label className="reports-pm-modal__field">
      <span style={fieldLabel}>Property Name</span>
      <input
        type="text"
        className="one-eyrie-field"
        readOnly
        value={loading ? "Loading…" : propertyName || "—"}
        aria-readonly="true"
      />
    </label>
  );
}
