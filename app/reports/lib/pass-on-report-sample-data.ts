export type SamplePassOnRow = {
  associate: string;
  shift: string;
  excerpt: string;
  edited: boolean;
  date: string;
};

export const SAMPLE_PASS_ON_ROWS: SamplePassOnRow[] = [
  {
    associate: "J. Martinez",
    shift: "AM",
    excerpt: "Pool pump noise reported in Room 312 wing.",
    edited: false,
    date: "Jun 18, 2026 · 7:45 AM",
  },
  {
    associate: "Front Desk",
    shift: "PM",
    excerpt: "VIP arrival — upgrade confirmed for Room 204.",
    edited: true,
    date: "Jun 17, 2026 · 3:10 PM",
  },
  {
    associate: "D. Chen",
    shift: "Overnight",
    excerpt: "Fire panel test completed without issues.",
    edited: false,
    date: "Jun 17, 2026 · 11:20 PM",
  },
];

export const PASS_ON_USER_FILTER_OPTIONS = [
  "All",
  "J. Martinez",
  "Maddie",
  "Grisell",
  "D. Chen",
  "Rosa",
  "Front Desk — John Smith",
] as const;

export type SamplePassOnUnreadByUserRow = {
  associateName: string;
  department: string;
  totalEntries: number;
  entriesRead: number;
  entriesUnread: number;
  readPercent: number;
  lastEntryReadAt: string;
  lastLoginAt: string | null;
  /** ISO date for report date-range filtering. */
  activityDateIso: string;
};

export type SamplePassOnUnreadEntry = {
  id: string;
  associateName: string;
  excerpt: string;
  shift: string;
  postedAt: string;
  postedAtIso: string;
};

export const SAMPLE_PASS_ON_UNREAD_BY_USER_ROWS: SamplePassOnUnreadByUserRow[] = [
  {
    associateName: "Maddie",
    department: "Housekeeping",
    totalEntries: 18,
    entriesRead: 9,
    entriesUnread: 9,
    readPercent: 50,
    lastEntryReadAt: "Jul 5, 2026 · 6:40 AM",
    lastLoginAt: "Jul 7, 2026 · 7:02 AM",
    activityDateIso: "2026-07-07",
  },
  {
    associateName: "Grisell",
    department: "Housekeeping",
    totalEntries: 16,
    entriesRead: 10,
    entriesUnread: 6,
    readPercent: 63,
    lastEntryReadAt: "Jul 6, 2026 · 2:15 PM",
    lastLoginAt: "Jul 7, 2026 · 6:55 AM",
    activityDateIso: "2026-07-07",
  },
  {
    associateName: "D. Chen",
    department: "Engineering",
    totalEntries: 12,
    entriesRead: 8,
    entriesUnread: 4,
    readPercent: 67,
    lastEntryReadAt: "Jul 7, 2026 · 8:10 AM",
    lastLoginAt: "Jul 7, 2026 · 7:45 AM",
    activityDateIso: "2026-07-07",
  },
  {
    associateName: "J. Martinez",
    department: "Front Desk",
    totalEntries: 14,
    entriesRead: 11,
    entriesUnread: 3,
    readPercent: 79,
    lastEntryReadAt: "Jul 7, 2026 · 7:30 AM",
    lastLoginAt: "Jul 7, 2026 · 7:28 AM",
    activityDateIso: "2026-07-07",
  },
  {
    associateName: "Rosa",
    department: "Housekeeping",
    totalEntries: 10,
    entriesRead: 9,
    entriesUnread: 1,
    readPercent: 90,
    lastEntryReadAt: "Jul 7, 2026 · 6:50 AM",
    lastLoginAt: "Jul 7, 2026 · 6:48 AM",
    activityDateIso: "2026-07-07",
  },
  {
    associateName: "Front Desk — John Smith",
    department: "Front Desk",
    totalEntries: 15,
    entriesRead: 15,
    entriesUnread: 0,
    readPercent: 100,
    lastEntryReadAt: "Jul 7, 2026 · 8:00 AM",
    lastLoginAt: "Jul 7, 2026 · 7:59 AM",
    activityDateIso: "2026-07-07",
  },
];

export const SAMPLE_PASS_ON_UNREAD_ENTRIES: SamplePassOnUnreadEntry[] = [
  {
    id: "po-unread-01",
    associateName: "Maddie",
    excerpt: "Room 418 guest requested late checkout until 2 PM.",
    shift: "AM",
    postedAt: "Jul 7, 2026 · 7:10 AM",
    postedAtIso: "2026-07-07",
  },
  {
    id: "po-unread-02",
    associateName: "Maddie",
    excerpt: "Housekeeping cart left in south elevator lobby — please retrieve.",
    shift: "AM",
    postedAt: "Jul 6, 2026 · 8:05 AM",
    postedAtIso: "2026-07-06",
  },
  {
    id: "po-unread-03",
    associateName: "Maddie",
    excerpt: "VIP amenity setup needed for Room 204 before 4 PM.",
    shift: "PM",
    postedAt: "Jul 5, 2026 · 3:20 PM",
    postedAtIso: "2026-07-05",
  },
  {
    id: "po-unread-04",
    associateName: "Grisell",
    excerpt: "Pool chemical log needs supervisor signature.",
    shift: "AM",
    postedAt: "Jul 7, 2026 · 6:30 AM",
    postedAtIso: "2026-07-07",
  },
  {
    id: "po-unread-05",
    associateName: "Grisell",
    excerpt: "Lost & Found item waiting for guest pickup at front desk.",
    shift: "PM",
    postedAt: "Jul 6, 2026 · 4:45 PM",
    postedAtIso: "2026-07-06",
  },
  {
    id: "po-unread-06",
    associateName: "D. Chen",
    excerpt: "Boiler room temperature reading flagged on overnight round.",
    shift: "Overnight",
    postedAt: "Jul 7, 2026 · 1:15 AM",
    postedAtIso: "2026-07-07",
  },
  {
    id: "po-unread-07",
    associateName: "J. Martinez",
    excerpt: "Group block arrival manifest updated in shared folder.",
    shift: "AM",
    postedAt: "Jul 7, 2026 · 7:05 AM",
    postedAtIso: "2026-07-07",
  },
  {
    id: "po-unread-08",
    associateName: "Rosa",
    excerpt: "Mini-fridge delivery scheduled for Room 312 at 11 AM.",
    shift: "AM",
    postedAt: "Jul 7, 2026 · 6:35 AM",
    postedAtIso: "2026-07-07",
  },
];
