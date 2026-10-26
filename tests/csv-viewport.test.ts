import { getVolumeStructure } from "../src/utils/volumeStructure";
import {
  getPalletFormat,
  locationDisplayLabel,
  locationDraftPreview,
  setPalletFormat,
} from "../src/utils/locations";
import type { Location, LocationKind } from "../src/types";
import assert from "node:assert/strict";
import test from "node:test";
import { PerspectiveCamera, Vector3 } from "three";
import type { Sku } from "../src/types";
import {
  importOrderCsv,
  orderCsvTemplate,
  parseCsv,
} from "../src/utils/orderCsv";
import { calculateOrderPlan, summarizeOrder } from "../src/utils/planning";
import { frameVolume, loadingLayout } from "../src/utils/viewport";

const sku: Sku = {
  id: "a",
  code: "001A",
  description: "Box of towels",
  unitsPerCase: 12,
  width: 30,
  depth: 20,
  height: 20,
};

test("CSV imports units and boxes using saved dimensions and keeps leading-zero SKU codes", () => {
  const lines = importOrderCsv(
    "SKU,Description,Units,Boxes\r\n001a,Towels,13,\r\n001A,Towels,,2\r\n",
    [sku],
  );
  assert.deepEqual(
    lines.map((line) => [
      line.skuId,
      line.quantity,
      line.mode,
      line.description,
    ]),
    [
      ["a", 13, "units", "Towels"],
      ["a", 2, "cases", "Towels"],
    ],
  );
  const input = { id: "o", name: "001", locationId: "l", lines };
  assert.equal(summarizeOrder(input, [sku]).units, 37);
  const plan = calculateOrderPlan(
    input,
    [sku],
    {
      id: "l",
      name: "Small pallet",
      kind: "pallet",
      width: 60,
      depth: 40,
      height: 40,
    },
    "auto",
  );
  assert.equal(plan.totalBoxes, 4);
  assert.equal(plan.pallets.length, 1);
});
test("CSV supports quoted commas, escaped quotes, multiline descriptions, BOM and blank lines", () => {
  const text =
    '\uFEFFSKU,Description,Units,Boxes\r\n\r\n001A,"Towels, ""large""\nblue",1,\r\n';
  const lines = importOrderCsv(text, [sku]);
  assert.equal(lines[0].description, 'Towels, "large"\nblue');
  assert.equal(lines.length, 1);
});
test("CSV supports semicolon delimiters and quantity/type layout", () => {
  assert.equal(
    importOrderCsv("SKU;Description;Boxes needed\n001A;Towels;3", [sku])[0]
      .quantity,
    3,
  );
  const lines = importOrderCsv(
    "SKU,Description,Quantity,Type\n001A,Towels,25,units\n001A,Towels,3,full boxes",
    [sku],
  );
  assert.deepEqual(
    lines.map((line) => line.mode),
    ["units", "cases"],
  );
});
test("both units and boxes in one row are retained and combined correctly", () => {
  const lines = importOrderCsv("SKU,Description,Units,Boxes\n001A,Towels,2,3", [
    sku,
  ]);
  assert.equal(lines.length, 2);
  assert.equal(
    summarizeOrder({ id: "o", name: "1", locationId: "l", lines }, [sku]).units,
    38,
  );
});
test("CSV does not guess unknown SKUs, malformed columns, quantities or modes", () => {
  for (const [text, message] of [
    ["SKU,Boxes\nUNKNOWN,2", /row 2.*UNKNOWN.*SKU setup/],
    ["SKU,Boxes\n001A,-1", /whole numbers/],
    ["SKU,Boxes\n001A,1.5", /whole numbers/],
    ["SKU,Boxes\n001A,abc", /whole numbers/],
    ["SKU,Boxes\n001A,0", /greater than zero/],
    ["SKU,Boxes\n001A,9007199254740992", /whole numbers/],
    ["SKU,Boxes\n001A,2,extra", /expected 2 fields/],
    ["SKU,Quantity,Type\n001A,2,litres", /Type must be/],
    ["SKU,SKU,Boxes\n001A,001A,2", /duplicate/],
    ["Description,Boxes\nTowels,2", /SKU column/],
    ["SKU,Boxes,Quantity,Type\n001A,2,2,boxes", /not both/],
    ['SKU,Description,Boxes\n001A,"unclosed,2', /unclosed/],
    ['SKU,Description,Boxes\n001A,"closed"bad,2', /Unexpected text/],
    ["SKU,Description,Boxes", /at least one/],
  ] as const)
    assert.throws(() => importOrderCsv(text, [sku]), message);
});
test("invalid rows reject the whole CSV and do not change saved SKU data", () => {
  const snapshot = JSON.stringify(sku);
  assert.throws(
    () =>
      importOrderCsv(
        "SKU,Description,Boxes\n001A,Changed description,2\nMISSING,Unknown,3",
        [sku],
      ),
    /row 3/,
  );
  assert.equal(JSON.stringify(sku), snapshot);
});
test("download template round-trips with quoted SKU descriptions", () => {
  const product = { ...sku, description: 'Large "blue", towels' };
  const template = orderCsvTemplate(product);
  assert.equal(parseCsv(template).length, 2);
  assert.equal(
    importOrderCsv(template, [product])[0].description,
    product.description,
  );
});

