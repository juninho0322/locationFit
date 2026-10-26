import type { LocationKind } from "../types";
import type { ViewBounds } from "./viewport";

type Triple = [number, number, number];
export interface StructurePart {
  id: string;
  position: Triple;
  size: Triple;
  material: "wood" | "metal" | "shelf";
  color: string;
}
export interface Caster {
  id: string;
  position: Triple;
  radius: number;
  width: number;
}

/** Decorative structure sits below/outside the usable packing volume (floor y=0). */
export function getVolumeStructure(
  kind: LocationKind,
  width: number,
  depth: number,
  height: number,
) {
  const short = Math.min(width, depth);
  const parts: StructurePart[] = [];
  const wheels: Caster[] = [];
  const add = (
    id: string,
    position: Triple,
    size: Triple,
    material: StructurePart["material"],
    color: string,
  ) => parts.push({ id, position, size, material, color });
  let supportHeight: number;
  let padding = 0;
  if (kind === "pallet") {
    supportHeight = short * 0.14;
    const plank = supportHeight * 0.16;
    for (let index = 0; index < 7; index++) {
      add(
        `deck-${index}`,
        [0, -plank / 2, (-0.43 + (index * 0.86) / 6) * depth],
        [width, plank, depth * 0.12],
        "wood",
        index % 2 ? "#b78b56" : "#c79b63",
      );
    }
    for (const [xi, x] of [-0.38, 0, 0.38].entries()) {
      add(
        `runner-${xi}`,
        [x * width, -supportHeight + plank / 2, 0],
        [width * 0.2, plank, depth],
        "wood",
        "#967046",
      );
      for (const [zi, z] of [-0.38, 0, 0.38].entries()) {
        add(
          `block-${xi}-${zi}`,
          [x * width, -supportHeight / 2, z * depth],
          [width * 0.18, supportHeight - 2 * plank, depth * 0.18],
          "wood",
          "#a57b4a",
        );
      }
    }
  } else if (kind === "cage") {
    const deck = short * 0.04;
    const bracket = short * 0.035;
    const radius = short * 0.065;
    const wheelWidth = short * 0.045;
    const tube = short * 0.018;
    const wire = tube * 0.25;
    supportHeight = deck + bracket + 2 * radius;
    padding = tube;
    add(
      "steel-deck",
      [0, -deck / 2, 0],
      [width, deck, depth],
      "metal",
      "#607b8a",
    );
    // Four casters with rubber tyres, hubs, swivel mounts and fork brackets.
    for (const [xi, x] of [-0.38, 0.38].entries())
      for (const [zi, z] of [-0.36, 0.36].entries()) {
        const id = `${xi}-${zi}`;
        const px = x * width,
          pz = z * depth;
        const wheelY = -supportHeight + radius;
        wheels.push({
          id,
          position: [px, wheelY, pz],
          radius,
          width: wheelWidth,
        });
        add(
          `caster-mount-${id}`,
          [px, -deck - bracket * 0.18, pz],
          [radius * 1.2, bracket * 0.36, radius * 1.3],
          "metal",
          "#a8bac4",
        );
        for (const side of [-1, 1])
          add(
            `caster-fork-${id}-${side}`,
            [px + side * wheelWidth * 0.66, -deck - (bracket + radius) / 2, pz],
            [wheelWidth * 0.2, bracket + radius, radius * 0.55],
            "metal",
            "#a8bac4",
          );
      }
    // Three mesh sides and an open front keep the boxes visible. Rails are
    // outside the declared internal dimensions, so they never consume capacity.
    for (const x of [-1, 1])
      for (const z of [-1, 1]) {
        add(
          `post-${x}-${z}`,
          [x * (width / 2 + tube / 2), height / 2, z * (depth / 2 + tube / 2)],
          [tube, height, tube],
          "metal",
          "#a7bac4",
        );
      }
    for (const x of [-1, 1]) {
      add(
        `side-top-${x}`,
        [x * (width / 2 + tube / 2), height + tube / 2, 0],
        [tube, tube, depth + 2 * tube],
        "metal",
        "#a7bac4",
      );
      for (let index = 1; index <= 5; index++)
        add(
          `side-horizontal-${x}-${index}`,
          [x * (width / 2 + tube / 2), (height * index) / 6, 0],
          [wire, wire, depth],
          "metal",
          "#708b99",
        );
      for (let index = 1; index <= 4; index++)
        add(
          `side-vertical-${x}-${index}`,
          [x * (width / 2 + tube / 2), height / 2, depth * (index / 5 - 0.5)],
          [wire, height, wire],
          "metal",
          "#708b99",
        );
    }
    add(
      "rear-top",
      [0, height + tube / 2, -depth / 2 - tube / 2],
      [width, tube, tube],
      "metal",
      "#a7bac4",
    );
    for (let index = 1; index <= 5; index++)
      add(
        `rear-horizontal-${index}`,
        [0, (height * index) / 6, -depth / 2 - tube / 2],
        [width, wire, wire],
        "metal",
        "#708b99",
      );
    for (let index = 1; index <= 4; index++)
      add(
        `rear-vertical-${index}`,
        [width * (index / 5 - 0.5), height / 2, -depth / 2 - tube / 2],
        [wire, height, wire],
        "metal",
        "#708b99",
      );
  } else {
    supportHeight = short * 0.025;
    add(
      "shelf-base",
      [0, -supportHeight / 2, 0],
      [width, supportHeight, depth],
      "shelf",
      "#355b63",
    );
  }
  const bounds: ViewBounds = {
    center: [0, (height + padding - supportHeight) / 2, 0],
    size: [
      width + 2 * padding,
      height + supportHeight + padding,
      depth + 2 * padding,
    ],
  };
  return { parts, wheels, supportHeight, padding, bounds };
}
