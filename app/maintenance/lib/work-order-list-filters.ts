import { WorkOrder } from "./maintenance-types";

export type WorkOrderSortOrder = "oldest" | "newest";

export type WorkOrderPriorityFilter = "All" | "Urgent" | "Important" | "Normal";

export type WorkOrderStatusFilter =
  | "All"
  | "Open"
  | "In Progress"
  | "Waiting on Parts"
  | "Completed";

export type WorkOrderListFilters = {
  sortOrder: WorkOrderSortOrder;
  priorityFilter: WorkOrderPriorityFilter;
  statusFilter: WorkOrderStatusFilter;
};

export const DEFAULT_WORK_ORDER_LIST_FILTERS: WorkOrderListFilters = {
  sortOrder: "oldest",
  priorityFilter: "All",
  statusFilter: "All",
};

export function applyWorkOrderListFilters(
  workOrders: WorkOrder[],
  filters: WorkOrderListFilters
): WorkOrder[] {
  let result = workOrders;

  if (filters.priorityFilter !== "All") {
    result = result.filter((order) => order.priority === filters.priorityFilter);
  }

  if (filters.statusFilter !== "All") {
    result = result.filter((order) => order.status === filters.statusFilter);
  }

  return [...result].sort((a, b) => {
    const aTime = new Date(a.createdAt).getTime();
    const bTime = new Date(b.createdAt).getTime();
    return filters.sortOrder === "oldest" ? aTime - bTime : bTime - aTime;
  });
}
