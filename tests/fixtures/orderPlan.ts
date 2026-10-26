import type { Location, Order, Sku } from "../../src/types";
import { calculateOrderPlan } from "../../src/utils/planning";

export const exampleLocation: Location = {
  id: "demo-pallet", name: "UK pallet - example", kind: "pallet",
  palletFormat: "uk", width: 120, depth: 100, height: 60,
};
export const exampleSkus: Sku[] = [
  { id: "towels", code: "TOWEL-001", description: "Cotton hand towels", unitsPerCase: 12, width: 40, depth: 30, height: 20 },
  { id: "bags", code: "BAG-002", description: "Reusable storage bags", unitsPerCase: 6, width: 30, depth: 20, height: 20 },
];
export const exampleOrder: Order = {
  id: "example", name: "EXAMPLE-1001", locationId: exampleLocation.id,
  packingMode: "auto",
  lines: [
    { id: "one", skuId: "towels", mode: "cases", quantity: 35 },
    { id: "two", skuId: "bags", mode: "units", quantity: 19 },
  ],
};
export const examplePlan = () => calculateOrderPlan(exampleOrder, exampleSkus, exampleLocation, "auto");
