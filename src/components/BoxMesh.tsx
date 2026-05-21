import { Billboard, Edges, Line, Text } from '@react-three/drei';
import { useMemo } from 'react';
import type { BoxPosition, Location, Orientation } from '../types';
import { formatMeasurement } from '../utils/fitCalculator';

interface BoxMeshProps {
  box: BoxPosition;
  isReferenceBox?: boolean;
  location: Location;
  orientation: Orientation;
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
  const labelSize = Math.max(2.8, Math.min(box.width, box.depth, box.height) * 0.2);
  const lineOffset = labelSize * 0.75;
  const widthLabel = `W - ${formatMeasurement(orientation.width)} cm`;
  const depthLabel = `D - ${formatMeasurement(orientation.depth)} cm`;
  const heightLabel = `H - ${formatMeasurement(orientation.height)} cm`;

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
            lineWidth={2}
            points={[
              [-box.width / 2, box.height / 2 + lineOffset, box.depth / 2 + lineOffset],
              [box.width / 2, box.height / 2 + lineOffset, box.depth / 2 + lineOffset],
            ]}
          />
          <Billboard position={[0, box.height / 2 + lineOffset * 1.35, box.depth / 2 + lineOffset]}>
            <Text
              color="#cffafe"
              fontSize={labelSize}
              outlineColor="#020617"
              outlineWidth={labelSize * 0.045}
            >
              {widthLabel}
            </Text>
          </Billboard>

          <Line
            color="#f59e0b"
            lineWidth={2}
            points={[
              [box.width / 2 + lineOffset, box.height / 2 + lineOffset, -box.depth / 2],
              [box.width / 2 + lineOffset, box.height / 2 + lineOffset, box.depth / 2],
            ]}
          />
          <Billboard position={[box.width / 2 + lineOffset * 1.3, box.height / 2 + lineOffset * 1.35, 0]}>
            <Text
              color="#fde68a"
              fontSize={labelSize}
              outlineColor="#020617"
              outlineWidth={labelSize * 0.045}
            >
              {depthLabel}
            </Text>
          </Billboard>

          <Line
            color="#34d399"
            lineWidth={2}
            points={[
              [box.width / 2 + lineOffset, -box.height / 2, box.depth / 2 + lineOffset],
              [box.width / 2 + lineOffset, box.height / 2, box.depth / 2 + lineOffset],
            ]}
          />
          <Billboard position={[box.width / 2 + lineOffset * 1.45, 0, box.depth / 2 + lineOffset * 1.2]}>
            <Text
              color="#bbf7d0"
              fontSize={labelSize}
              outlineColor="#020617"
              outlineWidth={labelSize * 0.045}
            >
              {heightLabel}
            </Text>
          </Billboard>
        </>
      )}
    </group>
  );
}
