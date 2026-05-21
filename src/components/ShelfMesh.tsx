import { Edges, Line, Text } from '@react-three/drei';
import type { Location } from '../types';
import { formatMeasurement } from '../utils/fitCalculator';

interface ShelfMeshProps {
  location: Location;
}

export function ShelfMesh({ location }: ShelfMeshProps) {
  const { width, depth, height } = location;
  const largestDimension = Math.max(width, depth, height);
  const labelSize = Math.max(2.5, largestDimension * 0.024);
  const lineOffset = Math.max(2.5, largestDimension * 0.025);

  return (
    <group>
      <mesh position={[0, -0.03, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[width, depth]} />
        <meshStandardMaterial color="#0f766e" transparent opacity={0.22} />
      </mesh>
      <mesh position={[0, height / 2, -depth / 2 - 0.04]}>
        <planeGeometry args={[width, height]} />
        <meshStandardMaterial color="#0f172a" transparent opacity={0.32} />
      </mesh>
      <mesh position={[-width / 2 - 0.04, height / 2, 0]} rotation={[0, Math.PI / 2, 0]}>
        <planeGeometry args={[depth, height]} />
        <meshStandardMaterial color="#0f172a" transparent opacity={0.22} />
      </mesh>
      <mesh position={[0, height / 2, 0]}>
        <boxGeometry args={[width, height, depth]} />
        <meshStandardMaterial color="#67e8f9" transparent opacity={0.03} />
        <Edges color="#67e8f9" />
      </mesh>

      <Line
        color="#67e8f9"
        lineWidth={1.5}
        points={[
          [-width / 2, height + lineOffset, depth / 2 + lineOffset],
          [width / 2, height + lineOffset, depth / 2 + lineOffset],
        ]}
      />
      <Text
        color="#cffafe"
        fontSize={labelSize}
        outlineColor="#020617"
        outlineWidth={labelSize * 0.035}
        position={[0, height + lineOffset * 1.18, depth / 2 + lineOffset]}
      >
        {`Width - ${formatMeasurement(width)} cm`}
      </Text>

      <Line
        color="#fbbf24"
        lineWidth={1.5}
        points={[
          [width / 2 + lineOffset, height + lineOffset, -depth / 2],
          [width / 2 + lineOffset, height + lineOffset, depth / 2],
        ]}
      />
      <Text
        color="#fde68a"
        fontSize={labelSize}
        outlineColor="#020617"
        outlineWidth={labelSize * 0.035}
        position={[width / 2 + lineOffset * 1.2, height + lineOffset * 1.18, 0]}
        rotation={[0, Math.PI / 2, 0]}
      >
        {`Depth - ${formatMeasurement(depth)} cm`}
      </Text>

      <Line
        color="#34d399"
        lineWidth={1.5}
        points={[
          [-width / 2 - lineOffset, 0, depth / 2 + lineOffset],
          [-width / 2 - lineOffset, height, depth / 2 + lineOffset],
        ]}
      />
      <Text
        color="#bbf7d0"
        fontSize={labelSize}
        outlineColor="#020617"
        outlineWidth={labelSize * 0.035}
        position={[-width / 2 - lineOffset * 1.25, height / 2, depth / 2 + lineOffset]}
        rotation={[0, -Math.PI / 2, Math.PI / 2]}
      >
        {`Height - ${formatMeasurement(height)} cm`}
      </Text>
    </group>
  );
}
