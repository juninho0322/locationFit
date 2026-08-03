import type { Location } from '../types';
import type { SheetData } from './sheetData';

export interface PalletType {
  id: string;
  name: string;
  width: number;
  depth: number;
  height: number;
}

export type VolumeUnit = 'cm3' | 'm3' | 'litres';
export type DimensionUnit = 'auto' | 'cm' | 'm' | 'mm';
export type PackingMode = 'box-size' | 'column-stack' | 'free-placement';

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

const orderSkuColumn = 0;
const orderQuantityColumn = 2;
const packSkuColumn = 0;
const packWidthColumn = 1;
const packHeightColumn = 2;
const packDepthColumn = 3;
const packVolumeColumn = 4;
const packRatioColumn = 5;

const volumeMultipliers: Record<VolumeUnit, number> = {
  cm3: 1,
  litres: 1000,
  m3: 1_000_000,
};

const dimensionMultipliers: Record<Exclude<DimensionUnit, 'auto'>, number> = {
  cm: 1,
  m: 100,
  mm: 0.1,
};

const dimensionUnitCandidates: Array<Exclude<DimensionUnit, 'auto'>> = ['m', 'cm', 'mm'];

export const defaultPalletTypes: PalletType[] = [
  { id: 'euro', name: 'Euro pallet - 120 x 80 x 150 cm', width: 120, depth: 80, height: 150 },
  { id: 'uk', name: 'UK pallet - 120 x 100 x 150 cm', width: 120, depth: 100, height: 150 },
  { id: 'tall-uk', name: 'Tall UK pallet - 120 x 100 x 180 cm', width: 120, depth: 100, height: 180 },
];

export const getPalletVolume = (palletType: PalletType) =>
  palletType.width * palletType.depth * palletType.height;

export const createLocationPalletType = (location: Location): PalletType => ({
  id: `location-${location.id}`,
  name: `${location.name} - ${location.width} x ${location.depth} x ${location.height} cm`,
  width: location.width,
  depth: location.depth,
  height: location.height,
});

const normalizeSku = (value: unknown) => String(value ?? '').trim().toUpperCase();
const normalizePackSku = (value: unknown) => normalizeSku(value).slice(1);

export const convertToCubicCentimeters = (value: number, unit: VolumeUnit) =>
  value * volumeMultipliers[unit];

export const convertToCentimeters = (value: number, unit: DimensionUnit) =>
  unit === 'auto' ? value : value * dimensionMultipliers[unit];

const parseNumber = (value: unknown) => {
  const rawValue = String(value ?? '').trim().replace(/\s/g, '');
  const lastCommaIndex = rawValue.lastIndexOf(',');
  const lastDotIndex = rawValue.lastIndexOf('.');
  let normalizedValue = rawValue;

  if (lastCommaIndex >= 0 && lastDotIndex >= 0) {
    const decimalSeparator = lastCommaIndex > lastDotIndex ? ',' : '.';
    const thousandsSeparator = decimalSeparator === ',' ? '.' : ',';
    normalizedValue = rawValue
      .split(thousandsSeparator)
      .join('')
      .replace(decimalSeparator, '.');
  } else if (lastCommaIndex >= 0) {
    normalizedValue = rawValue.replace(',', '.');
  }

  const parsedValue = Number.parseFloat(normalizedValue);
  return Number.isFinite(parsedValue) ? parsedValue : 0;
};

const getCellValue = (data: SheetData, rowIndex: number, columnIndex: number) =>
  data[rowIndex]?.[columnIndex]?.value ?? '';

const addLineToPallet = (
  pallet: PackedPallet,
  sku: string,
  width: number,
  depth: number,
  height: number,
  boxVolume: number,
  boxes: number,
  partialBoxes: number,
  volume: number,
) => {
  const existingLine = pallet.lines.find((line) => line.sku === sku);
  if (existingLine) {
    existingLine.boxes += boxes;
    existingLine.partialBoxes += partialBoxes;
    existingLine.volume += volume;
  } else {
    pallet.lines.push({ sku, boxVolume, boxes, depth, height, partialBoxes, volume, width });
  }

  pallet.usedVolume += volume;
  pallet.remainingVolume -= volume;
};

const createPallet = (index: number, palletVolume: number): PackedPallet => ({
  boxes: [],
  id: `pallet-${index}`,
  index,
  lines: [],
  remainingVolume: palletVolume,
  usedVolume: 0,
});

interface BoxUnit {
  id: string;
  sku: string;
  width: number;
  depth: number;
  height: number;
  volume: number;
  isPartial: boolean;
}

interface PackingState {
  pallet: PackedPallet;
}

const createPackingState = (index: number, palletVolume: number): PackingState => ({
  pallet: createPallet(index, palletVolume),
});

const getBoxOrientations = (box: BoxUnit) => [
  { width: box.width, depth: box.depth, height: box.height },
  { width: box.width, depth: box.height, height: box.depth },
  { width: box.depth, depth: box.width, height: box.height },
  { width: box.depth, depth: box.height, height: box.width },
  { width: box.height, depth: box.width, height: box.depth },
  { width: box.height, depth: box.depth, height: box.width },
].filter(
  (orientation, index, orientations) =>
    orientations.findIndex(
      (candidate) =>
        candidate.width === orientation.width &&
        candidate.depth === orientation.depth &&
        candidate.height === orientation.height,
    ) === index,
);

const canFitBox = (
  box: BoxUnit,
  palletType: PalletType,
) =>
  getBoxOrientations(box).some(
    (orientation) =>
      orientation.width <= palletType.width &&
      orientation.depth <= palletType.depth &&
      orientation.height <= palletType.height,
  );

const deriveCubeDimensions = (volume: number) => {
  const side = Math.cbrt(volume);
  return { depth: side, height: side, width: side };
};

