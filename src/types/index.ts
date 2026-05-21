export interface Location {
  id: string;
  name: string;
  width: number;
  depth: number;
  height: number;
}

export interface BoxDimensions {
  width: number;
  depth: number;
  height: number;
  quantity: number;
}

export type DimensionKey = 'width' | 'depth' | 'height';

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

export interface OrientationSummary {
  shelfWidth: DimensionKey;
  shelfDepth: DimensionKey;
  shelfHeight: DimensionKey;
}
