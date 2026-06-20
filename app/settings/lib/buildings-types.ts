export const AREA_TYPES = [
  "Guest Room",
  "Public Area",
  "Back Of House",
  "Mechanical",
  "Exterior",
] as const;

export const AREA_STATUSES = [
  "Active",
  "Out of Service",
  "Inactive",
] as const;

export const FLOOR_LOCATIONS = [
  "Floor 1",
  "Floor 2",
  "Floor 3",
  "Floor 4",
  "Floor 5",
  "Floor 6",
  "Floor 7",
  "Floor 8",
  "Floor 9",
  "Floor 10",
  "Main Level",
  "Exterior",
  "Back Of House",
  "Roof",
] as const;

export type AreaType = (typeof AREA_TYPES)[number];
export type AreaStatus = (typeof AREA_STATUSES)[number];
export type FloorLocation = (typeof FLOOR_LOCATIONS)[number];

export type BuildingArea = {
  id: number;
  name: string;
  area_type: AreaType;
  floor_location: string;
  status: AreaStatus;
  inspection_enabled: boolean;
  created_at: string;
};

export type BuildingAreaInput = {
  name: string;
  area_type: AreaType;
  floor_location: string;
  status: AreaStatus;
  inspection_enabled?: boolean;
};

export type GenerateRoomsInput = {
  startRoom: number;
  endRoom: number;
  floor: string;
  areaType: AreaType;
  skipRooms?: string;
};

export type RoomRangeInput = {
  startRoom: number | string;
  endRoom: number | string;
  floor: string;
  areaType: AreaType;
  skipRooms?: string;
};