const resolveBoxDimensions = (
  rawWidth: number,
  rawHeight: number,
  rawDepth: number,
  volume: number,
  dimensionUnit: DimensionUnit,
  palletType: PalletType,
) => {
  if (rawWidth <= 0 || rawHeight <= 0 || rawDepth <= 0) {
    return deriveCubeDimensions(volume);
  }

  if (dimensionUnit !== 'auto') {
    return {
      depth: convertToCentimeters(rawDepth, dimensionUnit),
      height: convertToCentimeters(rawHeight, dimensionUnit),
      width: convertToCentimeters(rawWidth, dimensionUnit),
    };
  }

  return dimensionUnitCandidates
    .map((unit) => {
      const width = convertToCentimeters(rawWidth, unit);
      const height = convertToCentimeters(rawHeight, unit);
      const depth = convertToCentimeters(rawDepth, unit);
      const dimensionVolume = width * height * depth;
      const volumeDifference = Math.abs(dimensionVolume - volume) / Math.max(volume, 1);
      const fits = canFitBox(
        {
          id: 'candidate',
          sku: 'candidate',
          width,
          depth,
          height,
          volume,
          isPartial: false,
        },
        palletType,
      );

      return {
        depth,
        height,
        score: (fits ? 0 : 1000) + volumeDifference,
        width,
      };
    })
    .sort((a, b) => a.score - b.score)[0];
};

interface BoxOrientation {
  depth: number;
  height: number;
  width: number;
}

interface CandidatePoint {
  x: number;
  z: number;
}

interface PlacementCandidate {
  boundingDepth: number;
  boundingHeight: number;
  boundingVolume: number;
  boundingWidth: number;
  heightAfter: number;
  orientation: BoxOrientation;
  orientationFillRatio: number;
  remainingAfter: number;
  state: PackingState;
  x: number;
  y: number;
  z: number;
}

const coordinatePrecision = 1000;
const coordinateTolerance = 0.0001;
const maxCandidateGridPoints = 1200;
const minimumSupportCoverage = 0.5;
const lowUtilizationRedistributionThreshold = 0.5;

const roundCoordinate = (value: number) =>
  Math.round(value * coordinatePrecision) / coordinatePrecision;

const getBoxBounds = (box: PackedBox) => ({
  maxX: box.x + box.width / 2,
  maxY: box.y + box.height / 2,
  maxZ: box.z + box.depth / 2,
  minX: box.x - box.width / 2,
  minY: box.y - box.height / 2,
  minZ: box.z - box.depth / 2,
});

const rangesOverlap = (
  minA: number,
  maxA: number,
  minB: number,
  maxB: number,
) => minA < maxB - coordinateTolerance && maxA > minB + coordinateTolerance;

const hasOverlap = (
  box: PackedBox,
  x: number,
  y: number,
  z: number,
  orientation: BoxOrientation,
) => {
  const bounds = getBoxBounds(box);

  return (
    rangesOverlap(x, x + orientation.width, bounds.minX, bounds.maxX) &&
    rangesOverlap(y, y + orientation.height, bounds.minY, bounds.maxY) &&
    rangesOverlap(z, z + orientation.depth, bounds.minZ, bounds.maxZ)
  );
};

interface SupportRect {
  maxX: number;
  maxZ: number;
  minX: number;
  minZ: number;
}

const isCellCovered = (
  rects: SupportRect[],
  minX: number,
  maxX: number,
  minZ: number,
  maxZ: number,
) =>
  rects.some(
    (rect) =>
      minX >= rect.minX - coordinateTolerance &&
      maxX <= rect.maxX + coordinateTolerance &&
      minZ >= rect.minZ - coordinateTolerance &&
      maxZ <= rect.maxZ + coordinateTolerance,
  );

const isFootprintSupported = (
  pallet: PackedPallet,
  x: number,
  y: number,
  z: number,
  orientation: BoxOrientation,
) => {
  if (y <= coordinateTolerance) {
    return true;
  }

  const footprint = {
    maxX: x + orientation.width,
    maxZ: z + orientation.depth,
    minX: x,
    minZ: z,
  };
  const supportingRects = pallet.boxes
    .map((box) => {
      const bounds = getBoxBounds(box);
      if (Math.abs(bounds.maxY - y) > coordinateTolerance) {
        return null;
      }

      const support = {
        maxX: Math.min(bounds.maxX, footprint.maxX),
        maxZ: Math.min(bounds.maxZ, footprint.maxZ),
        minX: Math.max(bounds.minX, footprint.minX),
        minZ: Math.max(bounds.minZ, footprint.minZ),
      };

      return support.maxX > support.minX + coordinateTolerance &&
        support.maxZ > support.minZ + coordinateTolerance
        ? support
        : null;
    })
    .filter((rect): rect is SupportRect => rect !== null);

  if (supportingRects.length === 0) {
    return false;
  }

  const centerX = x + orientation.width / 2;
  const centerZ = z + orientation.depth / 2;
  const isCenterSupported = supportingRects.some(
    (rect) =>
      centerX >= rect.minX - coordinateTolerance &&
      centerX <= rect.maxX + coordinateTolerance &&
      centerZ >= rect.minZ - coordinateTolerance &&
      centerZ <= rect.maxZ + coordinateTolerance,
  );

  if (!isCenterSupported) {
    return false;
  }

  const xCuts = new Set<number>([footprint.minX, footprint.maxX]);
  const zCuts = new Set<number>([footprint.minZ, footprint.maxZ]);
  supportingRects.forEach((rect) => {
    xCuts.add(rect.minX);
    xCuts.add(rect.maxX);
    zCuts.add(rect.minZ);
    zCuts.add(rect.maxZ);
  });

  const xValues = [...xCuts].sort((a, b) => a - b);
  const zValues = [...zCuts].sort((a, b) => a - b);
  let supportedArea = 0;

  for (let xIndex = 0; xIndex < xValues.length - 1; xIndex += 1) {
    for (let zIndex = 0; zIndex < zValues.length - 1; zIndex += 1) {
      const minX = xValues[xIndex];
      const maxX = xValues[xIndex + 1];
      const minZ = zValues[zIndex];
      const maxZ = zValues[zIndex + 1];

      if (
        maxX - minX > coordinateTolerance &&
        maxZ - minZ > coordinateTolerance &&
        isCellCovered(supportingRects, minX, maxX, minZ, maxZ)
      ) {
        supportedArea += (maxX - minX) * (maxZ - minZ);
      }
    }
  }

  const footprintArea = orientation.width * orientation.depth;
  return supportedArea / footprintArea >= minimumSupportCoverage;
};

