export const HOUSEKEEPING_VACANT_READY_STANDARD_KEY = "hk-vacant-ready";
const HOUSEKEEPING_VACANT_READY_TEMPLATE_NAME = "housekeeping vacant ready";

export const GENERAL_INSPECTION_STANDARDS = [
  "Cleanliness",
  "Damage",
  "Stains",
  "Scratches",
  "Scuffs",
  "Dust or debris",
  "Hair",
  "Proper placement",
  "Proper operation, where applicable",
  "Missing or damaged components",
] as const;

export type ItemGuidance = {
  label: string;
  inspect: readonly string[];
};

const ITEM_GUIDANCE: Record<string, ItemGuidance> = {
  "entry::door": {
    label: "Door",
    inspect: ["Peephole", "Front & Back", "Door Frame", "Hinges", "Handle", "Lock"],
  },
  "entry::floor": {
    label: "Entry Floor",
    inspect: ["Carpet Edges", "Threshold", "Area Around Door"],
  },
  "entry::smell": {
    label: "Room Scent",
    inspect: ["Entry Impression", "Air Quality"],
  },
  "entry::temperature": {
    label: "Room Temperature",
    inspect: ["Thermostat Setting", "Airflow"],
  },
  "closet::hangers": {
    label: "Hangers",
    inspect: ["Quantity", "Type", "Placement"],
  },
  "closet::laundry-bag": {
    label: "Laundry Bag / Ticket",
    inspect: ["Laundry Bag", "Laundry Ticket", "Placement"],
  },
  "closet::iron": {
    label: "Iron",
    inspect: ["Water Reservoir", "Soleplate", "Cord", "Storage Position"],
  },
  "closet::ironing-board": {
    label: "Ironing Board",
    inspect: ["Cover", "Leg Caps", "Stability", "Storage Position"],
  },
  "closet::linen-bag": {
    label: "Linen Storage Bag",
    inspect: ["Vinyl Zipper Bag", "Zipper", "Pillow", "Storage Position"],
  },
  "bedroom::bed": {
    label: "Bed",
    inspect: ["Sheets", "Duvet / Bedspread", "Mattress Edges", "Bed Skirt", "Presentation"],
  },
  "bedroom::pillows": {
    label: "Pillows / Bedding",
    inspect: ["Pillows", "Pillowcases", "Bedspread", "Arrangement"],
  },
  "bedroom::nightstands": {
    label: "Nightstands",
    inspect: ["Top Surfaces", "Drawers", "Sides", "Area Behind"],
  },
  "bedroom::lamps": {
    label: "Lamps",
    inspect: ["Bedside Lamps", "Desk Lamp", "Shades", "Bulbs / Switches", "Cords"],
  },
  "bedroom::tv-remote": {
    label: "Television",
    inspect: ["Screen", "Base / Stand", "Remote", "Picture", "Controls"],
  },
  "bedroom::furniture": {
    label: "Furniture",
    inspect: ["Dresser", "Chairs", "Desk", "Drawers"],
  },
  "bedroom::trash": {
    label: "Trash",
    inspect: ["Wastebaskets", "Liners", "Area Around Baskets"],
  },
  "bedroom::carpet": {
    label: "Carpet / Floor",
    inspect: ["Walking Areas", "Edges", "Under Furniture", "Corners"],
  },
  "bath::vanity": {
    label: "Vanity / Sink",
    inspect: ["Countertop", "Basin", "Faucet", "Drain", "Under-Sink Area"],
  },
  "bath::shower-tub": {
    label: "Shower / Tub",
    inspect: ["Walls", "Tub / Floor", "Fixtures", "Drain", "Grab Bars", "Soap Dish"],
  },
  "bath::shower-curtain": {
    label: "Shower Curtain / Doors",
    inspect: ["Curtain / Glass", "Liner", "Rod / Tracks", "Hooks", "Handle"],
  },
  "bath::toilet": {
    label: "Toilet",
    inspect: ["Bowl", "Seat", "Lid", "Tank", "Base", "Flush Handle", "Caulking", "Bolt Caps"],
  },
  "bath::towels": {
    label: "Towels",
    inspect: ["Quantity", "Types", "Folds", "Placement"],
  },
  "bath::amenities": {
    label: "Amenities",
    inspect: ["Soap", "Shampoo", "Conditioner", "Lotion", "Tissue", "Quantity", "Placement"],
  },
  "bath::mirror": {
    label: "Mirror",
    inspect: ["Surface", "Frame", "Edges"],
  },
  "bath::bath-floor": {
    label: "Bath Floor",
    inspect: ["Corners", "Baseboards", "Behind Door", "Around Toilet"],
  },
  "bath::caulking": {
    label: "Caulking / Grout",
    inspect: ["Shower / Tub Seams", "Sink Seams", "Tile Grout"],
  },
  "bath::exhaust-fan": {
    label: "Exhaust Fan",
    inspect: ["Cover / Vent", "Switch", "Airflow"],
  },
  "windows-drapes::windows": {
    label: "Windows",
    inspect: ["Glass", "Frames", "Locks", "Operation"],
  },
  "windows-drapes::drapes": {
    label: "Drapes / Sheers",
    inspect: ["Panels", "Hooks", "Rod", "Operation"],
  },
  "windows-drapes::window-sills": {
    label: "Window Sills",
    inspect: ["Sills", "Tracks", "Corners"],
  },
  "work-area::desk-chair": {
    label: "Desk / Chair",
    inspect: ["Desktop", "Drawers", "Chair Seat", "Chair Base", "Placement"],
  },
  "work-area::desk-lamp": {
    label: "Desk Lamp",
    inspect: ["Shade", "Base", "Bulb", "Switch", "Cord"],
  },
  "work-area::notepad": {
    label: "Notepad / Pen",
    inspect: ["Quantity", "Condition", "Placement"],
  },
  "work-area::wifi": {
    label: "Wi-Fi Information",
    inspect: ["Signage", "Access Details", "Placement"],
  },
  "amenities-supplies::coffee": {
    label: "Coffee / Tea Station",
    inspect: ["Coffee Maker", "Water Reservoir", "Brew Basket", "Cups", "Coffee / Tea", "Condiments"],
  },
  "amenities-supplies::ice-bucket": {
    label: "Ice Bucket / Glasses",
    inspect: ["Bucket", "Lid", "Liner", "Glasses", "Tray"],
  },
  "amenities-supplies::guest-directory": {
    label: "Guest Directory",
    inspect: ["Cover", "Pages", "Folio Holder", "Placement"],
  },
  "amenities-supplies::micro-fridge": {
    label: "Microwave / Refrigerator",
    inspect: [
      "Microwave Interior",
      "Microwave Exterior",
      "Turntable",
      "Controls",
      "Refrigerator Interior",
      "Refrigerator Exterior",
      "Shelves",
      "Door Seal",
      "Temperature",
    ],
  },
  "amenities-supplies::safe": {
    label: "Safe",
    inspect: ["Interior", "Door", "Keypad", "Instructions", "Reset Status"],
  },
  "overall-room::walls-ceiling": {
    label: "Walls / Ceiling",
    inspect: ["Wall Surfaces", "Ceiling", "Corners", "Areas Behind Furniture"],
  },
  "overall-room::baseboards": {
    label: "Baseboards",
    inspect: ["Room Perimeter", "Corners", "Areas Behind Furniture"],
  },
  "overall-room::artwork": {
    label: "Artwork / Mirrors",
    inspect: ["Frames", "Mounting", "Alignment", "Glass"],
  },
  "overall-room::hvac": {
    label: "HVAC",
    inspect: ["Thermostat", "Vent Grilles", "Airflow", "Clearance"],
  },
  "overall-room::lighting": {
    label: "Lighting",
    inspect: ["Ceiling", "Bedside", "Desk", "Closet", "Bathroom"],
  },
  "overall-room::phone": {
    label: "Phone",
    inspect: ["Handset", "Keypad", "Cord", "Message Light", "Dial Tone"],
  },
  "overall-room::smoke-detector": {
    label: "Smoke Detector",
    inspect: ["Housing", "Indicator", "Air Clearance"],
  },
  "housekeeping-cart::clean-organized-cart": {
    label: "Housekeeping Cart",
    inspect: ["Shelves / Bins", "Clean Linens", "Dirty Linens", "Trash", "Chemicals", "Tools"],
  },
  "evidence-from-past-guest::hair": {
    label: "Hair",
    inspect: ["Bedding", "Bathroom", "Floors", "Furniture"],
  },
  "evidence-from-past-guest::trash-debris-food": {
    label: "Trash / Debris / Food",
    inspect: ["Wastebaskets", "Drawers", "Refrigerator", "Under Bed", "Behind Furniture"],
  },
  "evidence-from-past-guest::clothes-lost-found": {
    label: "Clothes / Lost & Found Items",
    inspect: ["Closet", "Drawers", "Under Bed", "Behind Furniture", "Safe"],
  },
  "evidence-from-past-guest::bodily-fluids": {
    label: "Bodily Fluids",
    inspect: ["Bedding", "Bathroom", "Upholstery", "Floors"],
  },
  "evidence-from-past-guest::bedding-stains": {
    label: "Bedding Stains",
    inspect: ["Sheets", "Pillowcases", "Duvet / Bedspread", "Mattress Protector"],
  },
  "evidence-from-past-guest::pests": {
    label: "Pests / Signs of Pests",
    inspect: ["Mattress Seams", "Headboard", "Upholstery", "Baseboards", "Bathroom"],
  },
  "evidence-from-past-guest::other-evidence": {
    label: "Other Evidence from Past Guest",
    inspect: ["Drawers", "Nightstands", "Closet", "Safe", "Refrigerator"],
  },
};

export function getHousekeepingVacantReadyItemGuidance(
  categoryKey: string,
  itemKey: string
): ItemGuidance | null {
  return ITEM_GUIDANCE[`${categoryKey}::${itemKey}`] ?? null;
}

export function isHousekeepingVacantReadyTemplate(
  standardKey: string | null,
  templateName: string
): boolean {
  return (
    standardKey === HOUSEKEEPING_VACANT_READY_STANDARD_KEY ||
    templateName.trim().toLowerCase() === HOUSEKEEPING_VACANT_READY_TEMPLATE_NAME
  );
}
