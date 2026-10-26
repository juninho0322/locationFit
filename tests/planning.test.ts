import { readLegacyData } from "../src/utils/legacyData";
import assert from "node:assert/strict";
import test from "node:test";
import { calculateBestFit } from "../src/utils/fitCalculator";
import { calculateOrderPlan, summarizeOrder } from "../src/utils/planning";
import type { Location, Order, Sku } from "../src/types";
import type {
  PackingMode,
  PalletEstimateResult,
} from "../src/types/packing";

const location: Location = {
  id: "pallet",
  name: "Test pallet",
  kind: "pallet",
  type: "Pallet",
  width: 60,
  depth: 40,
  height: 40,
};
const sku: Sku = {
  id: "sku-a",
  code: "SKU-001",
  description: "Towels",
  unitsPerCase: 12,
  width: 30,
  depth: 20,
  height: 20,
};
const order = (quantity: number, mode: "cases" | "units" = "cases"): Order => ({
  id: "order",
  name: "Test order",
  locationId: location.id,
  lines: [{ id: "line", skuId: sku.id, quantity, mode }],
});

function verifyGeometry(plan: PalletEstimateResult) {
  let count = 0;
  for (const pallet of plan.pallets) {
    count += pallet.boxes.length;
    const volume = pallet.boxes.reduce(
      (sum, box) => sum + box.width * box.height * box.depth,
      0,
    );
    assert.ok(Math.abs(volume - pallet.usedVolume) < 1e-5);
    for (const box of pallet.boxes) {
      assert.ok(
        box.x - box.width / 2 >= -1e-5 &&
          box.x + box.width / 2 <= plan.palletType.width + 1e-5,
      );
      assert.ok(
        box.y - box.height / 2 >= -1e-5 &&
          box.y + box.height / 2 <= plan.palletType.height + 1e-5,
      );
      assert.ok(
        box.z - box.depth / 2 >= -1e-5 &&
          box.z + box.depth / 2 <= plan.palletType.depth + 1e-5,
      );
    }
    for (let i = 0; i < pallet.boxes.length; i++)
      for (let j = i + 1; j < pallet.boxes.length; j++) {
        const a = pallet.boxes[i],
          b = pallet.boxes[j];
        const overlaps =
          Math.abs(a.x - b.x) < (a.width + b.width) / 2 - 1e-5 &&
          Math.abs(a.y - b.y) < (a.height + b.height) / 2 - 1e-5 &&
          Math.abs(a.z - b.z) < (a.depth + b.depth) / 2 - 1e-5;
        assert.equal(overlaps, false, `${a.id} and ${b.id} overlap`);
      }
  }
  assert.equal(
    count,
    plan.totalBoxes -
      plan.oversizedSkus.reduce((sum, item) => sum + item.boxesRequired, 0),
  );
}