const getPlacedHeight = (pallet: PackedPallet) =>
  pallet.boxes.reduce(
    (height, box) => Math.max(height, getBoxBounds(box).maxY),
    0,
  );

const getCandidatePoints = (
  pallet: PackedPallet,
  palletType: PalletType,
): CandidatePoint[] => {
  const xEdges = new Set<number>([0]);
  const zEdges = new Set<number>([0]);
  const edgePoints = new Map<string, CandidatePoint>();

  const addPoint = (x: number, z: number) => {
    if (x < -coordinateTolerance || z < -coordinateTolerance) {
      return;
    }

    if (x > palletType.width - coordinateTolerance || z > palletType.depth - coordinateTolerance) {
      return;
    }

    const point = { x: roundCoordinate(x), z: roundCoordinate(z) };
    edgePoints.set(`${point.x}:${point.z}`, point);
  };

  addPoint(0, 0);

  pallet.boxes.forEach((box) => {
    const bounds = getBoxBounds(box);
    [bounds.minX, bounds.maxX].forEach((x) => xEdges.add(roundCoordinate(x)));
    [bounds.minZ, bounds.maxZ].forEach((z) => zEdges.add(roundCoordinate(z)));
    addPoint(bounds.maxX, bounds.minZ);
    addPoint(bounds.minX, bounds.maxZ);
    addPoint(bounds.maxX, bounds.maxZ);
    addPoint(bounds.minX, bounds.minZ);
  });

  if (xEdges.size * zEdges.size <= maxCandidateGridPoints) {
    xEdges.forEach((x) => {
      zEdges.forEach((z) => addPoint(x, z));
    });
  }

  return [...edgePoints.values()].sort((a, b) => a.z - b.z || a.x - b.x);
};

const getDropHeight = (
  pallet: PackedPallet,
  x: number,
  z: number,
  orientation: BoxOrientation,
) =>
  pallet.boxes.reduce((height, box) => {
    const bounds = getBoxBounds(box);
    const overlapsFootprint =
      rangesOverlap(x, x + orientation.width, bounds.minX, bounds.maxX) &&
      rangesOverlap(z, z + orientation.depth, bounds.minZ, bounds.maxZ);

    return overlapsFootprint ? Math.max(height, bounds.maxY) : height;
  }, 0);

const getOrientationFillRatio = (
  box: BoxUnit,
  orientation: BoxOrientation,
  palletType: PalletType,
) => {
  const count =
    Math.floor(palletType.width / orientation.width) *
    Math.floor(palletType.depth / orientation.depth) *
    Math.floor(palletType.height / orientation.height);

  return (count * box.volume) / getPalletVolume(palletType);
};

const findBestPlacementForState = (
  state: PackingState,
  box: BoxUnit,
  palletType: PalletType,
): PlacementCandidate | null => {
  if (state.pallet.remainingVolume < box.volume) {
    return null;
  }

  const currentHeight = getPlacedHeight(state.pallet);
  const candidates = getCandidatePoints(state.pallet, palletType);

  return candidates
    .flatMap((point) =>
      getBoxOrientations(box).map((orientation) => {
        const y = getDropHeight(state.pallet, point.x, point.z, orientation);
        const heightAfter = Math.max(currentHeight, y + orientation.height);

        if (
          point.x + orientation.width > palletType.width + coordinateTolerance ||
          point.z + orientation.depth > palletType.depth + coordinateTolerance ||
          heightAfter > palletType.height + coordinateTolerance
        ) {
          return null;
        }

        if (state.pallet.boxes.some((placedBox) => hasOverlap(placedBox, point.x, y, point.z, orientation))) {
          return null;
        }

        if (!isFootprintSupported(state.pallet, point.x, y, point.z, orientation)) {
          return null;
        }

        const boundingWidth = Math.max(
          orientation.width + point.x,
          ...state.pallet.boxes.map((placedBox) => getBoxBounds(placedBox).maxX),
        );
        const boundingDepth = Math.max(
          orientation.depth + point.z,
          ...state.pallet.boxes.map((placedBox) => getBoxBounds(placedBox).maxZ),
        );
        const boundingVolume = boundingWidth * boundingDepth * heightAfter;

        return {
          boundingDepth,
          boundingHeight: heightAfter,
          boundingVolume,
          boundingWidth,
          heightAfter,
          orientation,
          orientationFillRatio: getOrientationFillRatio(box, orientation, palletType),
          remainingAfter: state.pallet.remainingVolume - box.volume,
          state,
          x: point.x,
          y,
          z: point.z,
        };
      }),
    )
    .filter((candidate): candidate is PlacementCandidate => candidate !== null)
    .sort(
      (a, b) =>
        a.remainingAfter - b.remainingAfter ||
        b.orientationFillRatio - a.orientationFillRatio ||
        a.boundingVolume - b.boundingVolume ||
        a.boundingHeight - b.boundingHeight ||
        a.boundingDepth - b.boundingDepth ||
        a.boundingWidth - b.boundingWidth ||
        a.z - b.z ||
        a.y - b.y ||
        a.x - b.x,
    )[0] ?? null;
};

const commitPlacement = (placement: PlacementCandidate, box: BoxUnit) => {
  const { orientation, state, x, y, z } = placement;

  state.pallet.boxes.push({
    id: box.id,
    sku: box.sku,
    x: x + orientation.width / 2,
    y: y + orientation.height / 2,
    z: z + orientation.depth / 2,
    width: orientation.width,
    depth: orientation.depth,
    height: orientation.height,
    volume: box.volume,
    isPartial: box.isPartial,
  });

  addLineToPallet(
    state.pallet,
    box.sku,
    box.width,
    box.depth,
    box.height,
    box.volume,
    1,
    box.isPartial ? 1 : 0,
    box.volume,
  );
};

const createBoxUnits = (skus: EstimateSku[]) =>
  skus.flatMap((sku) => {
    const fullBoxes = Array.from({ length: sku.fullBoxes }, (_, index): BoxUnit => ({
      id: `${sku.sku}-box-${index + 1}`,
      sku: sku.sku,
      width: sku.width,
      depth: sku.depth,
      height: sku.height,
      volume: sku.boxVolume,
      isPartial: false,
    }));

    if (sku.partialBoxes === 0) {
      return fullBoxes;
    }

    return [
      ...fullBoxes,
      {
        id: `${sku.sku}-partial-box`,
        sku: sku.sku,
        width: sku.width,
        depth: sku.depth,
        height: sku.height,
        volume: sku.boxVolume,
        isPartial: true,
      },
    ];
  });

