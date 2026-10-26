import assert from "node:assert/strict";
import test from "node:test";
import {
  startPlanningJob,
  type PlanningWorker,
} from "../src/utils/planningJob";
import type {
  PlannerRequest,
  PlannerResponse,
} from "../src/types/plannerWorker";
import {
  exampleLocation,
  exampleOrder,
  examplePlan,
  exampleSkus,
} from "./fixtures/orderPlan";
import {
  attachCalculatedPlan,
  orderPlanSignature,
} from "../src/utils/savedOrders";
import {
  isLocations,
  isOrders,
  isSkus,
} from "../src/utils/workspaceValidation";
import { readLocalValue } from "../src/utils/localStorage";
import { calculateOrderPlan, summarizeOrder } from "../src/utils/planning";

const request: PlannerRequest = {
  order: exampleOrder,
  skus: exampleSkus,
  location: exampleLocation,
  mode: "auto",
};
const result = examplePlan();
const savedPlan = {
  signature: orderPlanSignature(exampleOrder, exampleSkus, exampleLocation),
  calculatedAt: "2026-10-26T12:00:00Z",
  result,
};
class FakeWorker implements PlanningWorker {
  onmessage: PlanningWorker["onmessage"] = null;
  onerror: PlanningWorker["onerror"] = null;
  sent: PlannerRequest | null = null;
  terminated = 0;
  postMessage(input: PlannerRequest) {
    this.sent = input;
  }
  terminate() {
    this.terminated++;
  }
}
const message = (data: PlannerResponse) =>
  ({ data }) as MessageEvent<PlannerResponse>;

test("a completed worker delivers once, detaches handlers and releases resources", () => {
  const worker = new FakeWorker();
  const responses: PlannerResponse[] = [];
  const cancel = startPlanningJob(worker, request, (response) =>
    responses.push(response),
  );
  assert.equal(worker.sent, request);
  const queued = worker.onmessage!;
  queued(message({ ok: true, result }));
  queued(message({ ok: true, result }));
  cancel();
  assert.equal(responses.length, 1);
  assert.equal(worker.terminated, 1);
  assert.equal(worker.onmessage, null);
  assert.equal(worker.onerror, null);
});
test("cancelling a worker ignores already queued successes and failures", () => {
  const worker = new FakeWorker();
  const responses: PlannerResponse[] = [];
  const cancel = startPlanningJob(worker, request, (response) =>
    responses.push(response),
  );
  const queuedMessage = worker.onmessage!;
  const queuedError = worker.onerror!;
  cancel();
  cancel();
  queuedMessage(message({ ok: true, result }));
  queuedError({} as ErrorEvent);
  assert.equal(responses.length, 0);
  assert.equal(worker.terminated, 1);
});
test("worker startup, runtime and calculation failures finish without leaving work running", () => {
  for (const failure of ["startup", "runtime", "calculation"]) {
    const worker = new FakeWorker();
    const responses: PlannerResponse[] = [];
    if (failure === "startup")
      worker.postMessage = () => {
        throw new Error("Cannot clone input");
      };
    startPlanningJob(worker, request, (response) => responses.push(response));
    if (failure === "runtime") worker.onerror!({} as ErrorEvent);
    if (failure === "calculation")
      worker.onmessage!(message({ ok: false, error: "Case does not fit" }));
    assert.equal(responses.length, 1);
    assert.equal(responses[0].ok, false);
    assert.equal(worker.terminated, 1);
  }
});
test("a completed calculation cannot overwrite a newer order edit", () => {
  const updated = { ...exampleOrder, lines: exampleOrder.lines.slice(1) };
  assert.equal(attachCalculatedPlan(updated, exampleOrder, savedPlan), updated);
  const attached = attachCalculatedPlan(exampleOrder, exampleOrder, savedPlan);
  assert.equal(attached.savedPlan, savedPlan);
  assert.equal(attached.updatedAt, savedPlan.calculatedAt);
  assert.equal(exampleOrder.savedPlan, undefined);
});
test("stored records validate nested fields while retaining legacy locations and unfinished order inputs", () => {
  assert.ok(
    isLocations([
      { id: "legacy", name: "Shelf", width: 10, depth: 20, height: 30 },
    ]),
  );
  assert.ok(isSkus(exampleSkus));
  assert.ok(isOrders([{ ...exampleOrder, savedPlan }]));
  assert.ok(
    isOrders([
      {
        ...exampleOrder,
        lines: [{ id: "draft", skuId: "missing", quantity: 0, mode: "units" }],
      },
    ]),
  );
  assert.equal(isOrders([{}]), false);
  assert.equal(isOrders([{ ...exampleOrder, lines: [null] }]), false);
  assert.equal(
    isOrders([
      {
        ...exampleOrder,
        savedPlan: { ...savedPlan, result: { ...result, pallets: [{}] } },
      },
    ]),
    false,
  );
  assert.equal(isOrders([exampleOrder, exampleOrder]), false);
  assert.equal(isSkus([{ ...exampleSkus[0], code: 123 }]), false);
  assert.equal(isLocations([{ ...exampleLocation, width: null }]), false);
});
test("invalid nested browser records are reported without modifying the original storage", () => {
  const raw = JSON.stringify([{ ...exampleOrder, lines: [{ skuId: 42 }] }]);
  const restored = readLocalValue(
    { getItem: () => raw },
    "orders",
    [],
    isOrders,
  );
  assert.equal(restored.error, "read-error");
  assert.deepEqual(restored.value, []);
});
test("order-wide unit overflow is rejected even when each SKU quantity is safe", () => {
  const skus = exampleSkus.map((sku) => ({
    ...sku,
    unitsPerCase: Number.MAX_SAFE_INTEGER,
  }));
  const order = {
    ...exampleOrder,
    lines: skus.map((sku) => ({
      id: sku.id,
      skuId: sku.id,
      mode: "cases" as const,
      quantity: 1,
    })),
  };
  assert.match(
    summarizeOrder(order, skus).errors.join(" "),
    /totals are too large/,
  );
  assert.throws(
    () => calculateOrderPlan(order, skus, exampleLocation, "auto"),
    /totals are too large/,
  );
});