test("single location shows 8 cases and 96 contained units", () => {
  const result = calculateBestFit(location, {
    ...sku,
    quantity: sku.unitsPerCase,
  });
  assert.equal(result.totalCapacity, 8);
  assert.equal(result.totalUnits, 96);
  assert.equal(result.positions.length, 8);
  assert.equal(result.volumeUtilization, 100);
});
test("capacity checks all rotations and rejects oversized cases", () => {
  assert.equal(
    calculateBestFit(
      { ...location, width: 20, depth: 30, height: 40 },
      { width: 40, depth: 20, height: 30, quantity: 1 },
    ).totalCapacity,
    1,
  );
  assert.equal(
    calculateBestFit(location, { width: 61, depth: 5, height: 5, quantity: 1 })
      .fits,
    false,
  );
});
test("decimal dimensions do not lose a layer to floating point rounding", () => {
  assert.equal(
    calculateBestFit(
      { ...location, width: 0.3, depth: 0.3, height: 0.3 },
      { width: 0.1, depth: 0.1, height: 0.1, quantity: 1 },
    ).totalCapacity,
    27,
  );
});
test("invalid dimensions are rejected and huge previews are bounded", () => {
  assert.equal(
    calculateBestFit(location, { ...sku, width: Infinity, quantity: 1 }).fits,
    false,
  );
  const result = calculateBestFit(location, {
    width: 1,
    depth: 1,
    height: 1,
    quantity: 1,
  });
  assert.equal(result.totalCapacity, 96000);
  assert.equal(result.positions.length, 1500);
});
test("full cases and units use exact SKU codes without stripping characters", () => {
  const plan = calculateOrderPlan(order(2), [sku], location, "box-size");
  assert.equal(plan.missingPackConfigs.length, 0);
  assert.equal(plan.totalOrderQuantity, 24);
  assert.equal(plan.totalBoxes, 2);
  assert.equal(plan.skus[0].sku, "SKU-001");
  verifyGeometry(plan);
});
test("13 units need two full-size footprints, one partial case", () => {
  const plan = calculateOrderPlan(
    order(13, "units"),
    [sku],
    location,
    "box-size",
  );
  assert.equal(plan.totalBoxes, 2);
  assert.equal(plan.partialBoxSkus[0].partialBoxes, 1);
  assert.equal(plan.totalVolume, 24000);
  verifyGeometry(plan);
});
test("repeated SKU lines combine before rounding and can mix cases with units", () => {
  const input = order(2, "units");
  input.lines.push(
    { id: "two", skuId: sku.id, quantity: 10, mode: "units" },
    { id: "three", skuId: sku.id, quantity: 1, mode: "cases" },
  );
  assert.equal(summarizeOrder(input, [sku]).cases, 2);
  const plan = calculateOrderPlan(input, [sku], location, "box-size");
  assert.equal(plan.totalBoxes, 2);
  assert.equal(plan.partialBoxSkus.length, 0);
  verifyGeometry(plan);
});
test("an order exceeding one location gets a second location", () => {
  const plan = calculateOrderPlan(order(9), [sku], location, "box-size");
  assert.equal(plan.pallets.length, 2);
  verifyGeometry(plan);
});
test("changing location dimensions changes required capacity", () => {
  const plan = calculateOrderPlan(
    order(9),
    [sku],
    { ...location, width: 120 },
    "box-size",
  );
  assert.equal(plan.pallets.length, 1);
  verifyGeometry(plan);
});
test("oversized cases are excluded from packing and explicitly reported", () => {
  const large = { ...sku, width: 61, depth: 5, height: 5 };
  const plan = calculateOrderPlan(order(2), [large], location, "box-size");
  assert.equal(plan.oversizedSkus.length, 1);
  assert.equal(plan.pallets.length, 0);
  assert.equal(plan.totalBoxes, 2);
  verifyGeometry(plan);
});
test("missing SKUs, invalid quantities, empty orders and excessive plans cannot silently succeed", () => {
  assert.throws(
    () => calculateOrderPlan(order(1), [], location, "box-size"),
    /missing/,
  );
  for (const quantity of [0, -1, 1.5, Infinity])
    assert.throws(
      () => calculateOrderPlan(order(quantity), [sku], location, "box-size"),
      /positive whole/,
    );
  assert.throws(
    () =>
      calculateOrderPlan(
        { ...order(1), lines: [] },
        [sku],
        location,
        "box-size",
      ),
    /at least one/,
  );
  assert.throws(
    () => calculateOrderPlan(order(2001), [sku], location, "box-size"),
    /2,000/,
  );
});
for (const mode of [
  "box-size",
  "column-stack",
  "free-placement",
] as PackingMode[]) {
  test(`mixed SKUs preserve quantities, boundaries and non-overlap with ${mode}`, () => {
    const other = {
      ...sku,
      id: "sku-b",
      code: "B002",
      width: 20,
      unitsPerCase: 6,
    };
    const input = order(6);
    input.lines.push({
      id: "second",
      skuId: other.id,
      quantity: 19,
      mode: "units",
    });
    const plan = calculateOrderPlan(input, [sku, other], location, mode);
    assert.equal(plan.totalBoxes, 10);
    assert.equal(plan.totalOrderQuantity, 91);
    assert.equal(plan.skus.length, 2);
    assert.equal(plan.pallets.length, 2);
    verifyGeometry(plan);
  });
}

