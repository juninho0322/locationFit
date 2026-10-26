import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { LocationChoice } from "../src/components/PlannerFields";
import assert from "node:assert/strict";
import test from "node:test";
import type { Location, LocationKind, Order, Sku } from "../src/types";
import {
  canPlanOrders,
  defaultOrderLocationId,
  getLocationKind,
  locationNoun,
  setLocationKind,
} from "../src/utils/locations";
import { calculateBestFit } from "../src/utils/fitCalculator";
import { calculateOrderPlan } from "../src/utils/planning";
import {
  calculatePalletEstimate,
  createLocationPalletType,
} from "../src/utils/palletEstimator";

const volume: Location = {
  id: "pick",
  name: "A01",
  kind: "pick-face",
  width: 60,
  depth: 40,
  height: 40,
};
const products: Sku[] = [
  {
    id: "a",
    code: "A",
    description: "A",
    unitsPerCase: 12,
    width: 30,
    depth: 20,
    height: 20,
  },
  {
    id: "b",
    code: "B",
    description: "B",
    unitsPerCase: 6,
    width: 20,
    depth: 20,
    height: 20,
  },
];
const order: Order = {
  id: "o",
  name: "1",
  locationId: volume.id,
  lines: products.map((product) => ({
    id: product.id,
    skuId: product.id,
    quantity: 2,
    mode: "cases",
  })),
};

test("pick faces reject mixed orders, even when a saved order references one", () => {
  for (const mode of [
    "auto",
    "box-size",
    "column-stack",
    "free-placement",
  ] as const) {
    assert.throws(
      () => calculateOrderPlan(order, products, volume, mode),
      /Pick faces.*single-SKU.*pallet or cage/,
    );
  }
});
test("order planning rejects pick faces even for a single SKU; use capacity check instead", () => {
  assert.throws(
    () =>
      calculateOrderPlan(
        { ...order, lines: [order.lines[0]] },
        products,
        volume,
        "auto",
      ),
    /Pick faces/,
  );
  assert.equal(
    calculateBestFit(volume, { ...products[0], quantity: 12 }).totalCapacity,
    8,
  );
});
test("the underlying packing entry point also refuses pick-face locations", () => {
  const cell = (value: string) => ({ value });
  assert.throws(
    () =>
      calculatePalletEstimate(
        [[cell("A"), cell("1"), cell("24")]],
        [
          [
            cell("A"),
            cell("30"),
            cell("20"),
            cell("20"),
            cell("12000"),
            cell("12"),
          ],
        ],
        createLocationPalletType(volume),
        "cm3",
        "cm",
        "auto",
        true,
      ),
    /Pick faces/,
  );
});
for (const kind of ["pallet", "cage"] as const) {
  test(`${kind}s allow mixed SKU packing and use the correct result label`, () => {
    const location = setLocationKind(volume, kind);
    const result = calculateOrderPlan(order, products, location, "auto");
    assert.equal(result.pallets.length, 1);
    assert.deepEqual(result.pallets[0].lines.map((line) => line.sku).sort(), [
      "A",
      "B",
    ]);
    assert.equal(result.pallets[0].boxes.length, 4);
    assert.equal(locationNoun(location), kind);
    assert.equal(result.palletType.locationKind, kind);
  });
}
test("all three types remain available for single-SKU capacity checks", () => {
  for (const kind of ["pick-face", "pallet", "cage"] as LocationKind[]) {
    const result = calculateBestFit(setLocationKind(volume, kind), {
      ...products[0],
      quantity: 12,
    });
    assert.equal(result.totalCapacity, 8);
    assert.equal(result.totalUnits, 96);
  }
});
test("new orders never inherit a pick face from the capacity check", () => {
  const pallet = { ...setLocationKind(volume, "pallet"), id: "p" };
  const cage = { ...setLocationKind(volume, "cage"), id: "c" };
  const saved = [volume, pallet, cage];
  assert.equal(defaultOrderLocationId(saved, volume.id), "p");
  assert.equal(defaultOrderLocationId(saved, cage.id), "c");
  assert.equal(defaultOrderLocationId([volume], volume.id), "");
  assert.deepEqual(
    saved.filter(canPlanOrders).map((location) => location.id),
    ["p", "c"],
  );
});
test("legacy location types are resolved safely, including conflicting count labels", () => {
  const legacy = { ...volume, kind: undefined };
  assert.equal(
    getLocationKind({ ...legacy, type: "Pick face", countAs: "pallet" }),
    "pick-face",
  );
  assert.equal(
    getLocationKind({ ...legacy, type: "Shelf", countAs: "pallet" }),
    "pick-face",
  );
  assert.equal(getLocationKind({ ...legacy, type: "UK pallet" }), "pallet");
  assert.equal(getLocationKind({ ...legacy, type: "Roll cage" }), "cage");
  assert.equal(
    getLocationKind({ ...legacy, type: "Custom volume" }),
    "pick-face",
  );
  assert.equal(getLocationKind({ ...legacy, name: "UK pallet" }), "pallet");
  assert.equal(getLocationKind({ ...legacy, name: "Cage 1" }), "cage");
  assert.equal(
    getLocationKind({ ...volume, type: "Pallet", countAs: "pallet" }),
    "pick-face",
  );
});
test("reclassifying a pallet as a pick face immediately invalidates mixed-order planning", () => {
  const pallet = setLocationKind(volume, "pallet");
  assert.equal(
    calculateOrderPlan(order, products, pallet, "auto").pallets.length,
    1,
  );
  const pick = setLocationKind(pallet, "pick-face");
  assert.equal(pick.type, "Pick face");
  assert.equal(pick.countAs, "location");
  assert.equal(pick.width, pallet.width);
  assert.equal(pick.id, pallet.id);
  assert.throws(
    () => calculateOrderPlan(order, products, pick, "auto"),
    /Pick faces/,
  );
});

test("order dropdown omits pick faces and clears an invalid saved selection; capacity dropdown retains all types", () => {
  const locations = [
    volume,
    { ...setLocationKind(volume, "pallet"), id: "pallet" },
    { ...setLocationKind(volume, "cage"), id: "cage" },
  ];
  const props = { locations, value: volume.id, onChange: () => {} };
  const orderSelect = renderToStaticMarkup(
    createElement(LocationChoice, { ...props, usage: "order" }),
  );
  assert.ok(!orderSelect.includes('value="pick"'));
  assert.ok(orderSelect.includes('value="pallet"'));
  assert.ok(orderSelect.includes('value="cage"'));
  assert.match(orderSelect, /value="" selected=""/);
  const capacitySelect = renderToStaticMarkup(
    createElement(LocationChoice, { ...props, usage: "capacity" }),
  );
  for (const id of ["pick", "pallet", "cage"])
    assert.ok(capacitySelect.includes(`value="${id}"`));
});
