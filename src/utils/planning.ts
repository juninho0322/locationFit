import type { PackingMode } from "../types/packing";
import { canPlanOrders } from "./locations";
export { locationNoun } from "./locations";
import type { Location, Order, Sku } from "../types";
import {
  calculatePalletEstimate,
  createLocationPalletType,
} from "./palletEstimator";
import type { SheetData } from "./sheetData";

export const positive = (value: number) => Number.isFinite(value) && value > 0;
export const validDimensions = (item: {
  width: number;
  depth: number;
  height: number;
}) => [item.width, item.depth, item.height].every(positive);
export const validSku = (sku: Sku) =>
  !!sku.code.trim() &&
  validDimensions(sku) &&
  Number.isSafeInteger(sku.unitsPerCase) &&
  sku.unitsPerCase > 0;
export const dimensionsText = (item: {
  width: number;
  depth: number;
  height: number;
}) => `${item.width} × ${item.depth} × ${item.height} cm`;
export const numberText = (value: number) =>
  value.toLocaleString("en-GB", { maximumFractionDigits: 2 });

export function summarizeOrder(order: Order, skus: Sku[]) {
  const skuById = new Map(skus.map((sku) => [sku.id, sku]));
  const quantities = new Map<string, number>();
  const errors: string[] = [];
  for (const line of order.lines) {
    const sku = skuById.get(line.skuId);
    if (!sku || !validSku(sku)) {
      errors.push(
        "An order line has a missing or invalid SKU. Update the line or SKU setup.",
      );
      continue;
    }
    if (!Number.isSafeInteger(line.quantity) || line.quantity <= 0) {
      errors.push(`${sku.code}: enter a positive whole quantity.`);
      continue;
    }
    const units =
      line.quantity * (line.mode === "cases" ? sku.unitsPerCase : 1);
    const total = (quantities.get(sku.id) ?? 0) + units;
    if (!Number.isSafeInteger(total)) {
      errors.push(`${sku.code}: quantity is too large.`);
      continue;
    }
    quantities.set(sku.id, total);
  }
  const rows = [...quantities].map(([id, units]) => {
    const sku = skuById.get(id)!;
    return {
      sku,
      units,
      cases: Math.ceil(units / sku.unitsPerCase),
      partial: units % sku.unitsPerCase !== 0,
    };
  });
  const units = rows.reduce((sum, row) => sum + row.units, 0);
  const cases = rows.reduce((sum, row) => sum + row.cases, 0);
  if (!Number.isSafeInteger(units) || !Number.isSafeInteger(cases))
    errors.push(
      "Order totals are too large. Split the order into smaller orders.",
    );
  return {
    rows,
    errors: [...new Set(errors)],
    units,
    cases,
  };
}

export function calculateOrderPlan(
  order: Order,
  skus: Sku[],
  location: Location,
  mode: PackingMode,
) {
  if (!canPlanOrders(location))
    throw new Error(
      "Pick faces are single-SKU locations and cannot be used for order planning. Select a pallet or cage.",
    );
  const summary = summarizeOrder(order, skus);
  if (!validDimensions(location))
    throw new Error("Enter valid location dimensions.");
  if (summary.errors.length) throw new Error(summary.errors.join(" "));
  if (!summary.rows.length) throw new Error("Add at least one order line.");
  if (summary.cases > 2000)
    throw new Error(
      "This 3D planner supports up to 2,000 cases per order. Split this order into smaller plans.",
    );
  const sheet = (rows: (string | number)[][]): SheetData =>
    rows.map((row) => row.map((value) => ({ value: String(value) })));
  return calculatePalletEstimate(
    sheet(summary.rows.map(({ sku, units }) => [sku.code, order.name, units])),
    sheet(
      summary.rows.map(({ sku }) => [
        sku.code,
        sku.width,
        sku.height,
        sku.depth,
        sku.width * sku.depth * sku.height,
        sku.unitsPerCase,
      ]),
    ),
    createLocationPalletType(location),
    "cm3",
    "cm",
    mode,
    true,
  );
}