for (const aspect of [0.4, 1, 1.8, 3]) {
  test(`camera fits all volume corners and centres the target at aspect ${aspect}`, () => {
    for (const bounds of [
      {
        center: [0, 6, 0] as [number, number, number],
        size: [15, 12, 20] as [number, number, number],
      },
      {
        center: [0, 20, 0] as [number, number, number],
        size: [60, 40, 40] as [number, number, number],
      },
      {
        center: [0, 75, 0] as [number, number, number],
        size: [120, 150, 100] as [number, number, number],
      },
      {
        center: [0, 300, 0] as [number, number, number],
        size: [10, 600, 10] as [number, number, number],
      },
      loadingLayout(12, 120, 100, 150).bounds,
    ]) {
      const fitted = frameVolume(bounds, aspect);
      const camera = new PerspectiveCamera(46, aspect, fitted.near, fitted.far);
      camera.position.copy(fitted.position);
      camera.lookAt(fitted.target);
      camera.updateMatrixWorld();
      const centre = fitted.target.clone().project(camera);
      assert.ok(Math.abs(centre.x) < 1e-8 && Math.abs(centre.y) < 1e-8);
      for (const x of [-1, 1])
        for (const y of [-1, 1])
          for (const z of [-1, 1]) {
            const corner = new Vector3(
              bounds.center[0] + (x * bounds.size[0]) / 2,
              bounds.center[1] + (y * bounds.size[1]) / 2,
              bounds.center[2] + (z * bounds.size[2]) / 2,
            ).project(camera);
            assert.ok(
              Math.abs(corner.x) <= 1 / 1.18 + 1e-8 &&
                Math.abs(corner.y) <= 1 / 1.18 + 1e-8,
              "Corner outside padded viewport",
            );
            assert.ok(
              corner.z > -1 && corner.z < 1,
              "Corner clipped by near/far plane",
            );
          }
    }
  });
}
test("multiple pallets are arranged around the scene centre, with bounds containing all pallets", () => {
  for (const count of [1, 2, 3, 5, 12]) {
    const { positions, bounds } = loadingLayout(count, 120, 100, 150);
    assert.equal(positions.length, count);
    assert.equal(
      Math.min(...positions.map((p) => p[0])) +
        Math.max(...positions.map((p) => p[0])),
      0,
    );
    assert.equal(
      Math.min(...positions.map((p) => p[2])) +
        Math.max(...positions.map((p) => p[2])),
      0,
    );
    positions.forEach(([x, , z]) => {
      assert.ok(Math.abs(x) + 60 <= bounds.size[0] / 2 + 1e-8);
      assert.ok(Math.abs(z) + 50 <= bounds.size[2] / 2 + 1e-8);
    });
  }
});

