import type { Order, Sku } from "../types";
import type { SheetData } from "./sheetData";
import { validSku } from "./planning";

// Leave the original sheets untouched so older data remains recoverable.
export function readLegacyData(): {
  skus: Sku[];
  orders: Order[];
  imported: boolean;
} {
  try {
    if (localStorage.getItem("location-box-fit.skus.v2") !== null)
      return { skus: [], orders: [], imported: false };
    const packs: SheetData = JSON.parse(
      localStorage.getItem("location-box-fit.packConfig") ?? "[]",
    );
    const lines: SheetData = JSON.parse(
      localStorage.getItem("location-box-fit.orderLines") ?? "[]",
    );
    const text = (row: SheetData[number], column: number) =>
      String(row[column]?.value ?? "").trim();
    const number = (row: SheetData[number], column: number) =>
      Number(text(row, column).replace(",", "."));
    const skus: Sku[] = [];
    for (const row of packs) {
      const code = text(row, 0).slice(1); // Previous pack sheets used a one-character prefix.
      const sku = {
        id: crypto.randomUUID(),
        code,
        description: "",
        width: number(row, 1) * 100,
        height: number(row, 2) * 100,
        depth: number(row, 3) * 100,
        unitsPerCase: number(row, 5),
      };
      if (
        validSku(sku) &&
        !skus.some((item) => item.code.toUpperCase() === code.toUpperCase())
      )
        skus.push(sku);
    }
    const orders: Order[] = [];
    for (const row of lines) {
      const code = text(row, 0);
      const quantity = number(row, 2);
      if (!code || !Number.isSafeInteger(quantity) || quantity <= 0) continue;
      const sku = skus.find(
        (item) => item.code.toUpperCase() === code.toUpperCase(),
      );
      const name = text(row, 1) || "Imported order";
      let order = orders.find((item) => item.name === name);
      if (!order) {
        order = {
          id: crypto.randomUUID(),
          name,
          locationId: JSON.parse(
            localStorage.getItem("location-box-fit.selectedLocationId") ?? '""',
          ),
          lines: [],
        };
        orders.push(order);
      }
      order.lines.push({
        id: crypto.randomUUID(),
        skuId: sku?.id ?? `missing:${code}`,
        quantity,
        mode: "units",
      });
    }
    return { skus, orders, imported: skus.length > 0 || orders.length > 0 };
  } catch {
    return { skus: [], orders: [], imported: false };
  }
}
