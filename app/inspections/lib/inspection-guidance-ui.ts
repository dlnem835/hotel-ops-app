import {
  getHousekeepingVacantReadyItemGuidance,
  isHousekeepingVacantReadyTemplate,
  type ItemGuidance,
} from "./housekeeping-vacant-ready-ui";
import {
  getRpmGuestRoomItemGuidance,
  isRpmGuestRoomTemplate,
} from "./rpm-guest-room-ui";

export function isGuidedInspectionTemplate(
  standardKey: string | null,
  templateName: string
): boolean {
  return (
    isHousekeepingVacantReadyTemplate(standardKey, templateName) ||
    isRpmGuestRoomTemplate(standardKey, templateName)
  );
}

export function getInspectionItemGuidance(
  standardKey: string | null,
  templateName: string,
  categoryKey: string,
  itemKey: string
): ItemGuidance | null {
  if (isHousekeepingVacantReadyTemplate(standardKey, templateName)) {
    return getHousekeepingVacantReadyItemGuidance(categoryKey, itemKey);
  }

  if (isRpmGuestRoomTemplate(standardKey, templateName)) {
    return getRpmGuestRoomItemGuidance(categoryKey, itemKey);
  }

  return null;
}