type ColumnOrientationStrategy = 'balanced' | 'deep' | 'low' | 'max-stack' | 'wide';

interface ColumnUnit {
  boxes: BoxUnit[];
  depth: number;
  height: number;
  id: string;
  volume: number;
  width: number;
}

interface ColumnPlacementCandidate {
  boundingArea: number;
  boundingDepth: number;
  boundingWidth: number;
  column: ColumnUnit;
  remainingAfter: number;
  state: PackingState;
  x: number;
  z: number;
}

const compareColumnOrientations = (
  strategy: ColumnOrientationStrategy,
  box: BoxUnit,
  palletType: PalletType,
) => (a: BoxOrientation, b: BoxOrientation) => {
  const stackA = Math.floor(palletType.height / a.height);
  const stackB = Math.floor(palletType.height / b.height);
  const fitA = getOrientationFillRatio(box, a, palletType);
  const fitB = getOrientationFillRatio(box, b, palletType);
  const baseA = a.width * a.depth;
  const baseB = b.width * b.depth;
  const fallback = fitB - fitA || stackB - stackA || baseB - baseA || a.height - b.height;

  if (strategy === 'max-stack') {
    return stackB - stackA || fitB - fitA || baseB - baseA || a.height - b.height;
  }

  if (strategy === 'low') {
    return a.height - b.height || fitB - fitA || baseB - baseA;
  }

  if (strategy === 'wide') {
    return b.width - a.width || fallback;
  }

  if (strategy === 'deep') {
    return b.depth - a.depth || fallback;
  }

  return fallback;
};

const getColumnOrientation = (
  box: BoxUnit,
  palletType: PalletType,
  strategy: ColumnOrientationStrategy,
) =>
  getBoxOrientations(box)
    .filter(
      (orientation) =>
        orientation.width <= palletType.width &&
        orientation.depth <= palletType.depth &&
        orientation.height <= palletType.height,
    )
    .sort(compareColumnOrientations(strategy, box, palletType))[0] ?? null;

const getDimensionGroupKey = (box: BoxUnit) =>
  [box.width, box.depth, box.height].map((value) => roundCoordinate(value)).join(':');

const createColumnUnits = (
  boxes: BoxUnit[],
  palletType: PalletType,
  strategy: ColumnOrientationStrategy,
) => {
  const groupedBoxes = boxes.reduce<Map<string, BoxUnit[]>>((groups, box) => {
    const key = getDimensionGroupKey(box);
    groups.set(key, [...(groups.get(key) ?? []), box]);
    return groups;
  }, new Map());
  const columns: ColumnUnit[] = [];

  groupedBoxes.forEach((groupBoxes, groupIndex) => {
    const sampleBox = groupBoxes[0];
    const orientation = getColumnOrientation(sampleBox, palletType, strategy);
    if (!orientation) {
      return;
    }

    const stackSize = Math.max(1, Math.floor(palletType.height / orientation.height));
    const sortedBoxes = [...groupBoxes].sort(
      (a, b) => comparePartialBoxesLast(a, b) || a.sku.localeCompare(b.sku) || a.id.localeCompare(b.id),
    );

    for (let index = 0; index < sortedBoxes.length; index += stackSize) {
      const columnBoxes = sortedBoxes.slice(index, index + stackSize);
      columns.push({
        boxes: columnBoxes,
        depth: orientation.depth,
        height: columnBoxes.length * orientation.height,
        id: `column-${groupIndex}-${index / stackSize}`,
        volume: columnBoxes.reduce((volume, box) => volume + box.volume, 0),
        width: orientation.width,
      });
    }
  });

  return columns;
};

const getFloorCandidatePoints = (
  pallet: PackedPallet,
  palletType: PalletType,
) => {
  const xEdges = new Set<number>([0]);
  const zEdges = new Set<number>([0]);
  const points = new Map<string, CandidatePoint>();

  const addPoint = (x: number, z: number) => {
    if (
      x < -coordinateTolerance ||
      z < -coordinateTolerance ||
      x > palletType.width - coordinateTolerance ||
      z > palletType.depth - coordinateTolerance
    ) {
      return;
    }

    const point = { x: roundCoordinate(x), z: roundCoordinate(z) };
    points.set(`${point.x}:${point.z}`, point);
  };

  addPoint(0, 0);
  pallet.boxes.forEach((box) => {
    const bounds = getBoxBounds(box);
    [bounds.minX, bounds.maxX].forEach((x) => xEdges.add(roundCoordinate(x)));
    [bounds.minZ, bounds.maxZ].forEach((z) => zEdges.add(roundCoordinate(z)));
    addPoint(bounds.maxX, bounds.minZ);
    addPoint(bounds.minX, bounds.maxZ);
    addPoint(bounds.maxX, bounds.maxZ);
  });

  if (xEdges.size * zEdges.size <= maxCandidateGridPoints) {
    xEdges.forEach((x) => {
      zEdges.forEach((z) => addPoint(x, z));
    });
  }

  return [...points.values()].sort((a, b) => a.z - b.z || a.x - b.x);
};

const hasFloorOverlap = (
  box: PackedBox,
  x: number,
  z: number,
  column: ColumnUnit,
) => {
  const bounds = getBoxBounds(box);
  return (
    rangesOverlap(x, x + column.width, bounds.minX, bounds.maxX) &&
    rangesOverlap(z, z + column.depth, bounds.minZ, bounds.maxZ)
  );
};

