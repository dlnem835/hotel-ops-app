export type AttentionSeverity = "critical" | "warning";

export type AttentionItem = {
  id: string;
  label: string;
  count: number;
  href: string;
  severity: AttentionSeverity;
};

export type PassOnLogEntry = {
  id: number;
  subject: string;
  author: string;
  message: string;
  priority: string;
  entryDate: string;
};

export type PassOnLogDay = "today" | "yesterday" | "tomorrow";

export type DashboardWorkOrder = {
  id: number;
  subject: string;
  priority: string;
  areaLabel: string | null;
};

export type OperationalDashboardPayload = {
  needsAttention: AttentionItem[];
  passOnLog: Record<PassOnLogDay, PassOnLogEntry[]>;
  workOrders: DashboardWorkOrder[];
  openWorkOrderCount: number;
  lostFound: {
    readyToShip: number;
    storedToday: number;
  };
};
