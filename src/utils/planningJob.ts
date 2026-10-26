import type { PlannerRequest, PlannerResponse } from "../types/plannerWorker";

export interface PlanningWorker {
  onmessage: ((event: MessageEvent<PlannerResponse>) => void) | null;
  onerror: ((event: ErrorEvent) => void) | null;
  postMessage: (input: PlannerRequest) => void;
  terminate: () => void;
}

/** One calculation owns one worker. Cancellation and completion both release it. */
export function startPlanningJob(
  worker: PlanningWorker,
  input: PlannerRequest,
  onComplete: (response: PlannerResponse) => void,
) {
  let active = true;
  const cancel = () => {
    if (!active) return;
    active = false;
    worker.onmessage = null;
    worker.onerror = null;
    worker.terminate();
  };
  const finish = (response: PlannerResponse) => {
    if (!active) return;
    cancel();
    onComplete(response);
  };
  worker.onmessage = (event) => finish(event.data);
  worker.onerror = () =>
    finish({
      ok: false,
      error: "Unable to calculate this plan. Check the order and try again.",
    });
  try {
    worker.postMessage(input);
  } catch {
    finish({
      ok: false,
      error: "Unable to start the calculation. Please try again.",
    });
  }
  return cancel;
}