const findBestColumnPlacementForState = (
  state: PackingState,
  column: ColumnUnit,
  palletType: PalletType,
): ColumnPlacementCandidate | null => {
  if (state.pallet.remainingVolume < column.volume) {
    return null;
  }

  return getFloorCandidatePoints(state.pallet, palletType)
    .map((point) => {
      if (
        point.x + column.width > palletType.width + coordinateTolerance ||
        point.z + column.depth > palletType.depth + coordinateTolerance ||
        column.height > palletType.height + coordinateTolerance ||
        state.pallet.boxes.some((box) => hasFloorOverlap(box, point.x, point.z, column))
      ) {
        return null;
      }

      const boundingWidth = Math.max(
        point.x + column.width,
        ...state.pallet.boxes.map((box) => getBoxBounds(box).maxX),
      );
      const boundingDepth = Math.max(
        point.z + column.depth,
        ...state.pallet.boxes.map((box) => getBoxBounds(box).maxZ),
      );

      return {
        boundingArea: boundingWidth * boundingDepth,
        boundingDepth,
        boundingWidth,
        column,
        remainingAfter: state.pallet.remainingVolume - column.volume,
        state,
        x: point.x,
        z: point.z,
      };
    })
    .filter((candidate): candidate is ColumnPlacementCandidate => candidate !== null)
    .sort(
      (a, b) =>
        a.remainingAfter - b.remainingAfter ||
        a.boundingArea - b.boundingArea ||
        a.boundingDepth - b.boundingDepth ||
        a.boundingWidth - b.boundingWidth ||
        b.column.height - a.column.height ||
        a.z - b.z ||
        a.x - b.x,
    )[0] ?? null;
};

const commitColumnPlacement = (placement: ColumnPlacementCandidate) => {
  const boxHeight = placement.column.height / placement.column.boxes.length;

  placement.column.boxes.forEach((box, index) => {
    const y = index * boxHeight;

    placement.state.pallet.boxes.push({
      id: box.id,
      sku: box.sku,
      x: placement.x + placement.column.width / 2,
      y: y + boxHeight / 2,
      z: placement.z + placement.column.depth / 2,
      width: placement.column.width,
      depth: placement.column.depth,
      height: boxHeight,
      volume: box.volume,
      isPartial: box.isPartial,
    });

    addLineToPallet(
      placement.state.pallet,
      box.sku,
      box.width,
      box.depth,
      box.height,
      box.volume,
      1,
      box.isPartial ? 1 : 0,
      box.volume,
    );
  });
};

const compareColumns = (a: ColumnUnit, b: ColumnUnit) =>
  b.volume - a.volume ||
  b.width * b.depth - a.width * a.depth ||
  b.height - a.height ||
  a.id.localeCompare(b.id);

const packColumnSequence = (
  columns: ColumnUnit[],
  palletType: PalletType,
  palletVolume: number,
) => {
  const palletStates: PackingState[] = [];

  columns.forEach((column) => {
    const existingPlacement = palletStates
      .map((state) => findBestColumnPlacementForState(state, column, palletType))
      .filter((placement): placement is ColumnPlacementCandidate => placement !== null)
      .sort(
        (a, b) =>
          a.remainingAfter - b.remainingAfter ||
          a.boundingArea - b.boundingArea ||
          a.z - b.z ||
          a.x - b.x,
      )[0] ?? null;

    if (existingPlacement) {
      commitColumnPlacement(existingPlacement);
      return;
    }

    const nextState = createPackingState(palletStates.length + 1, palletVolume);
    const nextPlacement = findBestColumnPlacementForState(nextState, column, palletType);
    if (nextPlacement) {
      commitColumnPlacement(nextPlacement);
      palletStates.push(nextState);
    }
  });

  return sortPalletsByDensity(palletStates.map((state) => state.pallet));
};

interface BoxPlacementCandidate extends PlacementCandidate {
  box: BoxUnit;
  boxIndex: number;
}

interface BoxFamily {
  boxes: BoxUnit[];
  key: string;
  volume: number;
}

const getBoxFamilyKey = (box: BoxUnit) =>
  [
    roundCoordinate(box.width),
    roundCoordinate(box.depth),
    roundCoordinate(box.height),
    roundCoordinate(box.volume),
  ].join(':');

const createBoxFamilies = (boxes: BoxUnit[]) =>
  [...boxes
    .reduce<Map<string, BoxFamily>>((families, box) => {
      const key = getBoxFamilyKey(box);
      const family = families.get(key) ?? { boxes: [], key, volume: box.volume };
      family.boxes.push(box);
      families.set(key, family);
      return families;
    }, new Map())
    .values()]
    .sort(
      (a, b) =>
        b.volume - a.volume ||
        b.boxes.length - a.boxes.length ||
        a.key.localeCompare(b.key),
    );

const findBestBoxPlacement = (
  state: PackingState,
  boxes: BoxUnit[],
  palletType: PalletType,
): BoxPlacementCandidate | null =>
  boxes
    .map((box, boxIndex) => {
      const placement = findBestPlacementForState(state, box, palletType);
      return placement ? { ...placement, box, boxIndex } : null;
    })
    .filter((candidate): candidate is BoxPlacementCandidate => candidate !== null)
    .sort(
      (a, b) =>
        b.box.volume - a.box.volume ||
        a.remainingAfter - b.remainingAfter ||
        b.orientationFillRatio - a.orientationFillRatio ||
        a.boundingVolume - b.boundingVolume ||
        a.boundingHeight - b.boundingHeight ||
        a.z - b.z ||
        a.y - b.y ||
        a.x - b.x,
    )[0] ?? null;

const removeBoxFromPool = (boxes: BoxUnit[], boxId: string) => {
  const index = boxes.findIndex((box) => box.id === boxId);
  if (index >= 0) {
    boxes.splice(index, 1);
  }
};

const fillPalletFromPool = (
  state: PackingState,
  availableBoxes: BoxUnit[],
  palletType: PalletType,
  filterBox: (box: BoxUnit) => boolean,
) => {
  let placedBoxes = 0;

  while (true) {
    const candidatePool = availableBoxes.filter(filterBox);
    const placement = findBestBoxPlacement(state, candidatePool, palletType);

    if (!placement) {
      break;
    }

    commitPlacement(placement, placement.box);
    removeBoxFromPool(availableBoxes, placement.box.id);
    placedBoxes += 1;
  }

  return placedBoxes;
};

