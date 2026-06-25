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
  selectedRoomId: number | null;
  selectedAreaId: number | null;
  otherLocation: string;
} {
  if (initialAreaId) {
    const match = areas.find((area) => area.id === initialAreaId);
    if (match?.area_type === "Guest Room") {
      return {
        selectedRoomId: match.id,
        selectedAreaId: null,
        otherLocation: "",
      };
    }
    if (match) {
      return {
        selectedRoomId: null,
        selectedAreaId: match.id,
        otherLocation: "",
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
        return { selectedRoomId: room.id, selectedAreaId: null, otherLocation: "" };
      }
    }

    const areaMatch = areas.find(
      (area) =>
        area.area_type !== "Guest Room" &&
        area.name.toLowerCase() === label.toLowerCase()
    );
    if (areaMatch) {
      return { selectedRoomId: null, selectedAreaId: areaMatch.id, otherLocation: "" };
    }

    return { selectedRoomId: null, selectedAreaId: null, otherLocation: label };
  }

  return { selectedRoomId: null, selectedAreaId: null, otherLocation: "" };
}
