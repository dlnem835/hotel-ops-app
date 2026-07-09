export type LostFoundReportItem = {
  id: string;
  guestLastName: string;
  roomNumber: string;
  itemName: string;
  status: string;
  foundBy: string;
  createdBy: string;
  comments: string;
  createdAt: string;
  createdAtIso: string;
  labelUrl: string | null;
  labelSentAt: string | null;
  /** Closest available shipped timestamp — no shipped_at column yet. */
  shippedAt: string | null;
  daysStored: number | null;
};

export type LostFoundFoundByRow = {
  associateName: string;
  /** Resolved from team_members when found_by matches a member name. */
  department: string;
  itemsFound: number;
  lastItemFoundDate: string;
  lastItemFoundDateIso: string;
  mostRecentItem: string;
  lastFoundLocation: string;
};

export type LostFoundFilterOptions = {
  foundBy: string[];
  createdBy: string[];
};