const packFamilyFirstSequence = (
  boxes: BoxUnit[],
  palletType: PalletType,
  palletVolume: number,
) => {
  const availableBoxes = [...boxes].sort(compareBoxesByStrategy('volume', palletType));
  const palletStates: PackingState[] = [];
  const families = createBoxFamilies(availableBoxes);

  families.forEach((family) => {
    while (availableBoxes.some((box) => getBoxFamilyKey(box) === family.key)) {
      const state = createPackingState(palletStates.length + 1, palletVolume);
      const sameFamilyCount = fillPalletFromPool(
        state,
        availableBoxes,
        palletType,
        (box) => getBoxFamilyKey(box) === family.key,
      );

      if (sameFamilyCount === 0) {
        break;
      }

      fillPalletFromPool(
        state,
        availableBoxes,
        palletType,
        (box) => box.volume <= family.volume * 1.08 && box.volume >= family.volume * 0.65,
      );
      fillPalletFromPool(
        state,
        availableBoxes,
        palletType,
        (box) => box.volume < family.volume * 0.65,
      );
      palletStates.push(state);
    }
  });

  if (availableBoxes.length > 0) {
    const leftoverPallets = packBoxSequence(
      availableBoxes.sort(compareBoxesByStrategy('volume', palletType)),
      palletType,
      palletVolume,
    );
    return sortPalletsByDensity([
      ...palletStates.map((state) => state.pallet),
      ...leftoverPallets,
    ]);
  }

  return sortPalletsByDensity(palletStates.map((state) => state.pallet));
};

type PackingStrategy = 'base-area' | 'height' | 'orientation-fill' | 'sku' | 'volume';

const comparePartialBoxesLast = (a: BoxUnit, b: BoxUnit) =>
  Number(a.isPartial) - Number(b.isPartial);

const getBestOrientationFillRatio = (box: BoxUnit, palletType: PalletType) =>
  Math.max(
    ...getBoxOrientations(box).map((orientation) =>
      getOrientationFillRatio(box, orientation, palletType),
    ),
  );

const compareBoxesByStrategy = (
  strategy: PackingStrategy,
  palletType: PalletType,
) => (a: BoxUnit, b: BoxUnit) => {
  const fallback =
    comparePartialBoxesLast(a, b) ||
    a.sku.localeCompare(b.sku) ||
    a.id.localeCompare(b.id);

  if (strategy === 'height') {
    return (
      b.height - a.height ||
      b.volume - a.volume ||
      b.width * b.depth - a.width * a.depth ||
      fallback
    );
  }

  if (strategy === 'base-area') {
    return (
      b.width * b.depth - a.width * a.depth ||
      b.volume - a.volume ||
      b.height - a.height ||
      fallback
    );
  }

  if (strategy === 'orientation-fill') {
    return (
      getBestOrientationFillRatio(b, palletType) - getBestOrientationFillRatio(a, palletType) ||
      b.volume - a.volume ||
      fallback
    );
  }

  if (strategy === 'sku') {
    return (
      a.sku.localeCompare(b.sku) ||
      b.volume - a.volume ||
      b.width * b.depth - a.width * a.depth ||
      fallback
    );
  }

  return (
    b.volume - a.volume ||
    b.width * b.depth - a.width * a.depth ||
    b.height - a.height ||
    fallback
  );
};

const sortPalletsByDensity = (pallets: PackedPallet[]) =>
  pallets
    .sort((a, b) => b.usedVolume - a.usedVolume)
    .map((pallet, index) => ({
      ...pallet,
      id: `pallet-${index + 1}`,
      index: index + 1,
    }));

const packBoxSequence = (
  boxes: BoxUnit[],
  palletType: PalletType,
  palletVolume: number,
) => {
  const palletStates: PackingState[] = [];

  boxes.forEach((box) => {
    const existingPlacement = palletStates
      .map((state) => findBestPlacementForState(state, box, palletType))
      .filter((placement): placement is PlacementCandidate => placement !== null)
      .sort(
        (a, b) =>
          a.remainingAfter - b.remainingAfter ||
          b.orientationFillRatio - a.orientationFillRatio ||
          a.boundingVolume - b.boundingVolume ||
          a.boundingHeight - b.boundingHeight ||
          a.z - b.z ||
          a.y - b.y ||
          a.x - b.x,
      )[0] ?? null;

    if (existingPlacement) {
      commitPlacement(existingPlacement, box);
      return;
    }

    const nextState = createPackingState(palletStates.length + 1, palletVolume);
    const nextPlacement = findBestPlacementForState(nextState, box, palletType);
    if (nextPlacement) {
      commitPlacement(nextPlacement, box);
      palletStates.push(nextState);
    }
  });

  return sortPalletsByDensity(palletStates.map((state) => state.pallet));
};

const createBoxUnitFromPackedBox = (box: PackedBox): BoxUnit => ({
  depth: box.depth,
  height: box.height,
  id: box.id,
  isPartial: box.isPartial,
  sku: box.sku,
  volume: box.volume,
  width: box.width,
});

const createPalletFromPackedBoxes = (
  index: number,
  palletVolume: number,
  boxes: PackedBox[],
) => {
  const pallet = createPallet(index, palletVolume);
  pallet.boxes = boxes.map((box) => ({ ...box }));

  pallet.boxes.forEach((box) => {
    addLineToPallet(
      pallet,
      box.sku,
      box.width,
      box.depth,
      box.height,
      box.volume,
      1,
      box.isPartial ? 1 : 0,
      box.volume,
    );
  });

  return pallet;
};

const packIntoFixedPalletCount = (
  boxes: BoxUnit[],
  palletType: PalletType,
  palletVolume: number,
  palletCount: number,
) => {
  const palletStates = Array.from({ length: palletCount }, (_, index) =>
    createPackingState(index + 1, palletVolume),
  );

  for (const box of boxes) {
    const existingPlacement = palletStates
      .map((state) => findBestPlacementForState(state, box, palletType))
      .filter((placement): placement is PlacementCandidate => placement !== null)
      .sort(
        (a, b) =>
          a.remainingAfter - b.remainingAfter ||
          b.orientationFillRatio - a.orientationFillRatio ||
          a.boundingVolume - b.boundingVolume ||
          a.boundingHeight - b.boundingHeight ||
          a.z - b.z ||
          a.y - b.y ||
          a.x - b.x,
      )[0] ?? null;

    if (!existingPlacement) {
      return null;
    }

    commitPlacement(existingPlacement, box);
  }

  return sortPalletsByDensity(
    palletStates
      .map((state) => state.pallet)
      .filter((pallet) => pallet.boxes.length > 0),
  );
};

