import { useLayoutEffect, useMemo, useRef, useState } from "react";
import type { Location, Order, Sku } from "../types";
import { orderPlanSignature } from "../utils/savedOrders";
import { resolvePackingMode } from "../utils/packingMethods";
import { startPlanningJob } from "../utils/planningJob";

export function useOrderCalculation(
  order: Order | undefined,
  skus: Sku[],
  location: Location | null,
  onPlanReady: (source: Order, plan: NonNullable<Order["savedPlan"]>) => void,
) {
  const signature = useMemo(
    () => (order && location ? orderPlanSignature(order, skus, location) : ""),
    [order, skus, location],
  );
  const savedPlan =
    signature && order?.savedPlan?.signature === signature
      ? order.savedPlan.result
      : null;
  const [operation, setOperation] = useState({
    signature: "",
    busy: false,
    error: "",
  });
  const cancelJob = useRef<(() => void) | null>(null);

  // Cancel before new inputs become interactive, including navigation and unmount.
  useLayoutEffect(
    () => () => {
      cancelJob.current?.();
      cancelJob.current = null;
    },
    [signature],
  );

  const cancel = () => {
    cancelJob.current?.();
    cancelJob.current = null;
    setOperation({ signature, busy: false, error: "" });
  };
  const calculate = () => {
    if (!order || !location) return;
    cancelJob.current?.();
    setOperation({ signature, busy: true, error: "" });
    try {
      const inputOrder = {
        id: order.id,
        name: order.name,
        locationId: order.locationId,
        lines: order.lines,
        packingMode: order.packingMode,
      };
      const worker = new Worker(
        new URL("../workers/planner.worker.ts", import.meta.url),
        { type: "module" },
      );
      cancelJob.current = startPlanningJob(
        worker,
        {
          order: inputOrder,
          skus,
          location,
          mode: resolvePackingMode(order.packingMode),
        },
        (response) => {
          setOperation({
            signature,
            busy: false,
            error: response.ok ? "" : response.error,
          });
          if (response.ok)
            onPlanReady(order, {
              signature,
              calculatedAt: new Date().toISOString(),
              result: response.result,
            });
        },
      );
    } catch {
      setOperation({
        signature,
        busy: false,
        error: "Unable to start the calculation. Please try again.",
      });
    }
  };
  const busy = operation.signature === signature && operation.busy;
  return {
    plan: busy ? null : savedPlan,
    busy,
    error: operation.signature === signature ? operation.error : "",
    calculate,
    cancel,
  };
}
