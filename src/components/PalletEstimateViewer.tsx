import { ContactShadows, Edges } from "@react-three/drei";
import { ViewportCamera } from "./ViewportCamera";
import { VolumeStructure } from "./VolumeStructure";
import { getVolumeStructure } from "../utils/volumeStructure";
import type { LocationKind } from "../types";
import { loadingLayout } from "../utils/viewport";
import { Canvas } from "@react-three/fiber";
import { useMemo, useState } from "react";
import type {
  PackedBox,
  PackedPallet,
  PalletType,
  VolumeUnit,
} from "../types/packing";

interface PalletEstimateViewerProps {
  mode: "all" | "single";
  pallets: PackedPallet[];
  palletType: PalletType;
  selectedPalletIndex: number;
  volumeUnit: VolumeUnit;
  locationLabel?: string;
}

interface PackedBoxMeshProps {
  box: PackedBox;
  palletType: PalletType;
}

interface PalletMeshProps {
  kind: LocationKind;
  isFocused: boolean;
  onOpenDetails: (pallet: PackedPallet) => void;
  pallet: PackedPallet;
  palletType: PalletType;
  position: [number, number, number];
}

const formatNumber = (value: number) =>
  Number.isInteger(value)
    ? String(value)
    : value.toFixed(2).replace(/\.?0+$/, "");

const formatVolume = (value: number, unit: VolumeUnit) => {
  if (unit === "m3") {
    return `${formatNumber(value / 1_000_000)} m3`;
  }

  if (unit === "litres") {
    return `${formatNumber(value / 1000)} L`;
  }

  return `${formatNumber(value)} cm3`;
};

const getPalletUtilization = (pallet: PackedPallet, palletType: PalletType) =>
  Math.round(
    (pallet.usedVolume /
      (palletType.width * palletType.depth * palletType.height)) *
      100,
  );

function PackedBoxMesh({ box, palletType }: PackedBoxMeshProps) {
  return (
    <mesh
      position={[
        box.x - palletType.width / 2,
        box.y,
        box.z - palletType.depth / 2,
      ]}
    >
      <boxGeometry
        args={[box.width * 0.96, box.height * 0.96, box.depth * 0.96]}
      />
      <meshStandardMaterial
        color={box.isPartial ? "#fb7185" : "#facc15"}
        roughness={0.72}
      />
      <Edges color={box.isPartial ? "#be123c" : "#a16207"} />
    </mesh>
  );
}

function PalletMesh({
  kind,
  isFocused,
  onOpenDetails,
  pallet,
  palletType,
  position,
}: PalletMeshProps) {
  const fillHeight = Math.max(
    0.5,
    Math.min(
      palletType.height,
      pallet.usedVolume / (palletType.width * palletType.depth),
    ),
  );

  return (
    <group
      position={position}
      onContextMenu={(event) => {
        event.nativeEvent.preventDefault();
        event.stopPropagation();
        onOpenDetails(pallet);
      }}
    >
      <mesh position={[0, palletType.height / 2, 0]}>
        <boxGeometry
          args={[palletType.width, palletType.height, palletType.depth]}
        />
        <meshStandardMaterial
          color="#67e8f9"
          transparent
          depthWrite={false}
          opacity={0.035}
        />
        <Edges color={isFocused ? "#22d3ee" : "#67e8f9"} />
      </mesh>

      {pallet.boxes.map((box) => (
        <PackedBoxMesh key={box.id} box={box} palletType={palletType} />
      ))}

      <VolumeStructure
        kind={kind}
        width={palletType.width}
        depth={palletType.depth}
        height={palletType.height}
      />

      {pallet.boxes.length === 0 && pallet.usedVolume > 0 && (
        <mesh position={[0, fillHeight / 2, 0]}>
          <boxGeometry
            args={[
              palletType.width * 0.92,
              fillHeight,
              palletType.depth * 0.92,
            ]}
          />
          <meshStandardMaterial
            color={isFocused ? "#22d3ee" : "#14b8a6"}
            transparent
            opacity={0.72}
          />
          <Edges color="#0f766e" />
        </mesh>
      )}
    </group>
  );
}

