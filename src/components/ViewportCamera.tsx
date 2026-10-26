import { useLayoutEffect, useRef, type ComponentRef } from "react";
import { OrbitControls } from "@react-three/drei";
import { useThree } from "@react-three/fiber";
import { PerspectiveCamera } from "three";
import { frameVolume, type ViewBounds } from "../utils/viewport";

export function ViewportCamera({
  bounds,
  resetKey,
}: {
  bounds: ViewBounds;
  resetKey: string;
}) {
  const controls = useRef<ComponentRef<typeof OrbitControls>>(null);
  const { camera, size, invalidate } = useThree();
  const [cx, cy, cz] = bounds.center;
  const [sx, sy, sz] = bounds.size;
  useLayoutEffect(() => {
    if (!(camera instanceof PerspectiveCamera) || !size.width || !size.height)
      return;
    const fitted = frameVolume(
      { center: [cx, cy, cz], size: [sx, sy, sz] },
      size.width / size.height,
      camera.fov,
    );
    // Clear any in-flight damping before applying a new camera and orbit target.
    if (controls.current) {
      controls.current.enableDamping = false;
      controls.current.update();
      controls.current.reset();
      controls.current.enableDamping = true;
    }
    camera.position.copy(fitted.position);
    camera.near = fitted.near;
    camera.far = fitted.far;
    camera.aspect = size.width / size.height;
    camera.lookAt(fitted.target);
    camera.updateProjectionMatrix();
    if (controls.current) {
      controls.current.target.copy(fitted.target);
      controls.current.minDistance = Math.max(...[sx, sy, sz]) / 20;
      controls.current.maxDistance = fitted.maxDistance;
      controls.current.update();
      controls.current.saveState();
    }
    invalidate();
  }, [
    camera,
    size.width,
    size.height,
    cx,
    cy,
    cz,
    sx,
    sy,
    sz,
    resetKey,
    invalidate,
  ]);
  return (
    <OrbitControls
      ref={controls}
      makeDefault
      enableDamping
      dampingFactor={0.08}
    />
  );
}
