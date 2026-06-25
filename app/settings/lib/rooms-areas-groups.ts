import { BuildingArea } from "./buildings-types";

export const AREA_GROUP_FLOORS = [
  "Floor 1",
  "Floor 2",
  "Floor 3",
  "Floor 4",
  "Floor 5",
] as const;

export const AREA_GROUP_BUILDING = "Hotel / Building / Main Areas";

export type AreaAccordionGroup = {
  key: string;
  label: string;
  areas: BuildingArea[];
};

function floorSortValue(floor: string): number {
  const floorMatch = floor.match(/floor\s*(\d+)/i);
  if (floorMatch) return Number(floorMatch[1]);

  const ordinalMatch = floor.match(/^(\d+)/);
  if (ordinalMatch) return Number(ordinalMatch[1]);

  return Number.MAX_SAFE_INTEGER;
}

export function getAreaGroupKey(area: BuildingArea): string {
  if (area.area_type === "Guest Room") {
    return area.floor_location?.trim() || "Floor 1";
  }

  return AREA_GROUP_BUILDING;
}

export function sortAreasInGroup(areas: BuildingArea[]): BuildingArea[] {
  if (areas.length === 0) return areas;

  if (areas.every((area) => area.area_type === "Guest Room")) {
    return [...areas].sort(
      (a, b) => Number(a.name) - Number(b.name) || a.name.localeCompare(b.name)
    );
  }

  return [...areas].sort((a, b) => a.name.localeCompare(b.name));
}

export function groupFilteredAreas(areas: BuildingArea[]): AreaAccordionGroup[] {
  const byGroup = new Map<string, BuildingArea[]>();

  for (const area of areas) {
    const key = getAreaGroupKey(area);
    const list = byGroup.get(key) || [];
    list.push(area);
    byGroup.set(key, list);
  }

  const orderedKeys: string[] = [];

  for (const floor of AREA_GROUP_FLOORS) {
    if (byGroup.has(floor)) {
      orderedKeys.push(floor);
    }
  }

  const otherFloorKeys = [...byGroup.keys()]
    .filter(
      (key) =>
        key !== AREA_GROUP_BUILDING &&
        !AREA_GROUP_FLOORS.includes(key as (typeof AREA_GROUP_FLOORS)[number])
    )
    .sort((a, b) => floorSortValue(a) - floorSortValue(b) || a.localeCompare(b));

  orderedKeys.push(...otherFloorKeys);

  if (byGroup.has(AREA_GROUP_BUILDING)) {
    orderedKeys.push(AREA_GROUP_BUILDING);
  }

  return orderedKeys.map((key) => ({
    key,
    label: key,
    areas: sortAreasInGroup(byGroup.get(key) || []),
  }));
}

export function isGroupFullySelected(
  groupAreas: BuildingArea[],
  selectedIds: Set<number>
): boolean {
  return (
    groupAreas.length > 0 &&
    groupAreas.every((area) => selectedIds.has(area.id))
  );
}

export function isGroupPartiallySelected(
  groupAreas: BuildingArea[],
  selectedIds: Set<number>
): boolean {
  const selectedCount = groupAreas.filter((area) => selectedIds.has(area.id)).length;
  return selectedCount > 0 && selectedCount < groupAreas.length;
}