const tryRepackIntoFewerPallets = (
  boxes: BoxUnit[],
  palletType: PalletType,
  palletVolume: number,
  targetPalletCount: number,
) => {
  const strategies: PackingStrategy[] =
    boxes.length > 1200
      ? ['orientation-fill', 'volume']
      : ['orientation-fill', 'volume', 'base-area', 'height', 'sku'];

  return strategies.reduce<PackedPallet[] | null>((bestPacking, strategy) => {
    const candidate = packIntoFixedPalletCount(
      [...boxes].sort(compareBoxesByStrategy(strategy, palletType)),
      palletType,
      palletVolume,
      targetPalletCount,
    );

    if (!candidate) {
      return bestPacking;
    }

    return chooseBetterPacking(bestPacking, candidate);
  }, null);
};

const tryDrainLowUtilizationPallet = (
  pallets: PackedPallet[],
  sourceIndex: number,
  palletType: PalletType,
  palletVolume: number,
) => {
  const targetStates = pallets
    .filter((_, index) => index !== sourceIndex)
    .map((pallet) => ({
      pallet: createPalletFromPackedBoxes(pallet.index, palletVolume, pallet.boxes),
    }));
  const sourceBoxes = pallets[sourceIndex].boxes
    .map(createBoxUnitFromPackedBox)
    .sort(compareBoxesByStrategy('volume', palletType));

  for (const box of sourceBoxes) {
    const existingPlacement = targetStates
      .map((state) => findBestPlacementForState(state, box, palletType))
      .filter((placement): placement is PlacementCandidate => placement !== null)
      .sort(
        (a, b) =>
          a.remainingAfter - b.remainingAfter ||
          b.orientationFillRatio - a.orientationFillRatio ||
          a.boundingVolume - b.boundingVolume ||
          a.boundingHeight - b.boundingHeight ||
          a.z - b.z ||
          a.y - b.y ||
          a.x - b.x,
      )[0] ?? null;

    if (!existingPlacement) {
      return null;
    }

    commitPlacement(existingPlacement, box);
  }

  return sortPalletsByDensity(targetStates.map((state) => state.pallet));
};

const redistributeLowUtilizationPallets = (
  pallets: PackedPallet[],
  palletType: PalletType,
  palletVolume: number,
) => {
  let bestPallets = sortPalletsByDensity(pallets);
  let movedLowPallet = true;

  while (movedLowPallet) {
    movedLowPallet = false;
    const lowPalletIndexes = bestPallets
      .map((pallet, index) => ({ index, utilization: pallet.usedVolume / palletVolume }))
      .filter((item) => item.utilization < lowUtilizationRedistributionThreshold)
      .sort((a, b) => a.utilization - b.utilization)
      .map((item) => item.index);

    for (const sourceIndex of lowPalletIndexes) {
      const sourcePallet = bestPallets[sourceIndex];
      if (!sourcePallet || sourcePallet.usedVolume / palletVolume >= lowUtilizationRedistributionThreshold) {
        continue;
      }

      const redistributedPallets = tryDrainLowUtilizationPallet(
        bestPallets,
        sourceIndex,
        palletType,
        palletVolume,
      );

      if (redistributedPallets && redistributedPallets.length < bestPallets.length) {
        bestPallets = redistributedPallets;
        movedLowPallet = true;
        break;
      }
    }
  }

  return sortPalletsByDensity(bestPallets);
};

const consolidatePallets = (
  pallets: PackedPallet[],
  palletType: PalletType,
  palletVolume: number,
) => {
  let bestPallets = redistributeLowUtilizationPallets(pallets, palletType, palletVolume);
  const totalVolume = bestPallets.reduce((total, pallet) => total + pallet.usedVolume, 0);
  const minimumPalletsByVolume = Math.max(1, Math.ceil(totalVolume / palletVolume));

  while (bestPallets.length > minimumPalletsByVolume) {
    const targetPalletCount = bestPallets.length - 1;
    const boxes = bestPallets
      .flatMap((pallet) => pallet.boxes)
      .map(createBoxUnitFromPackedBox);
    const tighterPacking = tryRepackIntoFewerPallets(
      boxes,
      palletType,
      palletVolume,
      targetPalletCount,
    );

    if (!tighterPacking || tighterPacking.length >= bestPallets.length) {
      break;
    }

    bestPallets = redistributeLowUtilizationPallets(tighterPacking, palletType, palletVolume);
  }

  return redistributeLowUtilizationPallets(bestPallets, palletType, palletVolume);
};

const getPackingDensityScore = (pallets: PackedPallet[]) =>
  pallets.reduce((score, pallet) => score + pallet.usedVolume ** 2, 0);

const chooseBetterPacking = (
  currentBest: PackedPallet[] | null,
  candidate: PackedPallet[],
) => {
  if (!currentBest) {
    return candidate;
  }

  if (candidate.length !== currentBest.length) {
    return candidate.length < currentBest.length ? candidate : currentBest;
  }

  const candidateLastPallet = candidate[candidate.length - 1];
  const currentLastPallet = currentBest[currentBest.length - 1];
  const candidateLastVolume = candidateLastPallet?.usedVolume ?? 0;
  const currentLastVolume = currentLastPallet?.usedVolume ?? 0;

  if (candidateLastVolume !== currentLastVolume) {
    return candidateLastVolume < currentLastVolume ? candidate : currentBest;
  }

  return getPackingDensityScore(candidate) > getPackingDensityScore(currentBest)
    ? candidate
    : currentBest;
};