export function PalletEstimateViewer({
  mode,
  pallets,
  palletType,
  selectedPalletIndex,
  volumeUnit,
  locationLabel = "Pallet",
}: PalletEstimateViewerProps) {
  const [reset, setReset] = useState(0);
  const [detailsPallet, setDetailsPallet] = useState<PackedPallet | null>(null);
  const visiblePallets =
    mode === "single"
      ? pallets.slice(selectedPalletIndex, selectedPalletIndex + 1)
      : pallets;
  const activePallet =
    mode === "single"
      ? (visiblePallets[0] ?? null)
      : (pallets[selectedPalletIndex] ?? pallets[0] ?? null);
  const kind =
    palletType.locationKind ?? (locationLabel === "Cage" ? "cage" : "pallet");
  const structure = getVolumeStructure(
    kind,
    palletType.width,
    palletType.depth,
    palletType.height,
  );
  const layout = useMemo(
    () =>
      loadingLayout(
        visiblePallets.length,
        palletType.width,
        palletType.depth,
        palletType.height,
        structure.supportHeight,
        structure.padding,
      ),
    [
      visiblePallets.length,
      palletType.width,
      palletType.depth,
      palletType.height,
      structure.supportHeight,
      structure.padding,
    ],
  );

  return (
    <section
      className="viewport-panel"
      onContextMenu={(event) => event.preventDefault()}
    >
      <div className="viewport-header">
        <div>
          <h2 className="text-lg font-semibold text-slate-100">
            3D loading plan
          </h2>
          <span className="volume-type-badge">
            {palletType.displayLabel ?? locationLabel}
          </span>
          <p className="text-sm text-slate-400">
            {pallets.length > 0
              ? `${pallets.length} ${locationLabel.toLowerCase()}s with actual case dimensions`
              : "Add order lines and calculate your loading plan"}
          </p>
        </div>
        <div className="row-actions">
          <button
            className="button small secondary"
            disabled={!visiblePallets.length}
            onClick={() => setReset((value) => value + 1)}
          >
            Fit view
          </button>
          <button
            className="rounded-md border border-slate-700 px-3 py-2 text-xs font-semibold text-cyan-200 disabled:opacity-40"
            disabled={!activePallet}
            onClick={() => setDetailsPallet(activePallet)}
          >
            View contents
          </button>
        </div>
      </div>

      <div className="viewport-stage">
        {visiblePallets.length > 0 ? (
          <>
            {activePallet && (
              <div className="pointer-events-none absolute left-1/2 top-4 z-10 -translate-x-1/2 rounded-md border border-cyan-400/40 bg-slate-950/75 px-4 py-2 text-sm font-semibold text-cyan-100 shadow-lg backdrop-blur-sm">
                {`${locationLabel} ${activePallet.index} - ${getPalletUtilization(activePallet, palletType)}%`}
              </div>
            )}

            {detailsPallet && (
              <div
                className="absolute inset-0 z-10 flex items-center justify-center bg-slate-950/25 px-4 py-4"
                role="presentation"
                onClick={() => setDetailsPallet(null)}
                onContextMenu={(event) => {
                  event.preventDefault();
                  setDetailsPallet(null);
                }}
              >
                <div
                  className="max-h-[calc(100%-2rem)] w-full max-w-md overflow-hidden rounded-lg border border-slate-700 bg-slate-950/95 text-sm shadow-xl"
                  role="dialog"
                  aria-modal="true"
                  aria-labelledby="pallet-details-title"
                  onClick={(event) => event.stopPropagation()}
                  onContextMenu={(event) => event.stopPropagation()}
                >
                  <div className="flex items-center justify-between gap-4 border-b border-slate-800 px-4 py-3">
                    <h3
                      id="pallet-details-title"
                      className="font-semibold text-cyan-100"
                    >
                      {locationLabel} {detailsPallet.index}
                    </h3>
                    <button
                      className="rounded-md border border-slate-700 px-2 py-1 text-xs font-semibold text-slate-300 transition hover:border-cyan-400/60 hover:text-cyan-100"
                      type="button"
                      onClick={() => setDetailsPallet(null)}
                    >
                      Close
                    </button>
                  </div>
                  <div className="px-4 py-3">
                    <span className="text-xs text-slate-400">
                      {formatVolume(detailsPallet.usedVolume, volumeUnit)}
                    </span>
                    <div className="mt-3 max-h-80 overflow-auto">
                      {detailsPallet.lines.map((line) => (
                        <div
                          key={`${detailsPallet.id}-${line.sku}`}
                          className="border-b border-slate-800 py-2 last:border-b-0"
                        >
                          <div className="flex justify-between gap-4">
                            <span className="font-semibold text-slate-100">
                              {line.sku}
                            </span>
                            <span className="text-slate-300">
                              {line.boxes} boxes
                              {line.partialBoxes > 0
                                ? ` (${line.partialBoxes} partial)`
                                : ""}
                            </span>
                          </div>
                          <div className="mt-1 flex justify-between gap-4 text-xs text-slate-500">
                            <span>
                              {formatNumber(line.width)} x{" "}
                              {formatNumber(line.depth)} x{" "}
                              {formatNumber(line.height)} cm
                            </span>
                            <span>
                              {formatVolume(line.boxVolume, volumeUnit)} / box
                            </span>
                          </div>
                          <div className="mt-1 text-right text-xs text-slate-500">
                            <span>
                              {formatVolume(line.volume, volumeUnit)} total
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}

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
                {visiblePallets.map((pallet, index) => (
                  <PalletMesh
                    kind={kind}
                    key={pallet.id}
                    isFocused={
                      mode === "single" ||
                      pallet.index === selectedPalletIndex + 1
                    }
                    onOpenDetails={setDetailsPallet}
                    pallet={pallet}
                    palletType={palletType}
                    position={layout.positions[index]}
                  />
                ))}
              </group>

              <gridHelper
                position={[0, -structure.supportHeight - 0.04, 0]}
                args={[
                  Math.max(layout.bounds.size[0], layout.bounds.size[2]) * 1.5,
                  24,
                  "#334155",
                  "#1e293b",
                ]}
              />
              <ContactShadows
                position={[0, -structure.supportHeight - 0.03, 0]}
                opacity={0.3}
                scale={
                  Math.max(layout.bounds.size[0], layout.bounds.size[2]) * 1.5
                }
                blur={2.5}
                far={Math.max(palletType.height, 20)}
              />
              <ViewportCamera
                bounds={layout.bounds}
                resetKey={`${mode}-${selectedPalletIndex}-${palletType.id}-${kind}-${reset}`}
              />
            </Canvas>
          </>
        ) : (
          <div className="viewport-empty">
            Your 3D plan will appear here after calculating.
          </div>
        )}
      </div>
      <div className="viewport-footer">
        <span>Drag to rotate · Scroll to zoom</span>
        <span>Yellow: full boxes · Pink: partial boxes</span>
      </div>
    </section>
  );
}
