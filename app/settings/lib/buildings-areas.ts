import {
  AreaStatus,
  AreaType,
  BuildingAreaInput,
  GenerateRoomsInput,
} from "./buildings-types";

export const GOLD = "#C8A96A";
export const ROW = "#302D28";
export const BLACK = "#111111";

export const PROPERTY_UTILITY_AREA_NAME = "Hotel / Building / Main";

export const STANDARD_HOTEL_AREAS: BuildingAreaInput[] = [
  { name: "Hotel / Building / Main", area_type: "Back Of House", floor_location: "Building", status: "Active" },
  { name: "Lobby", area_type: "Public Area", floor_location: "Main Level", status: "Active" },
  { name: "Breakfast Area", area_type: "Public Area", floor_location: "Main Level", status: "Active" },
  { name: "Market Area", area_type: "Public Area", floor_location: "Main Level", status: "Active" },
  { name: "Kitchen Area", area_type: "Back Of House", floor_location: "Main Level", status: "Active" },
  { name: "Employee Breakroom", area_type: "Back Of House", floor_location: "Main Level", status: "Active" },
  { name: "Fitness Center", area_type: "Public Area", floor_location: "Main Level", status: "Active" },
  { name: "Pool", area_type: "Exterior", floor_location: "Exterior", status: "Active" },
  { name: "Laundry", area_type: "Back Of House", floor_location: "First Floor", status: "Active" },
  { name: "Meeting Room", area_type: "Public Area", floor_location: "Main Level", status: "Active" },
  { name: "Public Restrooms", area_type: "Public Area", floor_location: "Main Level", status: "Active" },
  { name: "Elevator 1", area_type: "Back Of House", floor_location: "Main Level", status: "Active" },
  { name: "Elevator 2", area_type: "Back Of House", floor_location: "Main Level", status: "Active" },
  { name: "Parking Lot", area_type: "Exterior", floor_location: "Exterior", status: "Active" },
  { name: "Dumpster Area", area_type: "Exterior", floor_location: "Exterior", status: "Active" },
  { name: "Roof", area_type: "Exterior", floor_location: "Exterior", status: "Active" },
  { name: "Electrical Room", area_type: "Mechanical", floor_location: "Back of House", status: "Active" },
  { name: "Mechanical Room", area_type: "Mechanical", floor_location: "Back of House", status: "Active" },
  { name: "Hot Water Heater Room", area_type: "Mechanical", floor_location: "Back of House", status: "Active" },
  { name: "Pool Mechanical Room", area_type: "Mechanical", floor_location: "Back of House", status: "Active" },
  { name: "Riser Room", area_type: "Mechanical", floor_location: "Back of House", status: "Active" },
  { name: "Engineering Office", area_type: "Back Of House", floor_location: "Main Level", status: "Active" },
  { name: "Back Office", area_type: "Back Of House", floor_location: "Main Level", status: "Active" },
  { name: "Housekeeping Closet", area_type: "Back Of House", floor_location: "Various", status: "Active" },
  { name: "Housekeeping Office", area_type: "Back Of House", floor_location: "First Floor", status: "Active" },
  { name: "Security Office", area_type: "Back Of House", floor_location: "Main Level", status: "Active" },
  { name: "Manager Office", area_type: "Back Of House", floor_location: "Main Level", status: "Active" },
  { name: "Storage Room", area_type: "Back Of House", floor_location: "First Floor", status: "Active" },
  { name: "Staircase North", area_type: "Back Of House", floor_location: "Main Level", status: "Active" },
  { name: "Staircase South", area_type: "Back Of House", floor_location: "Main Level", status: "Active" },
  { name: "Exterior North", area_type: "Exterior", floor_location: "Exterior", status: "Active" },
  { name: "Exterior South", area_type: "Exterior", floor_location: "Exterior", status: "Active" },
  { name: "Exterior East", area_type: "Exterior", floor_location: "Exterior", status: "Active" },
  { name: "Exterior West", area_type: "Exterior", floor_location: "Exterior", status: "Active" },
  { name: "Exterior Landscaping", area_type: "Exterior", floor_location: "Exterior", status: "Active" },
  { name: "Bar", area_type: "Public Area", floor_location: "Main Level", status: "Active" },
  { name: "Fire Pit Area", area_type: "Exterior", floor_location: "Exterior", status: "Active" },
  { name: "1st Floor Hallway", area_type: "Public Area", floor_location: "1st Floor", status: "Active" },
  { name: "2nd Floor Hallway", area_type: "Public Area", floor_location: "2nd Floor", status: "Active" },
  { name: "3rd Floor Hallway", area_type: "Public Area", floor_location: "3rd Floor", status: "Active" },
  { name: "4th Floor Hallway", area_type: "Public Area", floor_location: "4th Floor", status: "Active" },
  { name: "5th Floor Hallway", area_type: "Public Area", floor_location: "5th Floor", status: "Active" },
];

