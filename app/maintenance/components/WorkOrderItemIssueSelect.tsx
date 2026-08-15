"use client";

import {
  isWorkOrderItemIssue,
  WORK_ORDER_ITEM_ISSUES,
  type WorkOrderItemIssue,
} from "@/app/maintenance/lib/work-order-item-issues";

type WorkOrderItemIssueSelectProps = {
  value: string | null;
  onChange: (value: WorkOrderItemIssue) => void;
  disabled?: boolean;
  className?: string;
};

export default function WorkOrderItemIssueSelect({
  value,
  onChange,
  disabled = false,
  className = "one-eyrie-maintenance-field",
}: WorkOrderItemIssueSelectProps) {
  const selected = isWorkOrderItemIssue(String(value || "")) ? String(value) : "Other";

  return (
    <select
      className={className}
      value={selected}
      disabled={disabled}
      onChange={(event) => onChange(event.target.value as WorkOrderItemIssue)}
      style={{ width: "100%", boxSizing: "border-box" }}
    >
      {WORK_ORDER_ITEM_ISSUES.map((item) => (
        <option key={item} value={item}>
          {item}
        </option>
      ))}
    </select>
  );
}
