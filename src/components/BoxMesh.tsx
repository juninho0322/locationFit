import { Edges } from "@react-three/drei";
import type { BoxPosition, Location } from "../types";

interface BoxMeshProps {
  box: BoxPosition;
  location: Location;
}

export function BoxMesh({ box, location }: BoxMeshProps) {
  return (
    <mesh
      position={[
        box.x - location.width / 2,
        box.y,
        box.z - location.depth / 2,
      ]}
    >
      <boxGeometry args={[box.width * 0.99, box.height * 0.99, box.depth * 0.99]} />
      <meshStandardMaterial color="#facc15" roughness={0.7} />
      <Edges color="#a16207" />
    </mesh>
  );
}
