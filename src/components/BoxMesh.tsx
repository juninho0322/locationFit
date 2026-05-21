import { Billboard, Edges, Line, Text } from '@react-three/drei';
import { useMemo } from 'react';
import type { BoxPosition, Location, Orientation } from '../types';
import { formatMeasurement, getDimensionShortLabel } from '../utils/fitCalculator';

interface BoxMeshProps {
  box: BoxPosition;
  isReferenceBox?: boolean;
  location: Location;
  orientation: Orientation;
}

interface StickerLabelProps {
  color: string;
  label: string;
  labelSize: number;
  position: [number, number, number];
}

function StickerLabel({
  color,
  label,
  labelSize,
  position,
}: StickerLabelProps) {
  const width = Math.max(labelSize * 5.6, label.length * labelSize * 0.48);
  const height = labelSize * 1.55;

  return (
    <Billboard position={position}>
      <mesh position={[0, 0, -0.04]}>
        <planeGeometry args={[width, height]} />
        <meshBasicMaterial color="#020617" transparent opacity={0.9} />
      </mesh>
      <Line
        color={color}
        lineWidth={2}
        points={[
          [-width / 2, -height / 2, 0],
          [width / 2, -height / 2, 0],
          [width / 2, height / 2, 0],
          [-width / 2, height / 2, 0],
          [-width / 2, -height / 2, 0],
        ]}
      />
      <Text
        color={color}
        fontSize={labelSize}
        outlineColor="#020617"
        outlineWidth={labelSize * 0.045}
        position={[0, 0, 0.03]}
      >
        {label}
      </Text>
    </Billboard>
  );
}

export function BoxMesh({
  box,
  isReferenceBox = false,
  location,
  orientation,
}: BoxMeshProps) {
  const targetPosition = useMemo(
    () =>
      [
        box.x - location.width / 2,
        box.y,
        box.z - location.depth / 2,
      ] as const,
    [box.x, box.y, box.z, location.depth, location.width],
  );
  const labelSize = Math.max(4, Math.min(box.width, box.depth, box.height) * 0.22);
  const lineLift = Math.max(0.1, labelSize * 0.03);
  const stickerOffset = labelSize * 1.25;
  const widthLabel = `${getDimensionShortLabel(orientation.widthSource)} - ${formatMeasurement(
    orientation.width,
  )} cm`;
  const depthLabel = `${getDimensionShortLabel(orientation.depthSource)} - ${formatMeasurement(
    orientation.depth,
  )} cm`;
  const heightLabel = `${getDimensionShortLabel(orientation.heightSource)} - ${formatMeasurement(
    orientation.height,
  )} cm`;

  return (
    <group position={[targetPosition[0], targetPosition[1], targetPosition[2]]}>
      <mesh>
        <boxGeometry args={[box.width * 0.99, box.height * 0.99, box.depth * 0.99]} />
        <meshStandardMaterial
          color="#facc15"
          roughness={0.7}
        />
        <Edges color="#a16207" />
      </mesh>
      {isReferenceBox && (
        <>
          <Line
            color="#22d3ee"
            lineWidth={4}
            points={[
              [-box.width / 2, box.height / 2 + lineLift, box.depth / 2 + lineLift],
              [box.width / 2, box.height / 2 + lineLift, box.depth / 2 + lineLift],
            ]}
          />
          <StickerLabel
            color="#22d3ee"
            label={widthLabel}
            labelSize={labelSize}
            position={[0, box.height / 2 + stickerOffset, box.depth / 2 + stickerOffset]}
          />

          <Line
            color="#f59e0b"
            lineWidth={4}
            points={[
              [box.width / 2 + lineLift, box.height / 2 + lineLift, -box.depth / 2],
              [box.width / 2 + lineLift, box.height / 2 + lineLift, box.depth / 2],
            ]}
          />
          <StickerLabel
            color="#f59e0b"
            label={depthLabel}
            labelSize={labelSize}
            position={[box.width / 2 + stickerOffset, box.height / 2 + stickerOffset, 0]}
          />

          <Line
            color="#34d399"
            lineWidth={4}
            points={[
              [box.width / 2 + lineLift, -box.height / 2, box.depth / 2 + lineLift],
              [box.width / 2 + lineLift, box.height / 2, box.depth / 2 + lineLift],
            ]}
          />
          <StickerLabel
            color="#34d399"
            label={heightLabel}
            labelSize={labelSize}
            position={[box.width / 2 + stickerOffset, 0, box.depth / 2 + stickerOffset]}
          />
        </>
      )}
    </group>
  );
}
