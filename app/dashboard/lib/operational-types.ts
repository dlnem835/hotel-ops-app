export type TodaysWorkCard = {
  label: string | null;
  href: string;
};

export type PassOnDashboardKpis = {
  newEntries: number;
  unread: number;
  newReplies: number;
  hrefs: {
    newEntries: string;
    unread: string;
    newReplies: string;
  };
};

export type OperationalDashboardPayload = {
  todaysWork: {
    pms: TodaysWorkCard;
    rpms: TodaysWorkCard;
  };
  passOnKpis: PassOnDashboardKpis;
  /** Full open work orders — same shape/order as Maintenance WO Priority Queue. */
  workOrders: import("@/app/maintenance/lib/maintenance-types").WorkOrder[];
  openWorkOrderCount: number;
  lostFound: {
    readyToShip: number;
    storedToday: number;
  };
};