for (const kind of ["pick-face", "pallet", "cage"] as LocationKind[]) {
  test(`${kind} structure stays outside usable volume and inside camera bounds`, () => {
    const width = 120,
      depth = 100,
      height = 150;
    const structure = getVolumeStructure(kind, width, depth, height);
    const bounds = structure.bounds;
    const physicalParts = [
      ...structure.parts,
      ...structure.wheels.map((wheel) => ({
        id: wheel.id,
        position: wheel.position,
        size: [wheel.width * 1.45, wheel.radius * 2, wheel.radius * 2],
      })),
    ];
    if (kind === "cage") assert.equal(structure.wheels.length, 4);
    else assert.equal(structure.wheels.length, 0);
    for (const part of physicalParts) {
      const [x, y, z] = part.position,
        [w, h, d] = part.size;
      const overlapsUsable =
        x + w / 2 > -width / 2 + 1e-8 &&
        x - w / 2 < width / 2 - 1e-8 &&
        y + h / 2 > 1e-8 &&
        y - h / 2 < height - 1e-8 &&
        z + d / 2 > -depth / 2 + 1e-8 &&
        z - d / 2 < depth / 2 - 1e-8;
      assert.equal(
        overlapsUsable,
        false,
        `${part.id} intrudes into packing space`,
      );
      for (let axis = 0; axis < 3; axis++)
        assert.ok(
          Math.abs(part.position[axis] - bounds.center[axis]) +
            part.size[axis] / 2 <=
            bounds.size[axis] / 2 + 1e-8,
          `${part.id} outside fit bounds`,
        );
    }
    for (const aspect of [0.4, 1.8]) {
      const fitted = frameVolume(bounds, aspect);
      const camera = new PerspectiveCamera(46, aspect, fitted.near, fitted.far);
      camera.position.copy(fitted.position);
      camera.lookAt(fitted.target);
      camera.updateMatrixWorld();
      for (const part of physicalParts)
        for (const x of [-1, 1])
          for (const y of [-1, 1])
            for (const z of [-1, 1]) {
              const projected = new Vector3(
                part.position[0] + (x * part.size[0]) / 2,
                part.position[1] + (y * part.size[1]) / 2,
                part.position[2] + (z * part.size[2]) / 2,
              ).project(camera);
              assert.ok(
                Math.abs(projected.x) < 1 &&
                  Math.abs(projected.y) < 1 &&
                  projected.z > -1 &&
                  projected.z < 1,
              );
            }
    }
  });
}
test("multi-cage layouts include wheel bottoms and outer rails in the fitted bounds", () => {
  const structure = getVolumeStructure("cage", 80, 70, 160);
  const { positions, bounds } = loadingLayout(
    5,
    80,
    70,
    160,
    structure.supportHeight,
    structure.padding,
  );
  for (const offset of positions) {
    for (const part of structure.parts)
      for (let axis = 0; axis < 3; axis++) {
        assert.ok(
          Math.abs(part.position[axis] + offset[axis] - bounds.center[axis]) +
            part.size[axis] / 2 <=
            bounds.size[axis] / 2 + 1e-8,
        );
      }
    for (const wheel of structure.wheels)
      assert.ok(
        wheel.position[1] - wheel.radius >=
          bounds.center[1] - bounds.size[1] / 2 - 1e-8,
      );
  }
});
test("pallet footprint selection is explicit and preserves user names and usable height", () => {
  const initial: Location = {
    id: "l",
    name: "Dispatch lane A",
    kind: "pallet",
    width: 120,
    depth: 100,
    height: 170,
  };
  assert.equal(locationDisplayLabel(initial), "UK pallet");
  const euro = setPalletFormat(initial, "euro");
  assert.equal(euro.depth, 80);
  assert.equal(euro.height, 170);
  assert.equal(euro.name, initial.name);
  assert.equal(locationDisplayLabel(euro), "Euro pallet");
  assert.equal(getPalletFormat({ ...euro, width: 90 }), "custom");
  const custom = setPalletFormat(euro, "custom");
  assert.equal(custom.depth, 80);
  assert.equal(locationDisplayLabel(custom), "Custom pallet");
  assert.equal(
    setPalletFormat({ ...initial, name: "UK pallet" }, "euro").name,
    "Euro pallet",
  );
});
test("unsaved location preview follows the draft and never overwrites entered dimensions", () => {
  const draft: Location = {
    id: "",
    name: "New cage",
    kind: "cage",
    width: 95,
    depth: 0,
    height: 180,
  };
  const snapshot = JSON.stringify(draft);
  const preview = locationDraftPreview(draft);
  assert.equal(preview.illustrative, true);
  assert.equal(preview.location.kind, "cage");
  assert.equal(preview.location.width, 95);
  assert.equal(preview.location.depth, 70);
  assert.equal(preview.location.height, 180);
  assert.equal(JSON.stringify(draft), snapshot);
  const complete = locationDraftPreview({ ...draft, depth: 85 });
  assert.equal(complete.illustrative, false);
  assert.equal(complete.location.depth, 85);
});
