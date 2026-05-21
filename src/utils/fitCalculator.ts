import type {
  BoxDimensions,
  BoxPosition,
  DimensionKey,
  FitResult,
  Location,
  Orientation,
} from '../types';

const sourceLabel: Record<DimensionKey, string> = {
  width: 'box width',
  depth: 'box depth',
  height: 'box height',
};

const formatNumber = (value: number) =>
  Number.isInteger(value) ? String(value) : value.toFixed(2).replace(/\.?0+$/, '');

export const getBoxOrientations = (box: BoxDimensions): Orientation[] => [
  {
    id: 'width-depth-height',
    width: box.width,
    depth: box.depth,
    height: box.height,
    widthSource: 'width',
    depthSource: 'depth',
    heightSource: 'height',
  },
  {
    id: 'width-height-depth',
    width: box.width,
    depth: box.height,
    height: box.depth,
    widthSource: 'width',
    depthSource: 'height',
    heightSource: 'depth',
  },
  {
    id: 'depth-width-height',
    width: box.depth,
    depth: box.width,
    height: box.height,
    widthSource: 'depth',
    depthSource: 'width',
    heightSource: 'height',
  },
  {
    id: 'depth-height-width',
    width: box.depth,
    depth: box.height,
    height: box.width,
    widthSource: 'depth',
    depthSource: 'height',
    heightSource: 'width',
  },
  {
    id: 'height-width-depth',
    width: box.height,
    depth: box.width,
    height: box.depth,
    widthSource: 'height',
    depthSource: 'width',
    heightSource: 'depth',
  },
  {
    id: 'height-depth-width',
    width: box.height,
    depth: box.depth,
    height: box.width,
    widthSource: 'height',
    depthSource: 'depth',
    heightSource: 'width',
  },
];

export const describeOrientation = (orientation: Orientation): string =>
  `${sourceLabel[orientation.widthSource]} goes along shelf width, ` +
  `${sourceLabel[orientation.depthSource]} goes along shelf depth, ` +
  `${sourceLabel[orientation.heightSource]} goes along shelf height.`;

export const formatOrientationDimensions = (orientation: Orientation): string =>
  `${formatNumber(orientation.width)} W x ${formatNumber(orientation.depth)} D x ${formatNumber(
    orientation.height,
  )} H cm`;

export const formatMeasurement = (value: number): string => formatNumber(value);

const hasPositiveDimensions = (location: Location, box: BoxDimensions) =>
  location.width > 0 &&
  location.depth > 0 &&
  location.height > 0 &&
  box.width > 0 &&
  box.depth > 0 &&
  box.height > 0 &&
  box.quantity > 0;

const createBoxPositions = (
  location: Location,
  orientation: Orientation,
  boxesAcrossWidth: number,
  boxesAcrossDepth: number,
  boxesAcrossHeight: number,
  boxesThatFit: number,
): BoxPosition[] => {
  const positions: BoxPosition[] = [];
  const usedWidth = boxesAcrossWidth * orientation.width;
  const usedDepth = boxesAcrossDepth * orientation.depth;
  const widthOffset = (location.width - usedWidth) / 2;
  const depthOffset = (location.depth - usedDepth) / 2;

  for (let heightIndex = 0; heightIndex < boxesAcrossHeight; heightIndex += 1) {
    for (let depthIndex = 0; depthIndex < boxesAcrossDepth; depthIndex += 1) {
      for (let widthIndex = 0; widthIndex < boxesAcrossWidth; widthIndex += 1) {
        if (positions.length >= boxesThatFit) {
          return positions;
        }

        positions.push({
          id: `box-${positions.length + 1}`,
          x: widthOffset + widthIndex * orientation.width + orientation.width / 2,
          y: heightIndex * orientation.height + orientation.height / 2,
          z: depthOffset + depthIndex * orientation.depth + orientation.depth / 2,
          width: orientation.width,
          depth: orientation.depth,
          height: orientation.height,
        });
      }
    }
  }

  return positions;
};

export const calculateBestFit = (
  location: Location,
  box: BoxDimensions,
): FitResult => {
  const emptyResult: FitResult = {
    fits: false,
    message: 'This box does not fit in this location.',
    orientation: null,
    boxesAcrossWidth: 0,
    boxesAcrossDepth: 0,
    boxesAcrossHeight: 0,
    totalCapacity: 0,
    requestedQuantity: box.quantity,
    boxesThatFit: 0,
    leftoverBoxes: Math.max(0, box.quantity),
    totalUnits: 0,
    locationVolume: location.width * location.depth * location.height,
    usedVolume: 0,
    volumeUtilization: 0,
    usedWidth: 0,
    usedDepth: 0,
    usedHeight: 0,
    positions: [],
  };

  if (!hasPositiveDimensions(location, box)) {
    return emptyResult;
  }

  const bestFit = getBoxOrientations(box)
    .map((orientation) => {
      const boxesAcrossWidth = Math.floor(location.width / orientation.width);
      const boxesAcrossDepth = Math.floor(location.depth / orientation.depth);
      const boxesAcrossHeight = Math.floor(location.height / orientation.height);
      const totalCapacity =
        boxesAcrossWidth * boxesAcrossDepth * boxesAcrossHeight;
      const usedVolume =
        boxesAcrossWidth *
        orientation.width *
        boxesAcrossDepth *
        orientation.depth *
        boxesAcrossHeight *
        orientation.height;

      return {
        orientation,
        boxesAcrossWidth,
        boxesAcrossDepth,
        boxesAcrossHeight,
        totalCapacity,
        usedVolume,
      };
    })
    .sort(
      (a, b) =>
        b.totalCapacity - a.totalCapacity ||
        b.usedVolume - a.usedVolume ||
        a.orientation.id.localeCompare(b.orientation.id),
    )[0];

  if (!bestFit || bestFit.totalCapacity <= 0) {
    return emptyResult;
  }

  const boxesThatFit = bestFit.totalCapacity;
  const leftoverBoxes = Math.max(0, box.quantity - bestFit.totalCapacity);
  const locationVolume = location.width * location.depth * location.height;
  const usedWidth = bestFit.boxesAcrossWidth * bestFit.orientation.width;
  const usedDepth = bestFit.boxesAcrossDepth * bestFit.orientation.depth;
  const usedHeight = bestFit.boxesAcrossHeight * bestFit.orientation.height;
  const usedVolume = usedWidth * usedDepth * usedHeight;

  return {
    fits: true,
    message: 'This box fits in this location.',
    orientation: bestFit.orientation,
    boxesAcrossWidth: bestFit.boxesAcrossWidth,
    boxesAcrossDepth: bestFit.boxesAcrossDepth,
    boxesAcrossHeight: bestFit.boxesAcrossHeight,
    totalCapacity: bestFit.totalCapacity,
    requestedQuantity: box.quantity,
    boxesThatFit,
    leftoverBoxes,
    totalUnits: boxesThatFit * box.quantity,
    locationVolume,
    usedVolume,
    volumeUtilization: Math.round((usedVolume / locationVolume) * 100),
    usedWidth,
    usedDepth,
    usedHeight,
    positions: createBoxPositions(
      location,
      bestFit.orientation,
      bestFit.boxesAcrossWidth,
      bestFit.boxesAcrossDepth,
      bestFit.boxesAcrossHeight,
      bestFit.totalCapacity,
    ),
  };
};
