import type { Location, Order, Sku } from "../types";
import { resolvePackingMode } from "./packingMethods";

export function nextOrderName(orders: Order[]) {
  const existing = new Set(orders.map((order) => order.name.trim()));
  let number =
    orders.reduce((max, order) => {
      const value = /^\d+$/.test(order.name.trim()) ? Number(order.name) : 0;
      return Number.isSafeInteger(value) && value < Number.MAX_SAFE_INTEGER
        ? Math.max(max, value)
        : max;
    }, 0) + 1;
  while (existing.has(String(number).padStart(4, "0"))) number++;
  return String(number).padStart(4, "0");
}

const orderInputs = (order: Order) => ({
  id: order.id,
  name: order.name,
  locationId: order.locationId,
  lines: order.lines,
  mode: resolvePackingMode(order.packingMode),
});

export function attachCalculatedPlan(
  current: Order,
  source: Order,
  savedPlan: NonNullable<Order["savedPlan"]>,
): Order {
  if (
    JSON.stringify(orderInputs(current)) !== JSON.stringify(orderInputs(source))
  )
    return current;
  return { ...current, savedPlan, updatedAt: savedPlan.calculatedAt };
}

export function orderPlanSignature(
  order: Order,
  skus: Sku[],
  location: Location,
) {
  const usedIds = new Set(order.lines.map((line) => line.skuId));
  return JSON.stringify({
    version: 1,
    order: orderInputs(order),
    skus: skus
      .filter((sku) => usedIds.has(sku.id))
      .sort((a, b) => a.id.localeCompare(b.id)),
    location,
  });
}

export function restoredOrderPlan(
  order: Order | undefined,
  skus: Sku[],
  location: Location | null,
) {
  if (!order?.savedPlan || !location) return null;
  return order.savedPlan.signature === orderPlanSignature(order, skus, location)
    ? order.savedPlan.result
    : null;
}

export function findSavedOrders(orders: Order[], query: string) {
  const search = query.trim().toLowerCase();
  return orders
    .map((order, index) => ({ order, index }))
    .filter(({ order }) =>
      (order.name || "Untitled order").toLowerCase().includes(search),
    )
    .sort(
      (a, b) =>
        (Date.parse(b.order.updatedAt ?? "") || 0) -
          (Date.parse(a.order.updatedAt ?? "") || 0) || b.index - a.index,
    )
    .map(({ order }) => order);
}
