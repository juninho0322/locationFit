import { ContactShadows } from "@react-three/drei";
import { useState } from "react";
import { ViewportCamera } from "./ViewportCamera";
import { Canvas } from "@react-three/fiber";
import type { FitResult, Location } from "../types";
import { BoxMesh } from "./BoxMesh";
import { getLocationKind, locationDisplayLabel } from "../utils/locations";
import { getVolumeStructure } from "../utils/volumeStructure";
import { ShelfMesh } from "./ShelfMesh";

interface ThreeDViewerProps {
  location: Location | null;
  result: FitResult | null;
  previewLabel?: string;
}

export function ThreeDViewer({
  location,
  result,
  previewLabel,
}: ThreeDViewerProps) {
  const [reset, setReset] = useState(0);
  const structure = location
    ? getVolumeStructure(
        getLocationKind(location),
        location.width,
        location.depth,
        location.height,
      )
    : null;
  return (
    <section className="viewport-panel">
      <div className="viewport-header">
        <div>
          <h2 className="text-lg font-semibold text-slate-100">
            {previewLabel || "3D fit viewport"}
          </h2>
          {location && (
            <span className="volume-type-badge">
              {locationDisplayLabel(location)}
            </span>
          )}
          <p className="text-sm text-slate-400">
            {location
              ? `${location.name} · wireframe shows usable space`
              : "No location selected"}
          </p>
        </div>
        <button
          className="button small secondary"
          disabled={!location}
          onClick={() => setReset((value) => value + 1)}
        >
          Fit view
        </button>
      </div>

      <div className="viewport-stage">
        {location ? (
          <>
            <Canvas
              className="viewport-canvas"
              style={{ position: "absolute", inset: 0 }}
              camera={{ fov: 46 }}
              shadows
            >
              <color attach="background" args={["#020617"]} />
              <ambientLight intensity={0.65} />
              <directionalLight
                castShadow
                intensity={1.8}
                position={[100, 180, 90]}
              />
              <pointLight intensity={0.5} position={[-120, 80, -120]} />

              <group>
                <ShelfMesh location={location} />
                {result?.orientation &&
                  result.positions.map((box) => (
                    <BoxMesh
                      key={`${result.orientation?.id}-${box.id}`}
                      box={box}
                      location={location}
                    />
                  ))}
              </group>

              <gridHelper
                args={[
                  Math.max(location.width, location.depth) * 1.4,
                  20,
                  "#334155",
                  "#1e293b",
                ]}
                position={[0, -(structure?.supportHeight ?? 0) - 0.04, 0]}
              />
              <ContactShadows
                position={[0, -(structure?.supportHeight ?? 0) - 0.03, 0]}
                opacity={0.3}
                scale={Math.max(location.width, location.depth) * 1.7}
                blur={2.5}
                far={Math.max(location.height, 20)}
              />
              <ViewportCamera
                bounds={{
                  center: structure!.bounds.center,
                  size: [
                    structure!.bounds.size[0] * 1.2,
                    structure!.bounds.size[1] * 1.2,
                    structure!.bounds.size[2] * 1.2,
                  ],
                }}
                resetKey={`${location.id}-${getLocationKind(location)}-${reset}`}
              />
            </Canvas>
          </>
        ) : (
          <div className="viewport-empty">
            Create a location to explore your space in 3D.
          </div>
        )}
      </div>
      <div className="viewport-footer">
        <span>Drag to rotate · Scroll to zoom</span>
        {location && getLocationKind(location) !== "pick-face" && (
          <span>
            {getLocationKind(location) === "pallet"
              ? "Pallet base sits below usable height"
              : "Base and wheels sit below usable height"}
          </span>
        )}
        {result?.orientation && (
          <span>
            Grid: {result.boxesAcrossWidth} wide × {result.boxesAcrossDepth}{" "}
            deep × {result.boxesAcrossHeight} layers
          </span>
        )}
      </div>
    </section>
  );
}
