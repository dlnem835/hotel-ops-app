import type { ItemGuidance } from "./housekeeping-vacant-ready-ui";

export const RPM_GUEST_ROOM_STANDARD_KEY = "rpm-guest-room";
const RPM_GUEST_ROOM_TEMPLATE_NAME = "rpm guest room";

const RPM_ITEM_GUIDANCE: Record<string, ItemGuidance> = {
  "entry::door-lock": {
    label: "Door Lock",
    inspect: ["Key Reader", "Indicator Light", "Handle", "Deadbolt", "Battery Cover"],
  },
  "entry::door-latch": {
    label: "Entry Door & Hardware",
    inspect: ["Door", "Latch", "Peephole", "Frame", "Hinges"],
  },
  "entry::odor": {
    label: "Room Odor",
    inspect: ["Entry Impression", "HVAC Airflow", "Bathroom Drains"],
  },
  "bath::faucets-shower": {
    label: "Faucets / Shower",
    inspect: ["Sink Faucet", "Handles", "Aerator", "Tub Spout", "Showerhead", "Diverter"],
  },
  "bath::bath-doors": {
    label: "Bath Door",
    inspect: ["Front & Back", "Frame", "Hinges", "Handle", "Lock"],
  },
  "bath::shower-doors": {
    label: "Shower Doors / Curtain",
    inspect: ["Glass / Curtain", "Liner", "Tracks / Rod", "Rollers / Hooks", "Handle"],
  },
  "bath::drains-odor": {
    label: "Drains",
    inspect: ["Sink Drain", "Tub / Shower Drain", "Overflow", "Water Flow", "Odor"],
  },
  "bath::caulking": {
    label: "Caulking",
    inspect: ["Shower / Tub Perimeter", "Toilet Base", "Wall Seams", "Grout Joints"],
  },
  "bath::toilet": {
    label: "Toilet",
    inspect: ["Bowl", "Seat", "Lid", "Tank", "Base", "Flush Handle", "Supply Line", "Bolt Caps"],
  },
  "bedroom::hvac": {
    label: "HVAC",
    inspect: ["Thermostat", "Air Filter", "Drain Pan", "Supply Vent", "Return Vent", "Airflow"],
  },
  "bedroom::windows": {
    label: "Windows / Screens",
    inspect: ["Glass", "Screens", "Tracks", "Locks", "Seals", "Operation"],
  },
  "bedroom::furniture": {
    label: "Furniture",
    inspect: ["Dressers", "Chairs", "Desk", "Drawers", "Fasteners", "Hardware"],
  },
  "bedroom::electrical": {
    label: "Electrical",
    inspect: ["Outlets", "GFCI Outlets", "Switches", "Lamps", "Plugs / Cords"],
  },
  "bedroom::tv-phone": {
    label: "Television / Phone",
    inspect: ["Screen", "Base / Mount", "Remote", "Picture", "Phone", "Dial Tone"],
  },
  "bedroom::ceiling-walls": {
    label: "Ceiling / Walls",
    inspect: ["Ceiling", "Walls", "Baseboards", "Corners", "Signs of Water Intrusion"],
  },
  "closet::safe": {
    label: "Safe",
    inspect: ["Interior", "Door", "Hinges", "Keypad", "Instructions", "Reset Status"],
  },
  "closet::iron-board": {
    label: "Iron / Ironing Board",
    inspect: ["Iron", "Water Reservoir", "Cord", "Board Cover", "Legs / Caps", "Stability"],
  },
  "closet::hangers-rack": {
    label: "Hangers / Luggage Rack",
    inspect: ["Hanger Quantity", "Hanger Types", "Rack Straps", "Rack Frame", "Placement"],
  },
  "closet::closet-door": {
    label: "Closet Door / Hardware",
    inspect: ["Door", "Track", "Hinges", "Handle", "Guides / Stops", "Operation"],
  },
};

export function getRpmGuestRoomItemGuidance(
  categoryKey: string,
  itemKey: string
): ItemGuidance | null {
  return RPM_ITEM_GUIDANCE[`${categoryKey}::${itemKey}`] ?? null;
}

export function isRpmGuestRoomTemplate(
  standardKey: string | null,
  templateName: string
): boolean {
  return (
    standardKey === RPM_GUEST_ROOM_STANDARD_KEY ||
    templateName.trim().toLowerCase() === RPM_GUEST_ROOM_TEMPLATE_NAME
  );
}
