import { BuildingArea } from "@/app/settings/lib/buildings-types";
import {
  groupFilteredAreas,
  sortAreasInGroup,
} from "@/app/settings/lib/rooms-areas-groups";

export function getActiveGuestRooms(areas: BuildingArea[]): BuildingArea[] {
  return sortAreasInGroup(
    areas.filter(
      (area) => area.area_type === "Guest Room" && area.status === "Active"
    )
  );
}

export function getActiveNonGuestAreas(areas: BuildingArea[]): BuildingArea[] {
  return areas.filter(
    (area) => area.area_type !== "Guest Room" && area.status === "Active"
  );
}

export function getGroupedNonGuestAreas(areas: BuildingArea[]) {
  return groupFilteredAreas(getActiveNonGuestAreas(areas));
}

export function formatRoomLabel(area: BuildingArea): string {
  return `Room ${area.name}`;
}

export type WorkOrderLocationOption = {
  id: number;
  label: string;
  searchText: string;
};

export function buildWorkOrderLocationOptions(
  areas: BuildingArea[]
): WorkOrderLocationOption[] {
  const roomOptions = getActiveGuestRooms(areas).map((room) => ({
    id: room.id,
    label: formatRoomLabel(room),
    searchText: `room ${room.name} ${room.name}`.toLowerCase(),
  }));

  const areaOptions = getActiveNonGuestAreas(areas).map((area) => ({
    id: area.id,
    label: area.name,
    searchText: `${area.name} ${area.area_type} ${area.floor_location}`.toLowerCase(),
  }));

  return [...roomOptions, ...areaOptions].sort((a, b) =>
    a.label.localeCompare(b.label, undefined, { numeric: true })
  );
}

export function filterWorkOrderLocationOptions(
  options: WorkOrderLocationOption[],
  query: string,
  limit = 20
): WorkOrderLocationOption[] {
  const trimmed = query.trim().toLowerCase();
  if (!trimmed) {
    return options.slice(0, limit);
  }

  return options
    .filter(
      (option) =>
        option.searchText.includes(trimmed) ||
        option.label.toLowerCase().includes(trimmed)
    )
    .slice(0, limit);
}

export function resolveWorkOrderLocationFromSelection(input: {
  selectedLocationId: number | null;
  customLocation: string;
  areas: BuildingArea[];
}): { area_id: number | null; area_label: string | null } {
  if (input.selectedLocationId) {
    const match = input.areas.find((area) => area.id === input.selectedLocationId);
    if (match) {
      const label =
        match.area_type === "Guest Room" ? formatRoomLabel(match) : match.name;
      return { area_id: match.id, area_label: label };
    }
  }

  const custom = input.customLocation.trim();
  if (custom) {
    return { area_id: null, area_label: custom };
  }

  return { area_id: null, area_label: null };
}

export function resolveWorkOrderLocation(input: {
  selectedRoomId: number | null;
  selectedAreaId: number | null;
  otherLocation: string;
  rooms: BuildingArea[];
  areas: BuildingArea[];
}): { area_id: number | null; area_label: string | null } {
  if (input.selectedRoomId) {
    const room = input.rooms.find((area) => area.id === input.selectedRoomId);
    if (room) {
      return { area_id: room.id, area_label: formatRoomLabel(room) };
    }
  }

  if (input.selectedAreaId) {
    const area = input.areas.find((entry) => entry.id === input.selectedAreaId);
    if (area) {
      return { area_id: area.id, area_label: area.name };
    }
  }

  const other = input.otherLocation.trim();
  if (other) {
    return { area_id: null, area_label: other };
  }

  return { area_id: null, area_label: null };
}

export function inferInitialLocationSelection(
  areas: BuildingArea[],
  initialAreaId?: number | null,
  initialAreaLabel?: string | null
): {
  selectedLocationId: number | null;
  selectedLocationLabel: string;
  customLocation: string;
} {
  if (initialAreaId) {
    const match = areas.find((area) => area.id === initialAreaId);
    if (match) {
      const label =
        match.area_type === "Guest Room" ? formatRoomLabel(match) : match.name;
      return {
        selectedLocationId: match.id,
        selectedLocationLabel: label,
        customLocation: "",
      };
    }
  }

  if (initialAreaLabel?.trim()) {
    const label = initialAreaLabel.trim();
    const roomMatch = label.match(/^room\s+(\S+)/i);
    if (roomMatch) {
      const room = areas.find(
        (area) =>
          area.area_type === "Guest Room" && area.name === roomMatch[1]
      );
      if (room) {
        return {
          selectedLocationId: room.id,
          selectedLocationLabel: formatRoomLabel(room),
          customLocation: "",
        };
      }
    }

    const areaMatch = areas.find(
      (area) =>
        area.area_type !== "Guest Room" &&
        area.name.toLowerCase() === label.toLowerCase()
    );
    if (areaMatch) {
      return {
        selectedLocationId: areaMatch.id,
        selectedLocationLabel: areaMatch.name,
        customLocation: "",
      };
    }

    return {
      selectedLocationId: null,
      selectedLocationLabel: "",
      customLocation: label,
    };
  }

  return {
    selectedLocationId: null,
    selectedLocationLabel: "",
    customLocation: "",
  };
}
