import { Edges } from "@react-three/drei";
import type { LocationKind } from "../types";
import { getVolumeStructure } from "../utils/volumeStructure";

export function VolumeStructure({
  kind,
  width,
  depth,
  height,
}: {
  kind: LocationKind;
  width: number;
  depth: number;
  height: number;
}) {
  const structure = getVolumeStructure(kind, width, depth, height);
  return (
    <group name={`${kind}-structure`}>
      {structure.parts.map((part) => (
        <mesh
          key={part.id}
          name={part.id}
          position={part.position}
          castShadow
          receiveShadow
        >
          <boxGeometry args={part.size} />
          <meshStandardMaterial
            color={part.color}
            metalness={part.material === "metal" ? 0.55 : 0.05}
            roughness={part.material === "wood" ? 0.85 : 0.45}
          />
          {part.material === "wood" && <Edges color="#725331" />}
        </mesh>
      ))}
      {structure.wheels.map((wheel) => (
        <group
          key={wheel.id}
          name={`caster-${wheel.id}`}
          position={wheel.position}
          rotation={[0, 0, Math.PI / 2]}
        >
          <mesh castShadow>
            <cylinderGeometry
              args={[wheel.radius, wheel.radius, wheel.width, 24]}
            />
            <meshStandardMaterial color="#171f29" roughness={0.88} />
          </mesh>
          <mesh>
            <cylinderGeometry
              args={[
                wheel.radius * 0.48,
                wheel.radius * 0.48,
                wheel.width * 1.08,
                20,
              ]}
            />
            <meshStandardMaterial
              color="#adc0cc"
              metalness={0.7}
              roughness={0.32}
            />
          </mesh>
          <mesh>
            <cylinderGeometry
              args={[
                wheel.radius * 0.14,
                wheel.radius * 0.14,
                wheel.width * 1.45,
                12,
              ]}
            />
            <meshStandardMaterial
              color="#455b6b"
              metalness={0.7}
              roughness={0.35}
            />
          </mesh>
        </group>
      ))}
    </group>
  );
}
