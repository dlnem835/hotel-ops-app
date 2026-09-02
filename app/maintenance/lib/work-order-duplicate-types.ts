export type DuplicateWorkOrderCandidate = {
  id: number;
  subject: string;
  description: string | null;
  item: string | null;
  areaLabel: string | null;
  areaId: number | null;
  status: string;
  createdAt: string;
  createdBy: string | null;
  createdByLabel: string | null;
  matchReason: string;
};
