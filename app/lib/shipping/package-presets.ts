export type PackagePresetKey =
  | "document_envelope"
  | "padded_envelope"
  | "small_box"
  | "medium_box"
  | "large_box"
  | "custom";

export type PackagePreset = {
  key: PackagePresetKey;
  label: string;
  lengthIn: number | null;
  widthIn: number | null;
  heightIn: number | null;
  /** Suggested default weight; staff should confirm. */
  weightOz: number | null;
};

export const PACKAGE_PRESETS: PackagePreset[] = [
  {
    key: "document_envelope",
    label: "Document Envelope",
    lengthIn: 12,
    widthIn: 10,
    heightIn: 0.5,
    weightOz: 3,
  },
  {
    key: "padded_envelope",
    label: "Padded Envelope",
    lengthIn: 14,
    widthIn: 11,
    heightIn: 1,
    weightOz: 8,
  },
  {
    key: "small_box",
    label: "Small Box",
    lengthIn: 8,
    widthIn: 6,
    heightIn: 4,
    weightOz: 16,
  },
  {
    key: "medium_box",
    label: "Medium Box",
    lengthIn: 12,
    widthIn: 10,
    heightIn: 8,
    weightOz: 48,
  },
  {
    key: "large_box",
    label: "Large Box",
    lengthIn: 18,
    widthIn: 14,
    heightIn: 12,
    weightOz: 80,
  },
  {
    key: "custom",
    label: "Custom Package",
    lengthIn: null,
    widthIn: null,
    heightIn: null,
    weightOz: null,
  },
];

export function getPackagePreset(key: string): PackagePreset {
  return (
    PACKAGE_PRESETS.find((preset) => preset.key === key) ??
    PACKAGE_PRESETS.find((preset) => preset.key === "custom")!
  );
}

export function isPackagePresetKey(value: string): value is PackagePresetKey {
  return PACKAGE_PRESETS.some((preset) => preset.key === value);
}
