export const WORK_ORDER_CATEGORIES = [
  "HVAC",
  "Plumbing",
  "Electrical",
  "Fire & Life Safety",
  "Elevator",
  "Swimming Pool",
  "Grounds",
  "Waste Removal",
  "Furniture, Fixtures & Equipment",
  "Other",
] as const;

export type WorkOrderCategory = (typeof WORK_ORDER_CATEGORIES)[number];

export function isWorkOrderCategory(value: string): value is WorkOrderCategory {
  return (WORK_ORDER_CATEGORIES as readonly string[]).includes(value);
}
