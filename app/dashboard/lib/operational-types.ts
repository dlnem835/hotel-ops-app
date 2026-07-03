export type PassOnLogEntry = {
  id: number;
  subject: string;
  author: string;
  message: string;
  priority: string;
  entryDate: string;
  createdAt: string;
  editedAt?: string | null;
};

export type PassOnLogDay = "today" | "yesterday" | "tomorrow";

export type DashboardWorkOrder = {
  id: number;
  subject: string;
  priority: string;
  areaLabel: string | null;
};

export type TodaysWorkCard = {
  label: string | null;
  href: string;
};

export type PastDueSummary = {
  pms: number;
  vrInspections: number;
  rpmInspections: number;
  hrefs: {
    pms: string;
    vrInspections: string;
    rpmInspections: string;
  };
};

export type OperationalDashboardPayload = {
  todaysWork: {
    pms: TodaysWorkCard;
    rpms: TodaysWorkCard;
  };
  pastDue: PastDueSummary;
  passOnLog: Record<PassOnLogDay, PassOnLogEntry[]>;
  workOrders: DashboardWorkOrder[];
  openWorkOrderCount: number;
  lostFound: {
    readyToShip: number;
    storedToday: number;
  };
};
