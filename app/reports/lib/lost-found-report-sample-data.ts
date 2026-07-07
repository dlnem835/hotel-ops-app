export type SampleLostFoundItem = {
  id: string;
  guestLastName: string;
  roomNumber: string;
  itemName: string;
  guestEmail: string;
  status: string;
  comments: string;
  createdAt: string;
  updatedAt: string;
  labelUrl: string | null;
  labelUploadedAt: string | null;
  shippedAt: string | null;
  updatedBy: string | null;
  daysStored: number | null;
  closedAt: string | null;
  closedBy: string | null;
  closureReason: string | null;
};

export const SAMPLE_LOST_FOUND_ITEMS: SampleLostFoundItem[] = [
  {
    id: "lnf-1001",
    guestLastName: "Nguyen",
    roomNumber: "204",
    itemName: "Silver bracelet",
    guestEmail: "guest.nguyen@email.com",
    status: "Stored",
    comments: "Found behind nightstand.",
    createdAt: "Jun 18, 2026 · 9:12 AM",
    updatedAt: "Jun 18, 2026 · 9:12 AM",
    labelUrl: null,
    labelUploadedAt: null,
    shippedAt: null,
    updatedBy: "Front Desk",
    daysStored: 2,
    closedAt: null,
    closedBy: null,
    closureReason: null,
  },
  {
    id: "lnf-1002",
    guestLastName: "Patel",
    roomNumber: "312",
    itemName: "Wireless earbuds case",
    guestEmail: "a.patel@email.com",
    status: "Ready to be shipped",
    comments: "Guest requested shipping label.",
    createdAt: "Jun 10, 2026 · 2:40 PM",
    updatedAt: "Jun 16, 2026 · 11:05 AM",
    labelUrl: "https://example.com/labels/lnf-1002",
    labelUploadedAt: "Jun 16, 2026 · 11:05 AM",
    shippedAt: null,
    updatedBy: "Front Desk",
    daysStored: 10,
    closedAt: null,
    closedBy: null,
    closureReason: null,
  },
  {
    id: "lnf-1003",
    guestLastName: "Lopez",
    roomNumber: "118",
    itemName: "Reading glasses",
    guestEmail: "m.lopez@email.com",
    status: "Shipped",
    comments: "Shipped via FedEx.",
    createdAt: "May 28, 2026 · 8:20 AM",
    updatedAt: "Jun 2, 2026 · 4:15 PM",
    labelUrl: "https://example.com/labels/lnf-1003",
    labelUploadedAt: "May 30, 2026 · 10:00 AM",
    shippedAt: "Jun 2, 2026 · 4:15 PM",
    updatedBy: "J. Martinez",
    daysStored: 5,
    closedAt: null,
    closedBy: null,
    closureReason: null,
  },
  {
    id: "lnf-1004",
    guestLastName: "Chen",
    roomNumber: "415",
    itemName: "Phone charger",
    guestEmail: "chen.family@email.com",
    status: "Label sent",
    comments: "Label email sent to guest.",
    createdAt: "Jun 14, 2026 · 7:55 PM",
    updatedAt: "Jun 15, 2026 · 9:30 AM",
    labelUrl: null,
    labelUploadedAt: null,
    shippedAt: null,
    updatedBy: "Front Desk",
    daysStored: 6,
    closedAt: null,
    closedBy: null,
    closureReason: null,
  },
  {
    id: "lnf-1005",
    guestLastName: "Williams",
    roomNumber: "508",
    itemName: "Jacket",
    guestEmail: "williams.t@email.com",
    status: "Stored",
    comments: "Stored in bin B-12.",
    createdAt: "Dec 12, 2025 · 3:10 PM",
    updatedAt: "Dec 12, 2025 · 3:10 PM",
    labelUrl: null,
    labelUploadedAt: null,
    shippedAt: null,
    updatedBy: "Housekeeping",
    daysStored: 192,
    closedAt: null,
    closedBy: null,
    closureReason: null,
  },
  {
    id: "lnf-1006",
    guestLastName: "Adams",
    roomNumber: "225",
    itemName: "Umbrella",
    guestEmail: "adams.r@email.com",
    status: "Discarded",
    comments: "Retention period elapsed.",
    createdAt: "Nov 3, 2025 · 1:00 PM",
    updatedAt: "Jun 1, 2026 · 10:00 AM",
    labelUrl: null,
    labelUploadedAt: null,
    shippedAt: null,
    updatedBy: "Front Desk",
    daysStored: 210,
    closedAt: "Jun 1, 2026 · 10:00 AM",
    closedBy: "Front Desk",
    closureReason: "Discarded after retention period",
  },
  {
    id: "lnf-1007",
    guestLastName: "Kim",
    roomNumber: "402",
    itemName: "Watch",
    guestEmail: "kim.s@email.com",
    status: "Guest Declined",
    comments: "Guest declined return shipment.",
    createdAt: "Jun 5, 2026 · 11:45 AM",
    updatedAt: "Jun 8, 2026 · 2:20 PM",
    labelUrl: null,
    labelUploadedAt: null,
    shippedAt: null,
    updatedBy: "Front Desk",
    daysStored: 15,
    closedAt: "Jun 8, 2026 · 2:20 PM",
    closedBy: "Front Desk",
    closureReason: "Guest declined pickup/shipping",
  },
];

export const SAMPLE_LNF_STATUS_COUNTS = [
  { status: "Stored", count: 18 },
  { status: "Label sent", count: 6 },
  { status: "Ready to be shipped", count: 4 },
  { status: "Shipped", count: 12 },
  { status: "Guest Declined", count: 2 },
  { status: "Discarded", count: 9 },
];

export const SAMPLE_LNF_ACTIVITY_SUMMARY = {
  totalLogged: 51,
  stored: 18,
  readyToShip: 4,
  shipped: 12,
  readyToDiscard: 3,
  closed: 11,
  avgDaysStoredBeforeClosure: 142,
};

export const SAMPLE_LNF_ITEMS_BY_STATUS: Record<string, SampleLostFoundItem[]> = {
  Stored: SAMPLE_LOST_FOUND_ITEMS.filter((item) => item.status === "Stored"),
  "Label sent": SAMPLE_LOST_FOUND_ITEMS.filter((item) => item.status === "Label sent"),
  "Ready to be shipped": SAMPLE_LOST_FOUND_ITEMS.filter(
    (item) => item.status === "Ready to be shipped"
  ),
  Shipped: SAMPLE_LOST_FOUND_ITEMS.filter((item) => item.status === "Shipped"),
  "Guest Declined": SAMPLE_LOST_FOUND_ITEMS.filter((item) => item.status === "Guest Declined"),
  Discarded: SAMPLE_LOST_FOUND_ITEMS.filter((item) => item.status === "Discarded"),
};
