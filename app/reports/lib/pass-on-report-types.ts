import type {
  PassOnReportFilters,
  PassOnUnreadReportFilters,
} from "@/app/reports/lib/report-definitions";

export type PassOnStandardReportFilters = PassOnReportFilters;
export type PassOnUnreadReportFiltersExtended = PassOnUnreadReportFilters;

export type PassOnShiftName = "AM Shift" | "PM Shift" | "Night Audit" | "Other";

export type PassOnReportTeamMember = {
  authUserId: string;
  username: string | null;
  firstName: string | null;
  lastName: string | null;
  department: string | null;
  displayName: string;
};

export type PassOnReportSourceEntry = {
  id: number;
  subject: string;
  message: string;
  authorStored: string;
  authorDisplay: string;
  authorAuthUserId: string | null;
  priority: string;
  shift: PassOnShiftName;
  entryDate: string;
  createdAt: string;
  editedAt: string | null;
  isEdited: boolean;
  preview: string;
  views: Array<{ auth_user_id: string; viewed_at: string | null }>;
  replies: Array<{ created_at: string | null }>;
  readCount: number;
  unreadCount: number;
};

export type PassOnReportSource = {
  entries: PassOnReportSourceEntry[];
  teamMembers: PassOnReportTeamMember[];
  filterOptions: {
    createdByOptions: string[];
    departmentOptions: string[];
    userOptions: Array<{ authUserId: string; displayName: string; department: string }>;
  };
};

export type PassOnReportDetailRow = {
  entryId: number;
  subject: string;
  shift: PassOnShiftName;
  priority: string;
  createdAt: string;
  createdAtDisplay: string;
  editedAt: string | null;
  editedAtDisplay: string;
  preview: string;
  readCount: number;
  unreadCount: number;
};

export type PassOnAssociateGroupRow = {
  associateKey: string;
  associateName: string;
  totalPublished: number;
  normalCount: number;
  importantCount: number;
  urgentCount: number;
  editedCount: number;
  mostRecentAt: string;
  mostRecentAtDisplay: string;
  entries: PassOnReportDetailRow[];
};

export type PassOnShiftGroupRow = {
  shiftKey: PassOnShiftName;
  shiftName: PassOnShiftName;
  totalPublished: number;
  normalCount: number;
  importantCount: number;
  urgentCount: number;
  editedCount: number;
  mostRecentAt: string;
  mostRecentAtDisplay: string;
  entries: Array<
    PassOnReportDetailRow & {
      createdBy: string;
    }
  >;
};

export type PassOnEditedEntryRow = {
  entryId: number;
  subject: string;
  shift: PassOnShiftName;
  priority: string;
  createdBy: string;
  createdAt: string;
  createdAtDisplay: string;
  editedAt: string;
  editedAtDisplay: string;
  editedBy: string | null;
  preview: string;
};

export type PassOnKeywordSnippet = {
  before: string;
  match: string;
  after: string;
};

export type PassOnKeywordSearchRow = {
  entryId: number;
  subject: string;
  snippet: PassOnKeywordSnippet;
  shift: PassOnShiftName;
  priority: string;
  createdBy: string;
  createdAt: string;
  createdAtDisplay: string;
  editedAt: string | null;
  editedAtDisplay: string;
};

export type PassOnUnreadDetailRow = {
  entryId: number;
  subject: string;
  shift: PassOnShiftName;
  priority: string;
  createdBy: string;
  createdAt: string;
  createdAtDisplay: string;
  ageLabel: string;
  ageMs: number;
};

export type PassOnUnreadByUserRow = {
  userAuthUserId: string;
  userName: string;
  department: string;
  totalAvailable: number;
  entriesRead: number;
  entriesUnread: number;
  readPercent: number;
  lastEntryReadAt: string | null;
  lastEntryReadAtDisplay: string;
  unreadEntries: PassOnUnreadDetailRow[];
};
