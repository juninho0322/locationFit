import { Edges } from '@react-three/drei';
import type { Location } from '../types';

interface ShelfMeshProps {
  location: Location;
}

export function ShelfMesh({ location }: ShelfMeshProps) {
  const { width, depth, height } = location;

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
    </group>
  );
}
