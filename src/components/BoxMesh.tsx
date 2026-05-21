import { Edges, Text } from '@react-three/drei';
import { useMemo } from 'react';
import type { BoxPosition, Location, Orientation } from '../types';

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
  const labelSize = Math.max(2.8, Math.min(box.width, box.depth, box.height) * 0.18);
  const faceOffset = 0.08;

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
          <Text
            color="#020617"
            fontSize={labelSize}
            maxWidth={box.width * 0.9}
            outlineColor="#fef3c7"
            outlineWidth={labelSize * 0.035}
            position={[0, box.height / 2 + faceOffset, box.depth / 2 + faceOffset]}
          >
            {`W - ${orientation.width} cm`}
          </Text>
          <Text
            color="#020617"
            fontSize={labelSize}
            maxWidth={box.depth * 0.9}
            outlineColor="#fef3c7"
            outlineWidth={labelSize * 0.035}
            position={[0, box.height / 2 + faceOffset, 0]}
            rotation={[-Math.PI / 2, 0, 0]}
          >
            {`D - ${orientation.depth} cm`}
          </Text>
          <Text
            color="#020617"
            fontSize={labelSize}
            maxWidth={box.height * 0.9}
            outlineColor="#fef3c7"
            outlineWidth={labelSize * 0.035}
            position={[box.width / 2 + faceOffset, 0, 0]}
            rotation={[0, Math.PI / 2, 0]}
          >
            {`H - ${orientation.height} cm`}
          </Text>
        </>
      )}
    </group>
  );
}
