import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { SavedOrders } from "../src/components/SavedOrders";
import { readLocalValue, writeLocalValue } from "../src/utils/localStorage";
import { findSavedOrders, nextOrderName, orderPlanSignature, restoredOrderPlan } from "../src/utils/savedOrders";
import { exampleLocation, exampleOrder, examplePlan, exampleSkus } from "./fixtures/orderPlan";
import type { Order } from "../src/types";

const data = new Map<string, string>();
const storage = { getItem: (key: string) => data.get(key) ?? null, setItem: (key: string, value: string) => { data.set(key, value); } };
const saved: Order = {
  ...exampleOrder,
  updatedAt: "2026-10-26T10:00:00Z",
  savedPlan: { signature: orderPlanSignature(exampleOrder, exampleSkus, exampleLocation), calculatedAt: "2026-10-26T10:00:00Z", result: examplePlan() },
};

test("browser storage round-trip restores orders, selected order, SKU library, locations and full calculated layout", () => {
  data.clear();
  const second: Order = { id: "new", name: "0002", locationId: exampleLocation.id, lines: [] };
  assert.equal(writeLocalValue(storage, "location-box-fit.orders.v2", [saved, second]), null);
  assert.equal(writeLocalValue(storage, "location-box-fit.skus.v2", exampleSkus), null);
  assert.equal(writeLocalValue(storage, "location-box-fit.locations", [exampleLocation]), null);
  assert.equal(writeLocalValue(storage, "location-box-fit.orderId.v2", second.id), null);
  const orders = readLocalValue<Order[]>(storage, "location-box-fit.orders.v2", []).value;
  assert.equal(orders.length, 2);
  assert.equal(readLocalValue(storage, "location-box-fit.orderId.v2", "").value, second.id);
  const skus = readLocalValue(storage, "location-box-fit.skus.v2", [] as typeof exampleSkus).value;
  const locations = readLocalValue(storage, "location-box-fit.locations", [] as typeof exampleLocation[]).value;
  assert.deepEqual(restoredOrderPlan(orders[0], skus, locations[0]), saved.savedPlan!.result);
  assert.equal(restoredOrderPlan(orders[1], skus, locations[0]), null);
});
test("saved layouts are invalidated by relevant changes and survive unrelated library edits", () => {
  assert.ok(restoredOrderPlan(saved, exampleSkus, exampleLocation));
  assert.equal(restoredOrderPlan({ ...saved, lines: saved.lines.slice(0, 1) }, exampleSkus, exampleLocation), null);
  assert.equal(restoredOrderPlan({ ...saved, packingMode: "sku-separated" }, exampleSkus, exampleLocation), null);
  assert.equal(restoredOrderPlan(saved, exampleSkus.map(sku => ({ ...sku, width: sku.width + 1 })), exampleLocation), null);
  assert.equal(restoredOrderPlan(saved, exampleSkus, { ...exampleLocation, height: 80 }), null);
  assert.equal(restoredOrderPlan(saved, exampleSkus, null), null);
  assert.equal(restoredOrderPlan(saved, exampleSkus.slice(1), exampleLocation), null);
  assert.ok(restoredOrderPlan(saved, [...exampleSkus, { ...exampleSkus[0], id: "unrelated" }], exampleLocation));
  assert.ok(restoredOrderPlan({ ...saved, updatedAt: "2026-10-27T10:00:00Z" }, [...exampleSkus].reverse(), exampleLocation));
});
test("quota failure is reported without replacing the last successfully saved records; retry can save", () => {
  const key = "quota";
  writeLocalValue(storage, key, [saved]);
  const full = { setItem: () => { throw new Error("QuotaExceededError"); } };
  assert.equal(writeLocalValue(full, key, []), "write-error");
  assert.deepEqual(readLocalValue<Order[]>(storage, key, []).value, [saved]);
  assert.equal(writeLocalValue(storage, key, [saved, { ...exampleOrder, id: "new" }]), null);
  assert.equal(readLocalValue<Order[]>(storage, key, []).value.length, 2);
});
test("blocked, corrupt and wrong-shaped storage are reported without altering stored data", () => {
  const denied = { getItem: () => { throw new Error("SecurityError"); } };
  assert.equal(readLocalValue(denied, "orders", []).error, "read-error");
  for (const raw of ["bad JSON", "null", "{}", '"wrong type"']) {
    data.set("broken", raw);
    const result = readLocalValue(storage, "broken", []);
    assert.equal(result.error, "read-error");
    assert.deepEqual(result.value, []);
    assert.equal(storage.getItem("broken"), raw);
  }
  assert.deepEqual(readLocalValue(storage, "absent-key", []), { value: [], error: null });
});
test("saved order history searches by order number and lists recent edits first, without mutating data", () => {
  const previous = { ...exampleOrder, id: "previous", name: "PREV-001", updatedAt: "2026-10-25T10:00:00Z" };
  const orders = [saved, previous];
  assert.deepEqual(findSavedOrders(orders, "prev").map(order => order.id), [previous.id]);
  assert.deepEqual(findSavedOrders(orders, "").map(order => order.id), [saved.id, previous.id]);
  assert.equal(findSavedOrders(orders, "missing").length, 0);
  assert.deepEqual(orders, [saved, previous]);
});
test("order history stays visible with a single order and shows an open action for previous orders", () => {
  const props = { orders: [saved], selectedId: saved.id, locations: [exampleLocation], onSelect: () => {} };
  const single = renderToStaticMarkup(createElement(SavedOrders, props));
  assert.match(single, /Saved orders/);
  assert.match(single, /Find an order/);
  assert.match(single, /Current order/);
  assert.doesNotMatch(single, /<details/);
  const multiple = renderToStaticMarkup(createElement(SavedOrders, { ...props, orders: [saved, { ...exampleOrder, id: "other", name: "0002" }] }));
  assert.match(multiple, /Open order/);
  assert.match(multiple, /0002/);
});
test("new order numbers do not collide after deleting an older order", () => {
  const orders = ["0001", "0003", "CUSTOM"].map((name, i) => ({ ...exampleOrder, id: String(i), name }));
  assert.equal(nextOrderName(orders), "0004");
  assert.equal(nextOrderName([]), "0001");
});
