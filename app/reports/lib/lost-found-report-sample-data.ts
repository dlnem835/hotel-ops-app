export type SampleLostFoundItem = {
  id: string;
  guestLastName: string;
  roomNumber: string;
  itemName: string;
  guestEmail: string;
  status: string;
  foundBy: string;
  createdBy: string;
  comments: string;
  createdAt: string;
  createdAtIso: string;
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

export type SampleLostFoundFoundByRow = {
  associateName: string;
  department: string;
  itemsFound: number;
  lastItemFoundDate: string;
  lastItemFoundDateIso: string;
  mostRecentItem: string;
  lastFoundLocation: string;
};

export const SAMPLE_LNF_FOUND_BY_ASSOCIATES = [
  "All",
  "J. Martinez",
  "Maddie",
  "Grisell",
  "Front Desk — John Smith",
  "Rosa",
] as const;

export const SAMPLE_LNF_CREATED_BY_ASSOCIATES = SAMPLE_LNF_FOUND_BY_ASSOCIATES;

export const SAMPLE_LOST_FOUND_ITEMS: SampleLostFoundItem[] = [
  {
    id: "lnf-1001",
    guestLastName: "Nguyen",
    roomNumber: "204",
    itemName: "Silver bracelet",
    guestEmail: "guest.nguyen@email.com",
    status: "Stored",
    foundBy: "Maddie",
    createdBy: "Front Desk — John Smith",
    comments: "Found behind nightstand.",
    createdAt: "Jul 6, 2026 · 9:12 AM",
    createdAtIso: "2026-07-06",
    updatedAt: "Jul 6, 2026 · 9:12 AM",
    labelUrl: null,
    labelUploadedAt: null,
    shippedAt: null,
    updatedBy: "Front Desk — John Smith",
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
    status: "Ready to Ship",
    foundBy: "Grisell",
    createdBy: "Front Desk — John Smith",
    comments: "Guest requested shipping label.",
    createdAt: "Jul 1, 2026 · 2:40 PM",
    createdAtIso: "2026-07-01",
    updatedAt: "Jul 5, 2026 · 11:05 AM",
    labelUrl: "https://example.com/labels/lnf-1002",
    labelUploadedAt: "Jul 5, 2026 · 11:05 AM",
    shippedAt: null,
    updatedBy: "Front Desk — John Smith",
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
    foundBy: "J. Martinez",
    createdBy: "J. Martinez",
    comments: "Shipped via FedEx.",
    createdAt: "Jun 28, 2026 · 8:20 AM",
    createdAtIso: "2026-06-28",
    updatedAt: "Jul 2, 2026 · 4:15 PM",
    labelUrl: "https://example.com/labels/lnf-1003",
    labelUploadedAt: "Jun 30, 2026 · 10:00 AM",
    shippedAt: "Jul 2, 2026 · 4:15 PM",
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
    status: "Label Sent",
    foundBy: "Front Desk — John Smith",
    createdBy: "Front Desk — John Smith",
    comments: "Label email sent to guest.",
    createdAt: "Jul 4, 2026 · 7:55 PM",
    createdAtIso: "2026-07-04",
    updatedAt: "Jul 5, 2026 · 9:30 AM",
    labelUrl: null,
    labelUploadedAt: null,
    shippedAt: null,
    updatedBy: "Front Desk — John Smith",
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
    foundBy: "Rosa",
    createdBy: "Rosa",
    comments: "Stored in bin B-12.",
    createdAt: "Dec 12, 2025 · 3:10 PM",
    createdAtIso: "2025-12-12",
    updatedAt: "Dec 12, 2025 · 3:10 PM",
    labelUrl: null,
    labelUploadedAt: null,
    shippedAt: null,
    updatedBy: "Rosa",
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
    foundBy: "Maddie",
    createdBy: "Front Desk — John Smith",
    comments: "Retention period elapsed.",
    createdAt: "Nov 3, 2025 · 1:00 PM",
    createdAtIso: "2025-11-03",
    updatedAt: "Jul 1, 2026 · 10:00 AM",
    labelUrl: null,
    labelUploadedAt: null,
    shippedAt: null,
    updatedBy: "Front Desk — John Smith",
    daysStored: 210,
    closedAt: "Jul 1, 2026 · 10:00 AM",
    closedBy: "Front Desk — John Smith",
    closureReason: "Discarded after retention period",
  },
  {
    id: "lnf-1007",
    guestLastName: "Kim",
    roomNumber: "402",
    itemName: "Watch",
    guestEmail: "kim.s@email.com",
    status: "Returned",
    foundBy: "Grisell",
    createdBy: "Front Desk — John Smith",
    comments: "Guest declined return shipment.",
    createdAt: "Jul 2, 2026 · 11:45 AM",
    createdAtIso: "2026-07-02",
    updatedAt: "Jul 5, 2026 · 2:20 PM",
    labelUrl: null,
    labelUploadedAt: null,
    shippedAt: null,
    updatedBy: "Front Desk — John Smith",
    daysStored: 15,
    closedAt: "Jul 5, 2026 · 2:20 PM",
    closedBy: "Front Desk — John Smith",
    closureReason: "Guest declined pickup/shipping",
  },
  {
    id: "lnf-1008",
    guestLastName: "Baker",
    roomNumber: "210",
    itemName: "Laptop charger",
    guestEmail: "baker.l@email.com",
    status: "Label Requested",
    foundBy: "J. Martinez",
    createdBy: "J. Martinez",
    comments: "Guest requested label by email.",
    createdAt: "Jul 7, 2026 · 8:30 AM",
    createdAtIso: "2026-07-07",
    updatedAt: "Jul 7, 2026 · 8:30 AM",
    labelUrl: null,
    labelUploadedAt: null,
    shippedAt: null,
    updatedBy: "Front Desk — John Smith",
    daysStored: 1,
    closedAt: null,
    closedBy: null,
    closureReason: null,
  },
];

export const SAMPLE_LNF_FOUND_BY_ROWS: SampleLostFoundFoundByRow[] = [
  {
    associateName: "Maddie",
    department: "Housekeeping",
    itemsFound: 24,
    lastItemFoundDate: "Jul 6, 2026",
    lastItemFoundDateIso: "2026-07-06",
    mostRecentItem: "Silver bracelet",
    lastFoundLocation: "Room 204",
  },
  {
    associateName: "Grisell",
    department: "Housekeeping",
    itemsFound: 19,
    lastItemFoundDate: "Jul 2, 2026",
    lastItemFoundDateIso: "2026-07-02",
    mostRecentItem: "Watch",
    lastFoundLocation: "Room 402",
  },
  {
    associateName: "J. Martinez",
    department: "Front Desk",
    itemsFound: 11,
    lastItemFoundDate: "Jul 7, 2026",
    lastItemFoundDateIso: "2026-07-07",
    mostRecentItem: "Laptop charger",
    lastFoundLocation: "Room 210",
  },
  {
    associateName: "Front Desk — John Smith",
    department: "Front Desk",
    itemsFound: 8,
    lastItemFoundDate: "Jul 4, 2026",
    lastItemFoundDateIso: "2026-07-04",
    mostRecentItem: "Phone charger",
    lastFoundLocation: "Room 415",
  },
  {
    associateName: "Rosa",
    department: "Housekeeping",
    itemsFound: 6,
    lastItemFoundDate: "Dec 12, 2025",
    lastItemFoundDateIso: "2025-12-12",
    mostRecentItem: "Jacket",
    lastFoundLocation: "Room 508",
  },
];

export const SAMPLE_LNF_STATUS_COUNTS = [
  { status: "Stored", count: 18 },
  { status: "Label Requested", count: 3 },
  { status: "Label Sent", count: 6 },
  { status: "Ready to Ship", count: 4 },
  { status: "Shipped", count: 12 },
  { status: "Returned", count: 2 },
  { status: "Discarded", count: 9 },
  { status: "Closed", count: 6 },
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
  "Label Requested": SAMPLE_LOST_FOUND_ITEMS.filter((item) => item.status === "Label Requested"),
  "Label Sent": SAMPLE_LOST_FOUND_ITEMS.filter((item) => item.status === "Label Sent"),
  "Ready to Ship": SAMPLE_LOST_FOUND_ITEMS.filter((item) => item.status === "Ready to Ship"),
  Shipped: SAMPLE_LOST_FOUND_ITEMS.filter((item) => item.status === "Shipped"),
  Returned: SAMPLE_LOST_FOUND_ITEMS.filter((item) => item.status === "Returned"),
  Discarded: SAMPLE_LOST_FOUND_ITEMS.filter((item) => item.status === "Discarded"),
};
