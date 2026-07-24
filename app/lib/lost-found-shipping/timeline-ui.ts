/**
 * Staff timeline presentation helpers (append-only events stay unchanged).
 */

import {
  SHIPPING_TIMELINE_EVENTS,
  shippingTimelineLabel,
} from "@/app/lib/lost-found-shipping/timeline";

export type TimelineTone = "completed" | "current" | "future" | "failed";

export type TimelineMilestoneKey =
  | "created"
  | "opened"
  | "address"
  | "option"
  | "payment"
  | "label"
  | "tracking"
  | "shipped"
  | "delivered";

/** Canonical roadmap shown in staff UI (future steps stay gray until recorded). */
export const STAFF_TIMELINE_ROADMAP: Array<{
  key: TimelineMilestoneKey;
  label: string;
  eventTypes: string[];
}> = [
  {
    key: "created",
    label: "Shipping request created",
    eventTypes: [SHIPPING_TIMELINE_EVENTS.requestCreated],
  },
  {
    key: "opened",
    label: "Guest opened link",
    eventTypes: [SHIPPING_TIMELINE_EVENTS.guestOpened],
  },
  {
    key: "address",
    label: "Address validated",
    eventTypes: [
      SHIPPING_TIMELINE_EVENTS.addressValidated,
      SHIPPING_TIMELINE_EVENTS.guestEnteredAddress,
    ],
  },
  {
    key: "option",
    label: "Shipping option selected",
    eventTypes: [SHIPPING_TIMELINE_EVENTS.rateSelected],
  },
  {
    key: "payment",
    label: "Payment received",
    eventTypes: [SHIPPING_TIMELINE_EVENTS.paymentCompleted],
  },
  {
    key: "label",
    label: "Label purchased",
    eventTypes: [SHIPPING_TIMELINE_EVENTS.labelPurchased],
  },
  {
    key: "tracking",
    label: "Tracking number generated",
    eventTypes: [SHIPPING_TIMELINE_EVENTS.trackingAssigned],
  },
  {
    key: "shipped",
    label: "Package shipped",
    eventTypes: [SHIPPING_TIMELINE_EVENTS.packageShipped],
  },
  {
    key: "delivered",
    label: "Delivered",
    eventTypes: [SHIPPING_TIMELINE_EVENTS.packageDelivered],
  },
];

const FAILED_EVENT_TYPES = new Set<string>([
  SHIPPING_TIMELINE_EVENTS.addressValidationFailed,
  SHIPPING_TIMELINE_EVENTS.paymentFailed,
  SHIPPING_TIMELINE_EVENTS.labelPurchaseFailed,
]);

export function isFailedTimelineEvent(eventType: string): boolean {
  return FAILED_EVENT_TYPES.has(eventType);
}

export function timelineEventTone(
  eventType: string,
  options: { isLatestSuccessful?: boolean } = {}
): TimelineTone {
  if (isFailedTimelineEvent(eventType)) return "failed";
  if (options.isLatestSuccessful) return "current";
  return "completed";
}

export function normalizeTimelineActor(actorLabel: string): "Guest" | "Staff" | "System" {
  const value = actorLabel.trim().toLowerCase();
  if (value.includes("guest")) return "Guest";
  if (value.includes("staff") || value === "user" || value.startsWith("user ")) {
    return "Staff";
  }
  return "System";
}

export type StaffTimelineDisplayRow =
  | {
      kind: "event";
      id: string;
      tone: TimelineTone;
      label: string;
      actor: "Guest" | "Staff" | "System";
      createdAt: string | null;
      notes: string | null;
    }
  | {
      kind: "milestone";
      id: string;
      tone: TimelineTone;
      label: string;
      actor: null;
      createdAt: null;
      notes: string | null;
    };

