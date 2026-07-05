import { WorkOrderPriority } from "@/app/maintenance/lib/maintenance-types";

export const WORK_ORDER_PRIORITY_ORDER: Record<WorkOrderPriority, number> = {
  Urgent: 0,
  Important: 1,
  Normal: 2,
};

export function getWorkOrderPriorityBadgeClassName(priority: string): string {
  if (priority === "Urgent") {
    return "work-order-priority-badge work-order-priority-badge--urgent";
  }
  if (priority === "Important") {
    return "work-order-priority-badge work-order-priority-badge--important";
  }
  return "work-order-priority-badge work-order-priority-badge--normal";
}
