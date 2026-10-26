export type PalletFormat = "uk" | "euro" | "custom";

export type LocationKind = "pick-face" | "pallet" | "cage";

export interface Location {
  palletFormat?: PalletFormat;
  kind?: LocationKind;
  id: string;
  name: string;
  type?: string;
  countAs?: "location" | "pallet" | "cage";
  width: number;
  depth: number;
  height: number;
}

export interface Sku {
  id: string;
  code: string;
  description: string;
  unitsPerCase: number;
  width: number;
  depth: number;
  height: number;
}

export interface OrderLine {
  description?: string;
  id: string;
  skuId: string;
  quantity: number;
  mode: "cases" | "units";
}

export interface Order {
  createdAt?: string;
  updatedAt?: string;
  savedPlan?: {
    signature: string;
    calculatedAt: string;
    result: import("./packing").PalletEstimateResult;
  };
  packingMode?: import("./packing").PackingMode;
  id: string;
  name: string;
  locationId: string;
  lines: OrderLine[];
}

export interface BoxDimensions {
  width: number;
  depth: number;
  height: number;
  quantity: number;
}

export type DimensionKey = "width" | "depth" | "height";

export interface Orientation {
  id: string;
  width: number;
  depth: number;
  height: number;
  widthSource: DimensionKey;
  depthSource: DimensionKey;
  heightSource: DimensionKey;
}

export interface BoxPosition {
  id: string;
  x: number;
  y: number;
  z: number;
  width: number;
  depth: number;
  height: number;
}

export interface FitResult {
  fits: boolean;
  message: string;
  orientation: Orientation | null;
  boxesAcrossWidth: number;
  boxesAcrossDepth: number;
  boxesAcrossHeight: number;
  totalCapacity: number;
  requestedQuantity: number;
  boxesThatFit: number;
  leftoverBoxes: number;
  totalUnits: number;
  locationVolume: number;
  usedVolume: number;
  volumeUtilization: number;
  usedWidth: number;
  usedDepth: number;
  usedHeight: number;
  positions: BoxPosition[];
}