test("legacy sheets migrate units, dimensions and matching without modifying originals", () => {
  const sheet = (rows: (string | number)[][]) =>
    JSON.stringify(
      rows.map((row) => row.map((value) => ({ value: String(value) }))),
    );
  const data = new Map([
    [
      "location-box-fit.packConfig",
      sheet([["XSKU-001", 0.3, 0.2, 0.2, 0.012, 12]]),
    ],
    [
      "location-box-fit.orderLines",
      sheet([
        ["SKU-001", "Original order", 13],
        ["MISSING", "Original order", 2],
      ]),
    ],
    ["location-box-fit.selectedLocationId", JSON.stringify("pick")],
  ]);
  const original = [...data];
  const descriptor = Object.getOwnPropertyDescriptor(
    globalThis,
    "localStorage",
  );
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: { getItem: (key: string) => data.get(key) ?? null },
  });
  try {
    const imported = readLegacyData();
    assert.equal(imported.imported, true);
    assert.equal(imported.skus[0].code, "SKU-001");
    assert.equal(imported.skus[0].width, 30);
    assert.equal(imported.skus[0].height, 20);
    assert.equal(imported.skus[0].depth, 20);
    assert.equal(imported.orders[0].locationId, "pick");
    assert.equal(imported.orders[0].lines[0].mode, "units");
    assert.equal(imported.orders[0].lines[0].quantity, 13);
    assert.match(
      summarizeOrder(imported.orders[0], imported.skus).errors[0],
      /missing/,
    );
    assert.deepEqual([...data], original);
    data.set("location-box-fit.skus.v2", "[]");
    assert.equal(readLegacyData().imported, false);
  } finally {
    if (descriptor)
      Object.defineProperty(globalThis, "localStorage", descriptor);
    else Reflect.deleteProperty(globalThis, "localStorage");
  }
});

test("automatic stacking preserves best capacity while explicit columns retain their structure", () => {
  const products: Sku[] = [
    {
      ...sku,
      id: "a",
      code: "A",
      unitsPerCase: 1,
      width: 30,
      depth: 20,
      height: 10,
    },
    {
      ...sku,
      id: "b",
      code: "B",
      unitsPerCase: 1,
      width: 40,
      depth: 20,
      height: 20,
    },
    {
      ...sku,
      id: "c",
      code: "C",
      unitsPerCase: 1,
      width: 10,
      depth: 40,
      height: 30,
    },
  ];
  const volume = { ...location, width: 60, depth: 60, height: 60 };
  const input: Order = {
    ...order(1),
    lines: products.map((product, index) => ({
      id: product.id,
      skuId: product.id,
      mode: "cases",
      quantity: [5, 6, 7][index],
    })),
  };
  const candidates = ["box-size", "column-stack", "free-placement"].map(
    (mode) => calculateOrderPlan(input, products, volume, mode as PackingMode),
  );
  assert.deepEqual(
    candidates.map((plan) => plan.pallets.length),
    [2, 3, 1],
  );
  const automatic = calculateOrderPlan(input, products, volume, "auto");
  assert.equal(automatic.pallets.length, 1);
  assert.equal(automatic.packingMethod, "free-placement");
  verifyGeometry(automatic);
});

for (const kind of ["pallet", "cage"] as const) {
  test(`SKU separation never mixes products on a ${kind}, including identical cases and partial boxes`, () => {
    const other = { ...sku, id: "other", code: "SKU-002" };
    const input = order(9);
    input.lines.push({ id: "other", skuId: other.id, quantity: 13, mode: "units" });
    const plan = calculateOrderPlan(input, [sku, other], { ...location, kind }, "sku-separated");
    assert.equal(plan.packingMethod, "sku-separated");
    assert.equal(plan.pallets.length, 3);
    assert.equal(plan.pallets.reduce((sum, pallet) => sum + pallet.boxes.filter(box => box.isPartial).length, 0), 1);
    assert.deepEqual(plan.pallets.map(pallet => pallet.index), [1, 2, 3]);
    assert.equal(new Set(plan.pallets.map(pallet => pallet.id)).size, 3);
    for (const pallet of plan.pallets) assert.equal(new Set(pallet.boxes.map(box => box.sku)).size, 1);
    verifyGeometry(plan);
  });
}
test("SKU separation still reports oversized products and packs fitting SKUs", () => {
  const large = { ...sku, id: "large", code: "LARGE", width: 100, depth: 100, height: 100 };
  const input = order(2);
  input.lines.push({ id: "large", skuId: large.id, quantity: 3, mode: "cases" });
  const plan = calculateOrderPlan(input, [sku, large], location, "sku-separated");
  assert.equal(plan.oversizedSkus[0].sku, "LARGE");
  assert.equal(plan.pallets.length, 1);
  verifyGeometry(plan);
});
test("selected column method retains identical, directly supported footprints", () => {
  const plan = calculateOrderPlan(order(15), [sku], { ...location, height: 80 }, "column-stack");
  for (const pallet of plan.pallets) for (const box of pallet.boxes) {
    const bottom = box.y - box.height / 2;
    if (bottom < 1e-5) continue;
    assert.ok(pallet.boxes.some(support => support !== box && Math.abs(support.y + support.height / 2 - bottom) < 1e-5 && support.x === box.x && support.z === box.z && support.width === box.width && support.depth === box.depth));
  }
  verifyGeometry(plan);
});