export function buildStaffTimelineDisplay(input: {
  events: Array<{
    id: number;
    eventType: string;
    label?: string;
    actorLabel: string;
    createdAt: string;
    notes: string | null;
  }>;
}): StaffTimelineDisplayRow[] {
  const events = input.events || [];
  const latestSuccessfulIndex = [...events]
    .map((event, index) => ({ event, index }))
    .reverse()
    .find(({ event }) => !isFailedTimelineEvent(event.eventType))?.index;

  const rows: StaffTimelineDisplayRow[] = events.map((event, index) => ({
    kind: "event",
    id: `event-${event.id}`,
    tone: timelineEventTone(event.eventType, {
      isLatestSuccessful: index === latestSuccessfulIndex,
    }),
    label: event.label || shippingTimelineLabel(event.eventType),
    actor: normalizeTimelineActor(event.actorLabel),
    createdAt: event.createdAt,
    notes: event.notes,
  }));

  const recordedTypes = new Set(events.map((event) => event.eventType));
  let foundGap = false;
  for (const milestone of STAFF_TIMELINE_ROADMAP) {
    const done = milestone.eventTypes.some((type) => recordedTypes.has(type));
    if (done) continue;
    const isCurrent = !foundGap;
    foundGap = true;
    rows.push({
      kind: "milestone",
      id: `future-${milestone.key}`,
      tone: isCurrent ? "current" : "future",
      label: milestone.label,
      actor: null,
      createdAt: null,
      notes: isCurrent ? "Pending · next expected step" : "Pending",
    });
  }

  return rows;
}

/** Relative time for staff timeline; keep exact timestamp in title/audit UI. */
export function formatRelativeTimestamp(
  iso: string,
  now = new Date()
): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "Unknown time";

  const diffMs = now.getTime() - date.getTime();
  const past = diffMs >= 0;
  const absSec = Math.floor(Math.abs(diffMs) / 1000);

  if (absSec < 45) return "just now";

  const absMin = Math.floor(absSec / 60);
  if (absMin < 60) {
    const value = absMin <= 1 ? 1 : absMin;
    return past ? `${value} minute${value === 1 ? "" : "s"} ago` : `in ${value} minute${value === 1 ? "" : "s"}`;
  }

  const absHr = Math.floor(absMin / 60);
  if (absHr < 48) {
    return past
      ? `${absHr} hour${absHr === 1 ? "" : "s"} ago`
      : `in ${absHr} hour${absHr === 1 ? "" : "s"}`;
  }

  const absDay = Math.floor(absHr / 24);
  if (absDay < 30) {
    return past
      ? `${absDay} day${absDay === 1 ? "" : "s"} ago`
      : `in ${absDay} day${absDay === 1 ? "" : "s"}`;
  }

  const absMonth = Math.floor(absDay / 30);
  if (absMonth < 18) {
    return past
      ? `${absMonth} month${absMonth === 1 ? "" : "s"} ago`
      : `in ${absMonth} month${absMonth === 1 ? "" : "s"}`;
  }

  const absYear = Math.floor(absDay / 365);
  return past
    ? `${absYear} year${absYear === 1 ? "" : "s"} ago`
    : `in ${absYear} year${absYear === 1 ? "" : "s"}`;
}

/** Guest progress steps for the public shipping page. */
export const GUEST_PROGRESS_STEPS = [
  { key: "address", label: "Address" },
  { key: "options", label: "Shipping Options" },
  { key: "payment", label: "Payment" },
  { key: "label", label: "Label Created" },
  { key: "shipped", label: "Shipped" },
  { key: "delivered", label: "Delivered" },
] as const;

export type GuestProgressKey = (typeof GUEST_PROGRESS_STEPS)[number]["key"];

export function guestProgressIndex(
  state:
    | "awaiting_guest"
    | "awaiting_payment"
    | "payment_processing"
    | "label_created"
    | "in_transit"
    | "delivered"
    | "expired"
    | "unavailable"
): number {
  switch (state) {
    case "awaiting_guest":
      return 0;
    case "awaiting_payment":
      return 1;
    case "payment_processing":
      return 2;
    case "label_created":
      return 3;
    case "in_transit":
      return 4;
    case "delivered":
      return 5;
    default:
      return 0;
  }
}
