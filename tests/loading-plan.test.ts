import assert from "node:assert/strict";
import test from "node:test";
import { boxBase, loadingStages, loadingSteps, unitsInBox } from "../src/utils/loadingInstructions";
import { createOrderPlanPdf, orderPlanFilename } from "../src/utils/orderPlanPdf";
import { packingMethods, resolvePackingMode } from "../src/utils/packingMethods";
import { exampleOrder, examplePlan, exampleSkus } from "./fixtures/orderPlan";

const plan = examplePlan();
test("placement steps account for every case once and place all supports first", () => {
  for (const pallet of plan.pallets) {
    const before = JSON.stringify(pallet);
    const steps = loadingSteps(pallet);
    assert.equal(steps.length, pallet.boxes.length);
    assert.equal(new Set(steps.map(step => step.box.id)).size, pallet.boxes.length);
    steps.forEach((step, index) => {
      assert.equal(step.step, index + 1);
      assert.ok(Math.abs(step.left + step.box.width / 2 - step.box.x) < 1e-5);
      assert.ok(Math.abs(step.front + step.box.depth / 2 - step.box.z) < 1e-5);
      for (const support of pallet.boxes.filter(box => Math.abs(box.y + box.height / 2 - step.base) < 1e-5)) {
        assert.ok(steps.findIndex(other => other.box.id === support.id) < index);
      }
    });
    const stages = loadingStages(pallet);
    assert.deepEqual(stages.flatMap(stage => stage.steps), steps);
    stages.forEach(stage => stage.steps.forEach(step => assert.equal(boxBase(step.box), stage.base)));
    assert.equal(JSON.stringify(pallet), before);
  }
});
test("per-pallet unit counts include actual partial-case contents", () => {
  const boxes = plan.pallets.flatMap(pallet => pallet.boxes);
  assert.equal(boxes.reduce((sum, box) => sum + unitsInBox(box, plan), 0), 439);
  assert.equal(unitsInBox(boxes.find(box => box.isPartial)!, plan), 1);
});
test("PDF includes a contents sheet and all placement sheets for each pallet", () => {
  const doc = createOrderPlanPdf(plan, exampleOrder, exampleSkus);
  const placements = plan.pallets.flatMap(loadingStages).reduce((sum, stage) => sum + Math.ceil(stage.steps.length / 15), 0);
  assert.equal(doc.getNumberOfPages(), 1 + plan.pallets.length + placements);
  assert.ok(doc.output().startsWith("%PDF-"));
  assert.equal(orderPlanFilename({ ...exampleOrder, name: "1001 / UK" }), "1001-UK-loading-plan.pdf");
});
test("long contents and incomplete orders paginate without throwing", () => {
  const longOrder = { ...exampleOrder, name: "Long order name ".repeat(30) };
  const longSkus = exampleSkus.map(sku => ({ ...sku, description: "Long product description with sizes and packing details. ".repeat(100) }));
  const incomplete = { ...plan, oversizedSkus: [plan.skus[0]] };
  const doc = createOrderPlanPdf(incomplete, longOrder, longSkus);
  assert.ok(doc.getNumberOfPages() > createOrderPlanPdf(plan, exampleOrder, exampleSkus).getNumberOfPages());
});
test("saved method resolution handles legacy orders and invalid stored values", () => {
  assert.equal(resolvePackingMode(undefined), "auto");
  assert.equal(resolvePackingMode("toString"), "auto");
  for (const mode of Object.keys(packingMethods)) assert.equal(resolvePackingMode(mode), mode);
});