export function normalizeRoomName(name: string): string {
  const trimmed = name.trim();
  const roomPrefix = /^room\s+/i;
  return trimmed.replace(roomPrefix, "");
}

export function parseSkipRooms(skipRooms?: string): Set<number> {
  if (!skipRooms?.trim()) return new Set();

  return new Set(
    skipRooms
      .split(/[,;\s]+/)
      .map((value) => Number(value.trim()))
      .filter((value) => !Number.isNaN(value))
  );
}

export function generateRoomRecords(input: GenerateRoomsInput): BuildingAreaInput[] {
  const { startRoom, endRoom, floor, areaType, skipRooms } = input;
  const skipped = parseSkipRooms(skipRooms);
  const records: BuildingAreaInput[] = [];

  const start = Math.min(startRoom, endRoom);
  const end = Math.max(startRoom, endRoom);

  for (let room = start; room <= end; room += 1) {
    if (skipped.has(room)) continue;

    records.push({
      name: String(room),
      area_type: areaType,
      floor_location: floor,
      status: "Active",
      inspection_enabled: true,
    });
  }

  return records;
}

export function getTileLabel(name: string, areaType: AreaType): string {
  if (areaType === "Guest Room") {
    return normalizeRoomName(name);
  }

  return name;
}

export function sortPropertyGridAreas<T extends { name: string; area_type: AreaType }>(
  areas: T[]
): T[] {
  const utility = areas.filter((area) => area.name === PROPERTY_UTILITY_AREA_NAME);
  const guestRooms = areas
    .filter((area) => area.area_type === "Guest Room")
    .sort((a, b) => Number(a.name) - Number(b.name));
  const otherAreas = areas
    .filter(
      (area) =>
        area.area_type !== "Guest Room" &&
        area.name !== PROPERTY_UTILITY_AREA_NAME
    )
    .sort((a, b) => a.name.localeCompare(b.name));

  return [...utility, ...guestRooms, ...otherAreas];
}

export function getTileStyle(areaType: AreaType, status: AreaStatus) {
  const forestBg = "rgba(28, 52, 40, 0.72)";
  const forestBgMuted = "rgba(24, 44, 34, 0.55)";
  const forestBorder = "#3d6b4f";
  const forestBorderMuted = "#2f5240";
  const forestText = "#b8d4c4";
  const forestTextMuted = "#8fa899";

  if (status === "Out of Service") {
    return {
      background: "rgba(28, 28, 28, 0.85)",
      border: "#8B5252",
      color: "#C9A8A8",
      showTypeLabel: areaType !== "Guest Room",
    };
  }

  if (status === "Inactive") {
    return {
      background: "rgba(36, 36, 36, 0.75)",
      border: "#5a5a5a",
      color: "#9CA3AF",
      showTypeLabel: areaType !== "Guest Room",
    };
  }

  if (areaType === "Guest Room") {
    return {
      background: forestBg,
      border: forestBorder,
      color: forestText,
      showTypeLabel: false,
    };
  }

  if (areaType === "Public Area") {
    return {
      background: forestBgMuted,
      border: forestBorderMuted,
      color: forestTextMuted,
      showTypeLabel: true,
    };
  }

  return {
    background: "rgba(22, 40, 32, 0.65)",
    border: "#355244",
    color: forestTextMuted,
    showTypeLabel: true,
  };
}

/** @deprecated use getTileStyle */
export function getStatusColors(status: AreaStatus) {
  return getTileStyle("Guest Room", status);
}

export function getAreaTypeAbbrev(areaType: AreaType): string {
  if (areaType === "Public Area") return "PA";
  if (areaType === "Back Of House") return "BOH";
  if (areaType === "Mechanical") return "MECH";
  if (areaType === "Exterior") return "EXT";
  return "";
}

export function formatSetupResult(created: number, skipped: number): string {
  if (created === 0 && skipped > 0) {
    return `No new locations created. Skipped ${skipped} duplicate${skipped === 1 ? "" : "s"}.`;
  }
  if (skipped > 0) {
    return `Created ${created} location${created === 1 ? "" : "s"}. Skipped ${skipped} duplicate${skipped === 1 ? "" : "s"}.`;
  }
  return `Created ${created} location${created === 1 ? "" : "s"}.`;
}

