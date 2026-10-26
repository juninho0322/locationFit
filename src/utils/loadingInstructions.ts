import type { PackedBox, PackedPallet, PalletEstimateResult } from "../types/packing";

const rounded = (n: number) => Math.round(n * 100000) / 100000;
export const boxBase = (box: PackedBox) => rounded(box.y - box.height / 2);

export function loadingSteps(pallet: PackedPallet) {
  return [...pallet.boxes]
    .sort((a, b) => boxBase(a) - boxBase(b) || b.z - a.z || a.x - b.x || a.id.localeCompare(b.id))
    .map((box, index) => ({
      box,
      step: index + 1,
      left: rounded(box.x - box.width / 2),
      front: rounded(box.z - box.depth / 2),
      base: boxBase(box),
    }));
}

export function loadingStages(pallet: PackedPallet) {
  const stages: Array<{ base: number; steps: ReturnType<typeof loadingSteps> }> = [];
  for (const step of loadingSteps(pallet)) {
    const previous = stages[stages.length - 1];
    if (previous && Math.abs(previous.base - step.base) < 0.00001) previous.steps.push(step);
    else stages.push({ base: step.base, steps: [step] });
  }
  return stages;
}

export function unitsInBox(box: PackedBox, plan: PalletEstimateResult) {
  const sku = plan.skus.find((item) => item.sku === box.sku);
  if (!sku) return 0;
  return box.isPartial ? sku.orderQuantity - sku.fullBoxes * sku.ratio : sku.ratio;
}
