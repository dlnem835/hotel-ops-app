import type {
  PmAppliesTo,
  PmAssignmentType,
  PmCategory,
  PmChecklist,
  PmFrequency,
} from "@/app/maintenance/lib/pm-types";

export type StandardPmTemplateDefinition = {
  key: string;
  name: string;
  description: string;
  category: PmCategory;
  frequency: PmFrequency;
  checklist: PmChecklist;
  estimatedMinutes?: number | null;
  assignedRole?: string | null;
  appliesTo?: PmAppliesTo;
  defaultAreaName?: string;
  defaultAreaNames?: readonly string[];
  defaultNamedLocations?: readonly string[];
  assignmentType?: PmAssignmentType;
  defaultUnits?: readonly string[];
  /** Named items with optional per-item location mapping for library seeding. */
  defaultItems?: readonly {
    name: string;
    areaName?: string;
  }[];
  legacyNames?: readonly string[];
};

function checklist(labels: readonly string[]): PmChecklist {
  return {
    categories: [
      {
        key: "checklist",
        name: "Checklist",
        sortOrder: 0,
        steps: labels.map((label, index) => ({
          key: `step-${index + 1}`,
          label,
          required: true,
          photoRequiredOnFail: false,
          sortOrder: index,
        })),
      },
    ],
  };
}

