import { WorkOrder } from "./maintenance-types";

export type WorkOrderSortOrder = "oldest" | "newest";

export type WorkOrderPriorityFilter = "All" | "Urgent" | "Important" | "Normal";

export type WorkOrderListFilters = {
  sortOrder: WorkOrderSortOrder;
  priorityFilter: WorkOrderPriorityFilter;
};

export const DEFAULT_WORK_ORDER_LIST_FILTERS: WorkOrderListFilters = {
  sortOrder: "oldest",
  priorityFilter: "All",
};

export function applyWorkOrderListFilters(
  workOrders: WorkOrder[],
  filters: WorkOrderListFilters
): WorkOrder[] {
  let result = workOrders;

  if (filters.priorityFilter !== "All") {
    result = result.filter((order) => order.priority === filters.priorityFilter);
  }

  return [...result].sort((a, b) => {
    const aTime = new Date(a.createdAt).getTime();
    const bTime = new Date(b.createdAt).getTime();
    return filters.sortOrder === "oldest" ? aTime - bTime : bTime - aTime;
  });
}
