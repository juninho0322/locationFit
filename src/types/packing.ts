import type { LocationKind } from "./index";

export interface PalletType {
  displayLabel?: string;
  locationKind?: LocationKind;
  id: string;
  name: string;
  width: number;
  depth: number;
  height: number;
}

export type VolumeUnit = "cm3" | "m3" | "litres";
export type DimensionUnit = "auto" | "cm" | "m" | "mm";
export type PackingMode =
  | "auto"
  | "box-size"
  | "column-stack"
  | "free-placement"
  | "sku-separated";

export interface EstimateSku {
  sku: string;
  orderQuantity: number;
  packSku: string;
  ratio: number;
  width: number;
  depth: number;
  height: number;
  boxVolume: number;
  exactBoxes: number;
  fullBoxes: number;
  partialBoxes: number;
  boxesRequired: number;
  totalVolume: number;
  hasPartialBox: boolean;
}

export interface MissingPackConfig {
  sku: string;
  orderQuantity: number;
}

export interface InvalidPackConfig {
  sku: string;
  packSku: string;
  reason: string;
}

export interface PackedPalletLine {
  sku: string;
  boxVolume: number;
  boxes: number;
  depth: number;
  height: number;
  partialBoxes: number;
  volume: number;
  width: number;
}

export interface PackedBox {
  id: string;
  sku: string;
  x: number;
  y: number;
  z: number;
  width: number;
  depth: number;
  height: number;
  volume: number;
  isPartial: boolean;
}

export interface PackedPallet {
  id: string;
  index: number;
  usedVolume: number;
  remainingVolume: number;
  boxes: PackedBox[];
  lines: PackedPalletLine[];
}

export interface PalletEstimateResult {
  packingMethod: Exclude<PackingMode, "auto">;
  palletType: PalletType;
  palletVolume: number;
  totalOrderQuantity: number;
  totalBoxes: number;
  totalVolume: number;
  utilization: number;
  skus: EstimateSku[];
  pallets: PackedPallet[];
  missingPackConfigs: MissingPackConfig[];
  invalidPackConfigs: InvalidPackConfig[];
  oversizedSkus: EstimateSku[];
  partialBoxSkus: EstimateSku[];
}
