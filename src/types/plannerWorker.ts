import type { Location, Order, Sku } from "./index";
import type { PackingMode, PalletEstimateResult } from "./packing";

export interface PlannerRequest {
  order: Omit<Order, "savedPlan">;
  skus: Sku[];
  location: Location;
  mode: PackingMode;
}

export type PlannerResponse =
  | { ok: true; result: PalletEstimateResult }
  | { ok: false; error: string };