export const STANDARD_PM_TEMPLATES: readonly StandardPmTemplateDefinition[] = [
  {
    key: "one-eyrie-elevator-checklist-monthly-v1",
    name: "Elevator Checklist",
    description:
      "Monthly elevator preventive maintenance and safety checklist. Assign this template to each applicable elevator or elevator equipment area.",
    category: "Mechanical",
    frequency: "monthly",
    checklist: checklist([
      "Check the general condition of all elevators.",
      "Check and clean elevator pits and tracks.",
      "Test the fire recall system.",
      "Test the elevator safety phone.",
      "Check that elevator/pump rooms are clean.",
      "Test emergency lighting.",
      "Complete any required elevator safety inspections or checks applicable to the property.",
    ]),
  },
  {
    key: "one-eyrie-fire-extinguishers-monthly-v1",
    name: "Fire Extinguishers",
    description:
      "Monthly fire extinguisher inspection. Assign this template to all applicable property locations; long-term vendor testing is managed separately.",
    category: "Life Safety",
    frequency: "monthly",
    assignmentType: "area_location",
    defaultAreaNames: [
      "1st Floor Hallway",
      "2nd Floor Hallway",
      "3rd Floor Hallway",
      "4th Floor Hallway",
      "5th Floor Hallway",
      "Laundry",
      "Pool",
      "Employee Breakroom",
    ],
    checklist: checklist([
      "Inspect the general condition of each fire extinguisher.",
      "Confirm each extinguisher is present and properly positioned.",
      "Inspect cabinets and mounting brackets; clean as needed.",
      "Inspect extinguisher hoses for visible damage.",
      "Confirm inspection tags are present and the annual inspection date is valid.",
      "Confirm each extinguisher indicates proper charge.",
    ]),
  },
  {
    key: "one-eyrie-administrative-offices-quarterly-v1",
    name: "Administrative Offices",
    description: "Preventative Maintenance ",
    category: "Building",
    frequency: "quarterly",
    estimatedMinutes: 120,
    assignedRole: "Maintenance",
    appliesTo: "asset",
    defaultAreaName: "Back Office",
    checklist: {
      categories: [
        {
          key: "checklist",
          name: "Checklist",
          steps: [
            {
              key: "step-0",
              label:
                "Check the following and repair as needed: Walls, floors, ceilings, outlets, signage, hardware",
              required: true,
              sortOrder: 0,
              photoRequiredOnFail: false,
            },
          ],
          sortOrder: 0,
        },
      ],
    },
  },
  {
    key: "one-eyrie-boiler-water-heater-room-quarterly-v1",
    name: "Boiler/Water Heater Room",
    description: "PM Hot Water Heater Room",
    category: "Mechanical",
    frequency: "quarterly",
    estimatedMinutes: null,
    assignedRole: "Maintenance",
    appliesTo: "asset",
    defaultAreaName: "Hot Water Heater Room",
    checklist: {
      categories: [
        {
          key: "checklist",
          name: "Checklist",
          steps: [
            {
              key: "step-0",
              label: "Touch up the paint on the walls, floor, and ceiling",
              required: true,
              sortOrder: 0,
              photoRequiredOnFail: false,
            },
            {
              key: "step-1782349792159",
              label:
                "Ensure that all electrical panels and disconnects are properly labeled.",
              required: true,
              sortOrder: 1,
              photoRequiredOnFail: false,
            },
            {
              key: "step-1782349808839",
              label: "Organize and inventory tools and supplies.",
              required: true,
              sortOrder: 2,
              photoRequiredOnFail: false,
            },
          ],
          sortOrder: 0,
        },
      ],
    },
  },
  {
    key: "one-eyrie-boilers-water-heaters-quarterly-v1",
    name: "Boilers / Water Heaters",
    description: "PM Water Heaters #1, #2, #3, #4",
    category: "Mechanical",
    frequency: "quarterly",
    estimatedMinutes: null,
    assignedRole: "Maintenance",
    appliesTo: "asset",
    defaultAreaName: "Hot Water Heater Room",
    checklist: {
      categories: [
        {
          key: "checklist",
          name: "Checklist",
          steps: [
            {
              key: "step-0",
              label: "Ensure there are no leaks and record the temperature.",
              required: true,
              sortOrder: 0,
              photoRequiredOnFail: false,
            },
            {
              key: "step-1782350110433",
              label:
                "Drain water off the bottom valve unit until clear water is present.",
              required: true,
              sortOrder: 1,
              photoRequiredOnFail: false,
            },
            {
              key: "step-1782350117566",
              label:
                "Ensure that the pressure relief valve is sized properly and there are no leaks. Record the temperature.",
              required: true,
              sortOrder: 2,
              photoRequiredOnFail: false,
            },
            {
              key: "step-1782350165967",
              label:
                "Check the water temperature in a room (120° - 125° maximum).",
              required: true,
              sortOrder: 3,
              photoRequiredOnFail: false,
            },
            {
              key: "step-1782350172724",
              label:
                "Clean the burner assembly and check circulation pumps are working properly",
              required: true,
              sortOrder: 4,
              photoRequiredOnFail: false,
            },
          ],
          sortOrder: 0,
        },
      ],
    },
  },
  {
    key: "one-eyrie-employee-breakroom-quarterly-v1",
    name: "Employee Breakroom",
    description: "Preventative Maintenance ",
    category: "Building",
    frequency: "quarterly",
    estimatedMinutes: 120,
    assignedRole: "Maintenance",
    appliesTo: "asset",
    defaultAreaName: "Employee Breakroom",
    checklist: {
      categories: [
        {
          key: "checklist",
          name: "Checklist",
          steps: [
            {
              key: "step-0",
              label:
                "Check the following and repair as needed: Walls, floors, ceilings, outlets, signage, hardware",
              required: true,
              sortOrder: 0,
              photoRequiredOnFail: false,
            },
          ],
          sortOrder: 0,
        },
      ],
    },
  },
  {
    key: "one-eyrie-employee-restroom-quarterly-v1",
    name: "Employee Restroom",
    description: "Preventative Maintenance ",
    category: "Building",
    frequency: "quarterly",
    estimatedMinutes: 120,
    assignedRole: "Maintenance",
    appliesTo: "asset",
    defaultAreaName: "Employee Restroom",
    checklist: {
      categories: [
        {
          key: "checklist",
          name: "Checklist",
          steps: [
            {
              key: "step-0",
              label:
                "Check the following and repair as needed: Walls, floors, ceilings, hardware, toilet",
              required: true,
              sortOrder: 0,
              photoRequiredOnFail: false,
            },
            {
              key: "step-1782170296875",
              label: "Touch up door frames",
              required: true,
              sortOrder: 1,
              photoRequiredOnFail: false,
            },
            {
              key: "step-1782170317930",
              label: "Clean and inspect the exhaust fan.",
              required: true,
              sortOrder: 2,
              photoRequiredOnFail: false,
            },
          ],
          sortOrder: 0,
        },
      ],
    },
  },
  {
    key: "one-eyrie-building-exterior-triannually-v1",
    name: "Building Exterior",
    description:
      "Triannual building exterior inspection covering finishes, openings, and visible deterioration. Assign to the property exterior or primary building area.",
    category: "Building",
    frequency: "triannually",
    assignedRole: "Maintenance",
    appliesTo: "asset",
    defaultAreaName: "Building Exterior",
    checklist: checklist([
      "Inspect overall condition of the building exterior for visible damage or deterioration.",
      "Inspect windows and exterior doors for damaged or deteriorated seals.",
      "Inspect siding, stucco, trim, gutters, and exterior finishes for visible damage or needed repairs.",
      "Inspect exterior glass and surrounding caulking for deterioration, gaps, or damage.",
      "Inspect painted surfaces and trim for peeling, fading, rust, or damage.",
      "Complete minor routine repairs when appropriate.",
      "Document deficiencies and create a work order for repairs that cannot be completed during the PM.",
      "Contact a qualified contractor when repairs require specialized equipment, licensing, or work beyond normal hotel maintenance.",
    ]),
  },
  {
    key: "one-eyrie-chlorine-feeders-semiannually-v1",
    name: "Chlorine Feeders – Twice Per Year",
    description:
      "Semiannual chlorine feeder inspection and routine maintenance. Assign to the pool equipment room or applicable chemical feed area.",
    category: "Mechanical",
    frequency: "semiannually",
    assignedRole: "Maintenance",
    appliesTo: "asset",
    defaultAreaName: "Pool Equipment Room",
    checklist: checklist([
      "Inspect general condition of chlorine feeder(s).",
      "Inspect lid, seals, fittings, and connections for visible wear or damage.",
      "Inspect input and output hoses for leaks, cracks, deterioration, or loose connections.",
      "Clean accessible components as needed.",
      "Verify feeder appears to be operating normally.",
      "Document leaks, damage, or abnormal operation.",
      "Contact the pool service provider or qualified contractor for chemical-system repairs or service beyond routine maintenance.",
    ]),
  },
  {
    key: "one-eyrie-commercial-washing-machine-quarterly-v1",
    name: "Commercial Washing Machine",
    legacyNames: ["Commercial Washing Machines"],
    description:
      "Quarterly preventive maintenance for commercial washing machines. Each item keeps independent completion and maintenance history.",
    category: "Mechanical",
    frequency: "quarterly",
    assignedRole: "Maintenance",
    appliesTo: "asset",
    defaultAreaName: "Laundry",
    assignmentType: "equipment_unit",
    defaultUnits: [
      "Commercial Washing Machine #1",
      "Commercial Washing Machine #2",
    ],
    checklist: checklist([
      "Inspect and clean accessible filters, traps, and drains.",
      "Inspect water supply/drain hoses and chemical dispensers for leaks, wear, buildup, or blockage.",
      "Inspect door, latch, seals, and accessible wiring for damage or looseness.",
      "Lubricate manufacturer-designated bearings, fittings, and moving components as applicable.",
      "Clean accessible areas and check for leaks, unusual noise, or excessive vibration.",
      "Run machine and verify it fills, washes, drains, and operates properly.",
    ]),
  },
  {
    key: "one-eyrie-corridors-hallways-quarterly-v1",
    name: "Corridors (Hallways)",
    legacyNames: ["Corridors", "Hallways"],
    description:
      "Quarterly corridor and hallway condition inspection by floor.",
    category: "Building",
    frequency: "quarterly",
    assignedRole: "Maintenance",
    appliesTo: "public_area",
    assignmentType: "area_location",
    defaultNamedLocations: [
      "1st Floor Hallway",
      "2nd Floor Hallway",
      "3rd Floor Hallway",
    ],
    checklist: checklist([
      "Inspect walls for damage, stains, or needed paint/repairs.",
      "Inspect wall vinyl/wall coverings for damage or needed repair.",
      "Inspect door jambs/frames for damage or needed repair/paint.",
      "Inspect ceiling tiles and ceiling surfaces for stains, damage, or needed replacement.",
      "Inspect carpet/flooring for stains, damage, trip hazards, or needed repair.",
    ]),
  },
  {
    key: "one-eyrie-dining-breakfast-area-quarterly-v1",
    name: "Dining & Breakfast Area",
    legacyNames: [
      "Dining & Buffet Area – Quarterly",
      "Dining & Buffet Area - Quarterly",
    ],
    description:
      "Quarterly preventive maintenance for the dining and breakfast area.",
    category: "Building",
    frequency: "quarterly",
    assignedRole: "Maintenance",
    appliesTo: "public_area",
    defaultAreaName: "Dining & Breakfast Area",
    checklist: checklist([
      "Inspect overall condition of dining and breakfast area, including walls, ceilings, flooring, cabinetry and finishes. Repair or create work order as needed.",
      "Test accessible electrical outlets for proper operation.",
      "Inspect breakfast-area tables and chairs for damage, loose components, nicks, or scratches.",
      "Verify proper lighting and replace failed lamps as needed.",
      "Test GFCI outlets for proper operation.",
    ]),
  },
  {
    key: "one-eyrie-dishwasher-sanitizer-quarterly-v1",
    name: "Dishwasher / Sanitizer",
    legacyNames: [
      "Dishwasher/Sanitizer",
      "Dishwasher / Sanitizer – Quarterly",
    ],
    description:
      "Quarterly inspection, cleaning, and operational service for commercial dishwashing and sanitizing equipment.",
    category: "Mechanical",
    frequency: "quarterly",
    assignedRole: "Maintenance",
    appliesTo: "asset",
    defaultAreaName: "Kitchen",
    checklist: checklist([
      "Inspect the unit, doors, racks, curtains, and accessible components for damage or abnormal wear.",
      "Inspect for water, chemical, or steam leaks and repair or create a work order as needed.",
      "Inspect accessible electrical wiring and connections for visible damage, overheating, or looseness. Contact a qualified contractor when repair is required.",
      "Verify wash and rinse temperatures meet the equipment manufacturer and applicable sanitation requirements.",
      "Clean accessible screens, strainers, spray arms, nozzles, and interior surfaces as needed.",
      "Drain and flush the unit according to manufacturer instructions.",
      "Delime the unit according to manufacturer instructions using the property’s approved deliming product.",
      "Run an operational cycle and verify proper filling, washing, rinsing, draining, and shutdown.",
    ]),
  },
  {
    key: "one-eyrie-commercial-dryer-triannually-v2",
    name: "Commercial Dryer",
    description:
      "Triannual preventive maintenance for commercial dryers. Each unit keeps independent completion and maintenance history.",
    category: "Mechanical",
    frequency: "triannually",
    assignedRole: "Maintenance",
    appliesTo: "asset",
    defaultAreaName: "Laundry",
    assignmentType: "equipment_unit",
    defaultUnits: ["Commercial Dryer #1", "Commercial Dryer #2"],
    checklist: checklist([
      "Run dryer and listen for excessive noise or vibration.",
      "Clean lint screen, lint compartment, and accessible lint buildup.",
      "Inspect lint screen for tears or damage.",
      "Inspect drive belts for looseness, wear, cracks, or fraying.",
      "Inspect door, hinges, latch, and door gasket for wear or damage.",
      "Inspect and clean accessible burner area and burner air openings.",
      "Inspect accessible exhaust/vent connection for lint buildup or restriction.",
      "Check accessible fasteners and hardware for looseness; tighten as needed.",
      "Lubricate applicable bearings, pivot points, and moving components as needed.",
      "Verify dryer tumbles, heats, and shuts off properly.",
      "Inspect for visible damage or abnormal operation.",
      "Contact a qualified contractor for gas-system repairs, burner/orifice service, electrical repairs, or specialized repairs as needed.",
    ]),
  },
  {
    key: "one-eyrie-dumpster-area-quarterly-v1",
    name: "Dumpster Area",
    description:
      "Quarterly dumpster area inspection covering cleanliness, enclosure condition, and odor control.",
    category: "Building",
    frequency: "quarterly",
    assignedRole: "Maintenance",
    appliesTo: "asset",
    defaultAreaName: "Dumpster Area",
    checklist: checklist([
      "Check for stains, odor and garbage.",
      "Ensure that the closure works properly and can be closed completely.",
      "Ensure the trash enclosure is in good condition.",
      "Pressure wash dumpster area as needed.",
    ]),
  },
  {
    key: "one-eyrie-electrical-rooms-quarterly-v1",
    name: "Electrical Rooms",
    description:
      "Quarterly electrical room inspection covering room condition, exhaust, combustibles, and panel fillers.",
    category: "Mechanical",
    frequency: "quarterly",
    assignedRole: "Maintenance",
    appliesTo: "asset",
    defaultAreaName: "Electrical Room",
    checklist: checklist([
      "Check and repair as needed: Walls, floors, ceilings, outlets, signage, hardware.",
      "Touch up the door frames.",
      "Test all exhaust vents.",
      "Clean the entire room.",
      "Ensure no combustibles present in room.",
      "Ensure no missing breaker slots in the electrical panel. Place breaker filler as needed.",
    ]),
  },
  {
    key: "one-eyrie-emergency-lights-quarterly-v1",
    name: "Emergency Lights",
    description:
      "Quarterly emergency lighting inspection covering lamp operation, test buttons, and battery condition.",
    category: "Life Safety",
    frequency: "quarterly",
    assignedRole: "Maintenance",
    appliesTo: "asset",
    defaultAreaName: "Emergency Lights",
    checklist: checklist([
      "Inspect all lights, and replace any that are burned out. All floors.",
      "Ensure that all emergency lights work by pressing the red “Test” button.",
      "Check the battery charge. Replace any defective or dead batteries as soon as possible.",
    ]),
  },
  {
    key: "one-eyrie-engineering-shop-quarterly-v1",
    name: "Engineering Shop",
    description:
      "Quarterly engineering shop inspection covering room finishes, organization, and cleanliness.",
    category: "Building",
    frequency: "quarterly",
    assignedRole: "Maintenance",
    appliesTo: "asset",
    defaultAreaName: "Engineering Shop",
    checklist: checklist([
      "Check the following and repair as needed: Walls, floors, ceilings, outlets, signage, hardware.",
      "Touch up door frames.",
      "Purge any unneeded files.",
      "Paint or touch up floor.",
      "Vacuum, dust, and clean the area.",
    ]),
  },
  {
    key: "one-eyrie-entry-foyer-quarterly-v1",
    name: "Entry Foyer",
    legacyNames: ["Entrance Foyer"],
    description:
      "Quarterly entry foyer inspection covering finishes, doors, locks, intercom, and luggage carts.",
    category: "Building",
    frequency: "quarterly",
    assignedRole: "Maintenance",
    appliesTo: "public_area",
    defaultAreaName: "Entry Foyer",
    checklist: checklist([
      "Check the overall condition of your entry foyer(s), and be sure to check the following and repair as needed: Walls, floors, ceiling, signage, hardware, and doors.",
      "Touch up doors and door frames.",
      "Test all electrical connections and repair as needed.",
      "Test locks.",
      "Test intercom.",
      "Check overall condition of luggage carts and repair as needed.",
    ]),
  },
  {
    key: "one-eyrie-outdoor-furniture-quarterly-v1",
    name: "Outdoor Furniture",
    description:
      "Quarterly outdoor furniture inspection for pool and fire pit seating areas.",
    category: "Building",
    frequency: "quarterly",
    assignedRole: "Maintenance",
    appliesTo: "asset",
    defaultItems: [
      { name: "Pool Furniture", areaName: "Pool" },
      { name: "Fire Pit Furniture", areaName: "Fire Pit" },
    ],
    checklist: checklist([
      "Inspect furniture for damage, cracks, loose parts, or excessive wear.",
      "Tighten loose hardware and fasteners as needed.",
      "Inspect tables and chairs for stability; repair as needed.",
      "Clean furniture and remove stains, dirt, mildew, and debris.",
      "Inspect finishes for fading, peeling, rust, or corrosion; touch up as needed.",
      "Confirm furniture is properly positioned and the area is neat and orderly.",
    ]),
  },
  {
    key: "one-eyrie-fire-system-flow-quarterly-v1",
    name: "Fire System Flow",
    description:
      "Quarterly fire system flow and contracted inspection tracking checklist.",
    category: "Life Safety",
    frequency: "quarterly",
    assignedRole: "Maintenance",
    appliesTo: "asset",
    checklist: checklist([
      "Contract out - Annual Alarm Panel Inspection",
      "Contract out - Annual testing and Maintenance of Standpipe and Hose Systems",
      "Contract out - Quarterly Testing and Maintenance of Wet Pipe Sprinkler System",
      "Contract out - Annual Fire Hydrant Flow Test",
      "Contract Out - Annual, all Backflows, Prevention Assembly Test",
      "Contract out - Annual Testing and Maintenance of Wet Pipe Sprinkler System",
    ]),
  },
  {
    key: "one-eyrie-fitness-center-quarterly-v1",
    name: "Fitness Center",
    description:
      "Quarterly fitness center finishes and equipment preventive maintenance.",
    category: "Building",
    frequency: "quarterly",
    assignedRole: "Maintenance",
    appliesTo: "public_area",
    defaultAreaName: "Fitness Center",
    checklist: checklist([
      "Clean wall vinyl.",
      "Repair damaged wall vinyl as needed.",
      "Check ceiling, and repair or replace as needed.",
      "Check carpet/floor, and repair or clean as needed.",
      "Touch up paint on door jambs.",
      "Tighten all equipment hardware.",
      "Ensure that all equipment works correctly. Repair or replace parts and/or lubricate as needed.",
    ]),
  },
  {
    key: "one-eyrie-front-desk-public-space-vtec-unit-quarterly-v1",
    name: "Front Desk - Public Space VTEC Unit",
    description:
      "Quarterly preventive maintenance for the front desk / public space VTEC unit.",
    category: "Mechanical",
    frequency: "quarterly",
    assignedRole: "Maintenance",
    appliesTo: "asset",
    defaultItems: [
      {
        name: "Front Desk - Public Space VTEC Unit",
        areaName: "Front Desk / Public Space",
      },
    ],
    checklist: checklist([
      "Check/Clean evaporator coils and condenser coils as needed (contract out if needed).",
      "Clean and change air filter.",
      "Clean and Vacuum drain line.",
      "Ensure unit is not making any alarming or loud noises.",
      "Using temperature gun ensure the unit is producing air between 55 to 64 degrees.",
    ]),
  },
  {
    key: "one-eyrie-guest-dryer-quarterly-v1",
    name: "Guest Dryer",
    description:
      "Quarterly guest dryer preventive maintenance for guest laundry.",
    category: "Mechanical",
    frequency: "quarterly",
    assignedRole: "Maintenance",
    appliesTo: "asset",
    defaultItems: [
      { name: "Guest Dryer #1", areaName: "Guest Laundry" },
    ],
    checklist: checklist([
      "Clean under each unit.",
      "Twice per year, pull out all units and clean behind them.",
      "Twice per year, remove the back(s) of dryer(s), and clean or vacuum all lint & dust.",
      "Clean each unit thoroughly.",
      "Run each unit through a complete cycle.",
    ]),
  },
  {
    key: "one-eyrie-guest-washer-quarterly-v1",
    name: "Guest Washer",
    description:
      "Quarterly guest washer preventive maintenance for guest laundry.",
    category: "Mechanical",
    frequency: "quarterly",
    assignedRole: "Maintenance",
    appliesTo: "asset",
    defaultItems: [
      { name: "Guest Washer #1", areaName: "Guest Laundry" },
    ],
    checklist: checklist([
      "Run each unit through a complete cycle.",
      "Clean under each unit.",
      "Check all hoses & gaskets for leaks. Replace as needed.",
      "Clean each unit thoroughly.",
      "Lubricate all bearings.",
      "Twice per year, pull out all units and clean behind them.",
      "Once per year, change all hoses as needed.",
    ]),
  },
  {
    key: "one-eyrie-housekeeping-carts-quarterly-v1",
    name: "Housekeeping Carts",
    description:
      "Quarterly housekeeping cart inspection covering wheels, hardware, and finish.",
    category: "Equipment",
    frequency: "quarterly",
    assignedRole: "Maintenance",
    appliesTo: "asset",
    defaultItems: [
      { name: "Housekeeping Carts", areaName: "Housekeeping" },
    ],
    checklist: checklist([
      "Check the wheels on all carts, and repair or replace as needed.",
      "Tighten all nuts, bolts, and related supports.",
      "If needed, paint or touch up all carts.",
    ]),
  },
  {
    key: "one-eyrie-ice-machines-quarterly-v1",
    name: "Ice Machines",
    description:
      "Quarterly ice machine inspection and basic mechanical service checklist.",
    category: "Mechanical",
    frequency: "quarterly",
    assignedRole: "Maintenance",
    appliesTo: "asset",
    defaultItems: [
      { name: "Ice Machine #1", areaName: "Ice Machine #1" },
    ],
    checklist: checklist([
      "Check the overall condition of all ice machines.",
      "Ensure that discharge lines are aligned with the floor drains.",
      "Ensure coil fins are straight.",
      "Ensure the shroud is in its proper position.",
      "Level each unit, front to rear and side to side.",
      "Ensure all electrical connections are tight.",
      "Repair or replace any parts as needed.",
    ]),
  },
  {
    key: "one-eyrie-juice-machine-quarterly-v1",
    name: "Juice Machine",
    description:
      "Quarterly juice machine electrical inspection and service checklist.",
    category: "Mechanical",
    frequency: "quarterly",
    assignedRole: "Maintenance",
    appliesTo: "asset",
    defaultItems: [{ name: "Juice Machine", areaName: "Juice Machine" }],
    checklist: checklist([
      "Clean all electrical connections.",
      "Inspect electrical cord & plug.",
      "Any issues or repairs needed please call 800-237-7805.",
    ]),
  },
  {
    key: "one-eyrie-laundry-room-quarterly-v1",
    name: "Laundry Room",
    description:
      "Quarterly laundry room finishes, lighting, and linen chute inspection.",
    category: "Building",
    frequency: "quarterly",
    assignedRole: "Maintenance",
    appliesTo: "asset",
    defaultItems: [{ name: "Laundry Room", areaName: "Laundry Room" }],
    checklist: checklist([
      "Check and repair walls, floors, ceilings, electrical connection, signage, and hardware.",
      "Touch up door frames as needed.",
      "Clean lights and pipes.",
      "Check the overall condition of the linen chute. Door closes properly. Chute is clear of obstructions. Chute is clean.",
    ]),
  },
  {
    key: "one-eyrie-lighting-signage-quarterly-v1",
    name: "Lighting & Signage",
    description:
      "Quarterly exterior lighting and signage inspection covering operation, focus, and cleanliness.",
    category: "Exterior",
    frequency: "quarterly",
    assignedRole: "Maintenance",
    appliesTo: "asset",
    defaultItems: [
      {
        name: "Lighting & Signage",
        areaName: "Exterior / Property Grounds",
      },
    ],
    checklist: checklist([
      "Ensure that all lights are working and focused.",
      "Check and correct any lighting obstructions (for example, tree branches and bushes).",
      "Clean inside and outside of wall mounted lights as needed.",
    ]),
  },
  {
    key: "one-eyrie-linen-and-storage-rooms-quarterly-v1",
    name: "Linen and Storage Rooms",
    description:
      "Quarterly linen and storage room inspection covering finishes, organization, and cleanliness.",
    category: "Building",
    frequency: "quarterly",
    assignedRole: "Maintenance",
    appliesTo: "asset",
    defaultItems: [
      {
        name: "Linen and Storage Rooms",
        areaName: "Linen and Storage Rooms",
      },
    ],
    checklist: checklist([
      "Be sure to check the following and repair as needed: Walls, floors, ceilings, electrical connections, signage, hardware.",
      "Clean floors, light fixtures, electrical switches and plates, hand floor and mop sinks, fixtures and plumbing.",
      "Touch up door frames as needed.",
      "Organize shelves and replacement supplies.",
      "Ensure all linen and storage rooms were inspected.",
    ]),
  },
  {
    key: "one-eyrie-lobby-front-desk-quarterly-v1",
    name: "Lobby & Front Desk",
    description:
      "Quarterly lobby, front desk, and market area public-space inspection.",
    category: "Building",
    frequency: "quarterly",
    assignedRole: "Maintenance",
    appliesTo: "public_area",
    defaultItems: [
      { name: "Lobby & Front Desk", areaName: "Lobby / Front Desk" },
    ],
    checklist: checklist([
      "Check the overall condition of your lobby and front desk; be sure to check each of the following, and touch up, repair, or replace as needed: Walls, floors, ceilings, signage, front desk, and furniture.",
      "Check the overall condition of Market Area; be sure to touch up, repair, or replace equipment and cabinetry as needed.",
      "Test all electrical outlets.",
      "Ensure all common space TVs are working properly.",
    ]),
  },
  {
    key: "one-eyrie-refrigerators-quarterly-v1",
    name: "Refrigerators",
    description:
      "Quarterly refrigerator and cooler inspection. Add additional refrigerator items as needed; each item keeps independent history.",
    category: "Mechanical",
    frequency: "quarterly",
    assignedRole: "Maintenance",
    appliesTo: "asset",
    defaultItems: [{ name: "Market Cooler", areaName: "Market" }],
    checklist: checklist([
      "Inspect the electrical supply, and ensure all electrical connections are tight.",
      "Alert the General Manager if any units have been improperly cleaned.",
      "Check condensate pan.",
      "Check door gaskets.",
      "Check proper airflow.",
      "Check temperature.",
      "Clean all condenser coils.",
      "Clean all evaporator coils.",
      "Clean the outside of all units.",
    ]),
  },
  {
    key: "one-eyrie-meeting-room-quarterly-v1",
    name: "Meeting Room",
    description:
      "Quarterly meeting room AV, locks, phones, and HVAC inspection.",
    category: "Building",
    frequency: "quarterly",
    assignedRole: "Maintenance",
    appliesTo: "public_area",
    defaultItems: [{ name: "Meeting Room", areaName: "Meeting Room" }],
    checklist: checklist([
      "Check the overall condition of your meeting rooms, and be sure to check the following and repair or replace as needed: Lights, screens, and projector.",
      "Test all locks.",
      "Test all phones and jacks.",
      "Ensure that enough extension cords are available.",
      "Test HVAC.",
    ]),
  },
  {
    key: "one-eyrie-phone-tv-computer-room-quarterly-v1",
    name: "Phone/TV/Computer Room",
    description:
      "Quarterly phone/TV/computer room finishes, temperature, and cleanliness inspection.",
    category: "Building",
    frequency: "quarterly",
    assignedRole: "Maintenance",
    appliesTo: "asset",
    defaultItems: [
      {
        name: "Phone/TV/Computer Room",
        areaName: "Phone/TV/Computer Room",
      },
    ],
    checklist: checklist([
      "Check and repair walls, ceiling, floors, outlets, signage, hardware.",
      "Room temperature. Must be maintained at 75° or less.",
      "Touch up the door frames.",
      "Clean the entire room.",
    ]),
  },
  {
    key: "one-eyrie-pool-quarterly-v1",
    name: "Pool",
    legacyNames: ["Pool - Weekly", "Pool – Weekly"],
    description:
      "Quarterly pool water quality, equipment, and safety equipment inspection.",
    category: "Pool",
    frequency: "quarterly",
    assignedRole: "Maintenance",
    appliesTo: "asset",
    defaultItems: [{ name: "Pool", areaName: "Pool" }],
    checklist: checklist([
      "Check the water level.",
      "Check the water temperature. Recommended temperatures are 85° for the pool.",
      "Check water clarity. Drain and refill only if necessary.",
      "Check all pool chemical levels. Record appropriately in the Pool Operator’s Log. Ensure this is being completed daily.",
      "Check the condition of all ladders, cove molding, and rescue equipment.",
      "Vacuum and brush all tiled surfaces and pool floor as needed.",
      "Make sure all proper signage is posted.",
    ]),
  },
  {
    key: "one-eyrie-pool-circulation-pumps-quarterly-v1",
    name: "Pool Circulation Pumps",
    description:
      "Quarterly pool circulation pump inspection covering mounts, baskets, leaks, and wiring.",
    category: "Pool",
    frequency: "quarterly",
    assignedRole: "Maintenance",
    appliesTo: "asset",
    defaultItems: [
      {
        name: "Pool Circulation Pump",
        areaName: "Pool Equipment Room",
      },
    ],
    checklist: checklist([
      "Inspect motor floor mounts, motor pump mounts, proper grounding, and proper flow of water (150).",
      "Clean baskets (purge air after).",
      "Clean outside the motor to avoid oxidation.",
      "Check casing for leaks.",
      "Fix all leaks.",
      "Secure the wiring assembly.",
    ]),
  },
  {
    key: "one-eyrie-pool-filter-quarterly-v1",
    name: "Pool Filter",
    description:
      "Quarterly pool filter inspection covering condition, backwash, leaks, and pressure.",
    category: "Pool",
    frequency: "quarterly",
    assignedRole: "Maintenance",
    appliesTo: "asset",
    defaultItems: [
      { name: "Pool Filter", areaName: "Pool Equipment Room" },
    ],
    checklist: checklist([
      "Inspect the general condition of all filters.",
      "Check emergency shutoffs.",
      "Backwash as needed.",
      "Check for any leaks, and repair if needed.",
      "Clean entire unit.",
      "Ensure that pressure is within recommended limits (over 100).",
      "Every 3 months clean inside all filters. Replace filter if needed.",
    ]),
  },
  {
    key: "one-eyrie-pool-heater-quarterly-v1",
    name: "Pool Heater",
    description:
      "Quarterly pool heater inspection covering shutoffs, ignition, pipes, fans, and burners.",
    category: "Pool",
    frequency: "quarterly",
    assignedRole: "Maintenance",
    appliesTo: "asset",
    defaultItems: [
      { name: "Pool Heater", areaName: "Pool Equipment Room" },
    ],
    checklist: checklist([
      "Inspect the general condition of emergency shutoffs.",
      "Inspect the general condition of outgoing temperature.",
      "Inspect ignition device.",
      "Inspect pipes.",
      "Check water temperature in pool.",
      "Inspect room intake fan(s) and exhaust fan(s).",
      "Clean burners.",
    ]),
  },
  {
    key: "one-eyrie-public-restrooms-quarterly-v1",
    name: "Public Restrooms",
    description:
      "Quarterly public restroom finishes, plumbing, and fixture inspection.",
    category: "Building",
    frequency: "quarterly",
    assignedRole: "Maintenance",
    appliesTo: "public_area",
    defaultItems: [
      { name: "Public Restrooms", areaName: "Public Restrooms" },
    ],
    checklist: checklist([
      "Check the overall condition of your public restrooms and repair as needed: Walls, floors, ceilings, signage, and hardware.",
      "Test all electrical outlets and repair as needed.",
      "Touch up all door frames.",
      "Test all plumbing.",
      "Clean exhaust fan.",
      "Replace any tarnished or worn fixtures.",
      "Check any vending machines and have them refilled as needed.",
    ]),
  },
  {
    key: "one-eyrie-relay-quarterly-v1",
    name: "Relay",
    description:
      "Quarterly relay and beacon device battery and alarm function inspection.",
    category: "Life Safety",
    frequency: "quarterly",
    assignedRole: "Maintenance",
    appliesTo: "asset",
    defaultItems: [
      { name: "Relay / Beacon Devices", areaName: "Building" },
    ],
    checklist: checklist([
      "Change beacon batteries located throughout the building.",
      "Ensure all devices are working properly. Test alarm feature for all devices.",
    ]),
  },
  {
    key: "one-eyrie-roof-maintenance-quarterly-v1",
    name: "Roof Maintenance",
    description:
      "Quarterly roof inspection covering drains, seams, flashing, and ventilation.",
    category: "Building",
    frequency: "quarterly",
    assignedRole: "Maintenance",
    appliesTo: "asset",
    defaultItems: [{ name: "Roof", areaName: "Roof" }],
    checklist: checklist([
      "Clean around drains and make sure pitch pockets are not full.",
      "Check seam terminations.",
      "Ensure that parapets and equipment curbs are in good condition.",
      "Make sure walk pads are in place.",
      "Check the roof for excessive wear.",
      "Ensure that all flashing is tight.",
      "Ensure there is adequate ventilation.",
    ]),
  },
  {
    key: "one-eyrie-rooftop-exhausts-quarterly-v1",
    name: "Rooftop Exhausts",
    description:
      "Quarterly rooftop exhaust inspection. Add additional exhaust items as needed; each item keeps independent history.",
    category: "Mechanical",
    frequency: "quarterly",
    assignedRole: "Maintenance",
    appliesTo: "asset",
    defaultItems: [{ name: "Rooftop Exhaust", areaName: "Roof" }],
    checklist: checklist([
      "Inspect the general condition and operation of rooftop exhausts.",
      "Check and tighten electrical connections.",
      "Ensure that the wheel and blade are clean.",
      "Check alignment of belts and pulley.",
      "Check all dampers.",
      "Inspect control wiring.",
      "Check fan-blade guard.",
    ]),
  },
  {
    key: "one-eyrie-rooftop-units-quarterly-v1",
    name: "Rooftop Units",
    description:
      "Quarterly rooftop unit (RTU) preventive maintenance. Checklist steps to be added later. Each RTU item keeps independent history.",
    category: "Mechanical",
    frequency: "quarterly",
    assignedRole: "Maintenance",
    appliesTo: "asset",
    defaultItems: [
      { name: "RTU 1", areaName: "Roof" },
      { name: "RTU 2", areaName: "Roof" },
      { name: "RTU 3", areaName: "Roof" },
    ],
    checklist: checklist([]),
  },
  {
    key: "one-eyrie-water-softener-quarterly-v1",
    name: "Water Softener",
    description:
      "Quarterly water softener inspection covering hardness, salt/brine levels, leaks, and valves.",
    category: "Mechanical",
    frequency: "quarterly",
    assignedRole: "Maintenance",
    appliesTo: "asset",
    defaultItems: [
      {
        name: "Water Softener",
        areaName: "Hot Water Heater Room",
      },
    ],
    checklist: checklist([
      "Check alignment of the drain line over the floor drain.",
      "Inspect/test water hardness.",
      "Inspect salt and water levels in the tank according to manufacturer's recommendations.",
      "Ensure brine tank automatic fill is operating properly.",
      "Inspect piping, fittings, and valves for leaks.",
      "Lubricate all valves.",
      "Clean the surrounding area.",
    ]),
  },
  {
    key: "one-eyrie-stairwells-quarterly-v1",
    name: "Stairwells",
    description:
      "Quarterly stairwell finishes, lighting, and handrail inspection.",
    category: "Building",
    frequency: "quarterly",
    assignedRole: "Maintenance",
    appliesTo: "public_area",
    defaultItems: [{ name: "Stairwell", areaName: "Stairwells" }],
    checklist: checklist([
      "Check all of the following, and clean, repair, re-paint, or replace as needed: walls, vinyl, door jambs, ceiling, carpets, cove base, outlets, signage, lights, and hand railing.",
    ]),
  },
  {
    key: "one-eyrie-vacuums-quarterly-v1",
    name: "Vacuums",
    description:
      "Quarterly vacuum cleaner inspection and service. Add additional vacuum items as needed; each item keeps independent history.",
    category: "Equipment",
    frequency: "quarterly",
    assignedRole: "Maintenance",
    appliesTo: "asset",
    defaultItems: [{ name: "Vacuum", areaName: "Housekeeping" }],
    checklist: checklist([
      "Check each machine's hose and attachments.",
      "Check each vacuum's switches, as well as the power cord. Replace any cords that are frayed or damaged.",
      "Each vacuum should be completely disassembled. Then, clean each individual part.",
      "Check the condition of each machine's motor, as well as the roller assembly.",
      "Check all parts, and repair or replace as necessary.",
      "Clean debris from beater bar or brush.",
      "Change brushes and belts as needed.",
    ]),
  },
] as const;
