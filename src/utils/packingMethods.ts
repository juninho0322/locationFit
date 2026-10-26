import type { PackingMode } from "../types/packing";

export const packingMethods: Record<PackingMode, { label: string; description: string }> = {
  auto: {
    label: "Automatic - best fit",
    description: "Compare grouped boxes, columns and flexible stacking to find the fewest pallets or cages. SKUs may share a load.",
  },
  "box-size": {
    label: "Group similar box sizes",
    description: "Start with boxes of the same size, then fill remaining space with smaller boxes. SKUs may share a load.",
  },
  "column-stack": {
    label: "Column stacking",
    description: "Build vertical columns with matching box footprints. SKUs may share a load.",
  },
  "free-placement": {
    label: "Flexible stacking",
    description: "Rotate and combine boxes to fill available space. SKUs may share a load.",
  },
  "sku-separated": {
    label: "Keep SKUs separate",
    description: "One SKU per pallet or cage. Keep each SKU together on its own loads; this may need more locations.",
  },
};

export function resolvePackingMode(value: unknown): PackingMode {
  return typeof value === "string" && Object.prototype.hasOwnProperty.call(packingMethods, value)
    ? value as PackingMode : "auto";
}