export function formatStandardAreasResult(
  created: number,
  skipped: number,
  addedNames: string[] = []
): string {
  if (created === 0) {
    return "All standard hotel areas are already in your property.";
  }

  const preview =
    addedNames.length > 0
      ? ` Added: ${addedNames.slice(0, 5).join(", ")}${
          addedNames.length > 5 ? ` +${addedNames.length - 5} more` : ""
        }.`
      : "";

  if (skipped > 0) {
    return `Added ${created} standard area${created === 1 ? "" : "s"}.${preview} Skipped ${skipped} existing.`;
  }

  return `Added ${created} standard area${created === 1 ? "" : "s"}.${preview}`;
}

export function getMissingStandardAreas(
  existing: Array<{ name: string; area_type: AreaType }>
): BuildingAreaInput[] {
  const existingKeys = new Set(
    existing.map((row) => getNameKey(row.name, row.area_type))
  );

  return STANDARD_HOTEL_AREAS.filter(
    (area) => !existingKeys.has(getNameKey(area.name, area.area_type))
  );
}

function normalizeStatus(value: string): AreaStatus | null {
  const normalized = value.trim().toLowerCase();

  if (normalized === "active") return "Active";
  if (normalized === "out of service" || normalized === "out of inventory") {
    return "Out of Service";
  }
  if (normalized === "inactive") return "Inactive";

  return null;
}

function normalizeAreaType(value: string): AreaType | null {
  const normalized = value.trim().toLowerCase();

  if (normalized === "guest room") return "Guest Room";
  if (normalized === "public area") return "Public Area";
  if (normalized === "back of house") return "Back Of House";
  if (normalized === "mechanical") return "Mechanical";
  if (normalized === "exterior") return "Exterior";

  return null;
}

export function parseCsvRows(csvText: string): {
  records: BuildingAreaInput[];
  errors: string[];
} {
  const lines = csvText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  const records: BuildingAreaInput[] = [];
  const errors: string[] = [];

  lines.forEach((line, index) => {
    const rowNumber = index + 1;
    const parts = line.split(",").map((part) => part.trim().replace(/^"|"$/g, ""));

    if (parts.length < 4) {
      errors.push(`Row ${rowNumber}: expected 4 columns (name, area_type, floor_location, status)`);
      return;
    }

    const [rawName, rawType, rawFloor, rawStatus] = parts;
    const areaType = normalizeAreaType(rawType);

    if (!areaType) {
      errors.push(`Row ${rowNumber}: invalid area_type "${rawType}"`);
      return;
    }

    const status = normalizeStatus(rawStatus);
    if (!status) {
      errors.push(`Row ${rowNumber}: invalid status "${rawStatus}"`);
      return;
    }

    const name =
      areaType === "Guest Room" ? normalizeRoomName(rawName) : rawName.trim();

    if (!name) {
      errors.push(`Row ${rowNumber}: name is required`);
      return;
    }

    records.push({
      name,
      area_type: areaType,
      floor_location: rawFloor,
      status,
      inspection_enabled: true,
    });
  });

  return { records, errors };
}

export function normalizeLocationName(name: string, areaType?: AreaType): string {
  const trimmed = name.trim();
  if (areaType === "Guest Room" || /^\d/.test(trimmed) || /^room\s+/i.test(trimmed)) {
    return normalizeRoomName(trimmed);
  }
  return trimmed;
}

export function getNameKey(name: string, areaType?: AreaType): string {
  return normalizeLocationName(name, areaType).trim().toLowerCase();
}

export function partitionNewRecords(
  records: BuildingAreaInput[],
  existingNames: Set<string>
): { toInsert: BuildingAreaInput[]; skipped: number } {
  const seen = new Set(existingNames);
  const toInsert: BuildingAreaInput[] = [];
  let skipped = 0;

  for (const record of records) {
    const key = getNameKey(record.name, record.area_type);

    if (!key || seen.has(key)) {
      skipped += 1;
      continue;
    }

    seen.add(key);
    toInsert.push({
      ...record,
      name: normalizeLocationName(record.name, record.area_type),
    });
  }

  return { toInsert, skipped };
}

export function filterNewRecords(
  records: BuildingAreaInput[],
  existingNames: Set<string>
): BuildingAreaInput[] {
  return partitionNewRecords(records, existingNames).toInsert;
}
