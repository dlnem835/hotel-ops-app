"use client";

import { WorkOrderModalInitialValues } from "./WorkOrderModal";
import { ONE_EYRIE } from "@/app/lib/oneEyrieColors";
import {
  forestOutlineHoverHandlers,
  FOREST_OUTLINE_BUTTON,
} from "@/app/settings/lib/settings-ui-interactions";

type CreateWorkOrderButtonProps = {
  initialValues?: WorkOrderModalInitialValues;
  createdBy?: string | null;
  onOpen: (initialValues?: WorkOrderModalInitialValues) => void;
  label?: string;
  compact?: boolean;
};

export default function CreateWorkOrderButton({
  initialValues,
  onOpen,
  label = "Create Work Order",
  compact = false,
}: CreateWorkOrderButtonProps) {
  return (
    <button
      type="button"
      onClick={() => onOpen(initialValues)}
      style={{
        ...(compact
          ? {
              background: "transparent",
              color: ONE_EYRIE.gold,
              border: `1px solid ${ONE_EYRIE.gold}`,
              borderRadius: "999px",
              padding: "6px 12px",
              fontSize: "12px",
              fontWeight: 700,
              cursor: "pointer",
            }
          : FOREST_OUTLINE_BUTTON),
      }}
      {...(compact ? {} : forestOutlineHoverHandlers())}
    >
      {label}
    </button>
  );
}