const packPallets = (
  skus: EstimateSku[],
  palletType: PalletType,
  packingMode: PackingMode,
): { oversizedSkus: EstimateSku[]; pallets: PackedPallet[] } => {
  const palletVolume = getPalletVolume(palletType);
  const oversizedSkus: EstimateSku[] = [];
  const oversizedSkuIds = new Set<string>();

  skus
    .forEach((sku) => {
      if (sku.boxVolume > palletVolume || !canFitBox(
        {
          id: sku.sku,
          sku: sku.sku,
          width: sku.width,
          depth: sku.depth,
          height: sku.height,
          volume: sku.boxVolume,
          isPartial: false,
        },
        palletType,
      )) {
        oversizedSkus.push(sku);
        oversizedSkuIds.add(sku.sku);
      }
    });

  const boxUnits = createBoxUnits(skus.filter((sku) => !oversizedSkuIds.has(sku.sku)));
  const strategies: PackingStrategy[] =
    boxUnits.length > 1200
      ? ['orientation-fill', 'volume', 'base-area']
      : ['orientation-fill', 'volume', 'base-area', 'height', 'sku'];
  const columnStrategies: ColumnOrientationStrategy[] =
    boxUnits.length > 1200
      ? ['balanced', 'max-stack', 'low']
      : ['balanced', 'max-stack', 'low', 'wide', 'deep'];
  const columnPacking = columnStrategies.reduce<PackedPallet[] | null>((bestPacking, strategy) => {
    const candidate = packColumnSequence(
      createColumnUnits(boxUnits, palletType, strategy).sort(compareColumns),
      palletType,
      palletVolume,
    );

    return chooseBetterPacking(bestPacking, candidate);
  }, null);
  const familyFirstPacking = packFamilyFirstSequence(boxUnits, palletType, palletVolume);
  const freePacking = strategies.reduce<PackedPallet[] | null>((bestPacking, strategy) => {
    const candidate = packBoxSequence(
      [...boxUnits].sort(compareBoxesByStrategy(strategy, palletType)),
      palletType,
      palletVolume,
    );

    return chooseBetterPacking(bestPacking, candidate);
  }, null) ?? [];
  const selectedPallets = packingMode === 'box-size'
    ? familyFirstPacking
    : packingMode === 'column-stack'
      ? columnPacking ?? []
      : freePacking;
  const pallets = consolidatePallets(selectedPallets, palletType, palletVolume);

  return { oversizedSkus, pallets };
};

export const calculatePalletEstimate = (
  orderLines: SheetData,
  packConfig: SheetData,
  palletType: PalletType,
  volumeUnit: VolumeUnit,
  dimensionUnit: DimensionUnit,
  packingMode: PackingMode,
): PalletEstimateResult => {
  const palletVolume = getPalletVolume(palletType);
  const packRows = new Map<string, {
    depth: number;
    height: number;
    packSku: string;
    ratio: number;
    volume: number;
    width: number;
  }>();
  const invalidPackConfigs: InvalidPackConfig[] = [];

  packConfig.forEach((row, rowIndex) => {
    const packSku = normalizeSku(row[packSkuColumn]?.value);
    if (!packSku) {
      return;
    }

    const sku = normalizePackSku(packSku);
    const volume = convertToCubicCentimeters(
      parseNumber(getCellValue(packConfig, rowIndex, packVolumeColumn)),
      volumeUnit,
    );
    const ratio = parseNumber(getCellValue(packConfig, rowIndex, packRatioColumn));
    const dimensions = resolveBoxDimensions(
      parseNumber(getCellValue(packConfig, rowIndex, packWidthColumn)),
      parseNumber(getCellValue(packConfig, rowIndex, packHeightColumn)),
      parseNumber(getCellValue(packConfig, rowIndex, packDepthColumn)),
      volume,
      dimensionUnit,
      palletType,
    );

    if (!sku) {
      invalidPackConfigs.push({ sku, packSku, reason: 'Pack SKU needs an order SKU after removing the first digit.' });
      return;
    }

    if (volume <= 0 || ratio <= 0) {
      invalidPackConfigs.push({ sku, packSku, reason: 'Volume and ratio must be greater than zero.' });
      return;
    }

    const physicalVolume = dimensions.width * dimensions.depth * dimensions.height;
    if (physicalVolume <= 0) {
      invalidPackConfigs.push({ sku, packSku, reason: 'Width, height, and depth must create a valid box volume.' });
      return;
    }

    packRows.set(sku, {
      depth: dimensions.depth,
      height: dimensions.height,
      packSku,
      ratio,
      volume: physicalVolume,
      width: dimensions.width,
    });
  });

  const orderRows = new Map<string, number>();
  orderLines.forEach((row, rowIndex) => {
    const sku = normalizeSku(row[orderSkuColumn]?.value);
    const quantity = parseNumber(getCellValue(orderLines, rowIndex, orderQuantityColumn));

    if (!sku || quantity <= 0) {
      return;
    }

    orderRows.set(sku, (orderRows.get(sku) ?? 0) + quantity);
  });

  const missingPackConfigs: MissingPackConfig[] = [];
  const skus: EstimateSku[] = [];

  orderRows.forEach((orderQuantity, sku) => {
    const packRow = packRows.get(sku);
    if (!packRow) {
      missingPackConfigs.push({ sku, orderQuantity });
      return;
    }

    const exactBoxes = orderQuantity / packRow.ratio;
    const fullBoxes = Math.floor(exactBoxes);
    const partialBoxes = Number.isInteger(exactBoxes) ? 0 : 1;
    const boxesRequired = Math.ceil(exactBoxes);
    const hasPartialBox = !Number.isInteger(exactBoxes);

    skus.push({
      sku,
      orderQuantity,
      packSku: packRow.packSku,
      ratio: packRow.ratio,
      width: packRow.width,
      depth: packRow.depth,
      height: packRow.height,
      boxVolume: packRow.volume,
      exactBoxes,
      fullBoxes,
      partialBoxes,
      boxesRequired,
      totalVolume: boxesRequired * packRow.volume,
      hasPartialBox,
    });
  });

  const { oversizedSkus, pallets } = packPallets(skus, palletType, packingMode);
  const totalVolume = pallets.reduce((total, pallet) => total + pallet.usedVolume, 0);
  const totalBoxes = skus.reduce((total, sku) => total + sku.boxesRequired, 0);
  const totalOrderQuantity = skus.reduce((total, sku) => total + sku.orderQuantity, 0);
  const totalCapacity = pallets.length * palletVolume;

  return {
    palletType,
    palletVolume,
    totalOrderQuantity,
    totalBoxes,
    totalVolume,
    utilization: totalCapacity > 0 ? Math.round((totalVolume / totalCapacity) * 100) : 0,
    skus,
    pallets,
    missingPackConfigs,
    invalidPackConfigs,
    oversizedSkus,
    partialBoxSkus: skus.filter((sku) => sku.hasPartialBox),
  };
};
