import { MathUtils, Vector3 } from "three";

export interface ViewBounds {
  center: [number, number, number];
  size: [number, number, number];
}

// Fit every corner in camera space, including narrow/mobile viewports.
export function frameVolume(
  bounds: ViewBounds,
  aspect: number,
  fov = 46,
  margin = 1.18,
) {
  const direction = new Vector3(1, 0.75, 1.2).normalize();
  const right = new Vector3()
    .crossVectors(new Vector3(0, 1, 0), direction)
    .normalize();
  const up = new Vector3().crossVectors(direction, right).normalize();
  const tanVertical = Math.tan(MathUtils.degToRad(fov / 2));
  const tanHorizontal = tanVertical * Math.max(aspect, 0.01);
  let distance = 0;
  for (const x of [-1, 1])
    for (const y of [-1, 1])
      for (const z of [-1, 1]) {
        const corner = new Vector3(
          (x * bounds.size[0]) / 2,
          (y * bounds.size[1]) / 2,
          (z * bounds.size[2]) / 2,
        );
        const towardsCamera = corner.dot(direction);
        distance = Math.max(
          distance,
          towardsCamera +
            (Math.abs(corner.dot(right)) * margin) / tanHorizontal,
          towardsCamera + (Math.abs(corner.dot(up)) * margin) / tanVertical,
        );
      }
  const scale = Math.max(...bounds.size, 0.01);
  distance = Math.max(distance, scale);
  return {
    target: new Vector3(...bounds.center),
    position: new Vector3(...bounds.center).addScaledVector(
      direction,
      distance,
    ),
    near: scale / 1000,
    far: distance + scale * 20,
    maxDistance: distance * 8,
  };
}

export function loadingLayout(
  count: number,
  width: number,
  depth: number,
  height: number,
  supportHeight = 4,
  padding = 0,
) {
  const columns = Math.max(1, Math.ceil(Math.sqrt(count)));
  const rows = Math.max(1, Math.ceil(count / columns));
  const gap = Math.max(width, depth) * 0.38;
  const positions = Array.from(
    { length: count },
    (_, index): [number, number, number] => [
      ((index % columns) - (columns - 1) / 2) * (width + gap),
      0,
      (Math.floor(index / columns) - (rows - 1) / 2) * (depth + gap),
    ],
  );
  const bounds: ViewBounds = {
    center: [0, (height + padding - supportHeight) / 2, 0],
    size: [
      columns * width + (columns - 1) * gap + 2 * padding,
      height + supportHeight + padding,
      rows * depth + (rows - 1) * gap + 2 * padding,
    ],
  };
  return { positions, bounds };
}
