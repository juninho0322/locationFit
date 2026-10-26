import { calculateOrderPlan } from "../utils/planning";
import type { PlannerRequest, PlannerResponse } from "../types/plannerWorker";
const respond = (response: PlannerResponse) => self.postMessage(response);
self.onmessage = (
  event: MessageEvent<PlannerRequest>,
) => {
  try {
    const { order, skus, location, mode } = event.data;
    respond({
      ok: true,
      result: calculateOrderPlan(order, skus, location, mode),
    });
  } catch (error) {
    respond({
      ok: false,
      error:
        error instanceof Error
          ? error.message
          : "Unable to calculate this order.",
    });
  }
};
