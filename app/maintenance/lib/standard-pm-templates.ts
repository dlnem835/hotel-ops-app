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
  assignmentType?: PmAssignmentType;
  defaultUnits?: readonly string[];
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
] as const;
