import { Bounds, ContactShadows, Environment, OrbitControls } from '@react-three/drei';
import { Canvas } from '@react-three/fiber';
import type { FitResult, Location } from '../types';
import { BoxMesh } from './BoxMesh';
import { ShelfMesh } from './ShelfMesh';

interface ThreeDViewerProps {
  location: Location | null;
  result: FitResult | null;
}

export function ThreeDViewer({ location, result }: ThreeDViewerProps) {
  return (
    <section className="flex min-h-[520px] flex-1 flex-col overflow-hidden rounded-lg border border-slate-800 bg-slate-950">
      <div className="flex items-center justify-between border-b border-slate-800 px-4 py-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-100">3D fit viewport</h2>
          <p className="text-sm text-slate-400">
            {location
              ? `${location.name} - wireframe shows total location volume`
              : 'No location selected'}
          </p>
        </div>
        <div className="rounded-md border border-slate-700 px-3 py-1 text-xs font-semibold text-cyan-200">
          Orbit enabled
        </div>
      </div>

      <div className="relative min-h-[420px] flex-1">
        {location ? (
          <>
            {result?.orientation && (
              <div className="absolute bottom-4 left-4 right-4 z-10 grid gap-2 rounded-md border border-slate-700 bg-slate-950/90 p-3 text-xs text-slate-200 shadow-xl md:grid-cols-4">
                <span className="font-semibold text-cyan-200">Placement grid</span>
                <span>Width: {result.boxesAcrossWidth} boxes</span>
                <span>Depth: {result.boxesAcrossDepth} boxes</span>
                <span>Height: {result.boxesAcrossHeight} layers</span>
              </div>
            )}
            <Canvas camera={{ position: [140, 110, 140], fov: 48 }} shadows>
              <color attach="background" args={['#020617']} />
              <ambientLight intensity={0.65} />
              <directionalLight castShadow intensity={1.8} position={[100, 180, 90]} />
              <pointLight intensity={0.5} position={[-120, 80, -120]} />
              <Bounds fit clip observe margin={1.25}>
                <group>
                  <ShelfMesh location={location} />
                  {result?.orientation &&
                    result.positions.map((box, index) => (
                      <BoxMesh
                        key={`${result.orientation?.id}-${box.id}`}
                        box={box}
                        isReferenceBox={index === result.positions.length - 1}
                        location={location}
                        orientation={result.orientation!}
                      />
                    ))}
                </group>
              </Bounds>
              <gridHelper
                args={[
                  Math.max(location.width, location.depth) * 1.4,
                  20,
                  '#334155',
                  '#1e293b',
                ]}
                position={[0, -0.02, 0]}
              />
              <ContactShadows opacity={0.25} scale={200} blur={2.5} far={80} />
              <Environment preset="warehouse" />
              <OrbitControls makeDefault enableDamping dampingFactor={0.08} />
            </Canvas>
          </>
        ) : (
          <div className="flex h-full min-h-[420px] items-center justify-center px-6 text-center text-slate-400">
            Add a shelf location to generate the 3D view.
          </div>
        )}
      </div>

    </section>
  );
}
