import { jsPDF } from "jspdf";
import type { Order, Sku } from "../types";
import type { PackedBox, PalletEstimateResult } from "../types/packing";
import { packingMethods, resolvePackingMode } from "./packingMethods";
import { boxBase, loadingStages, unitsInBox } from "./loadingInstructions";

const palette = ["#bfdbfe", "#a7f3d0", "#fde68a", "#ddd6fe", "#fecaca", "#a5f3fc", "#fed7aa", "#fbcfe8"];
const n = (value: number) => Number(value.toFixed(3)).toString();
// Standard PDF fonts do not contain every Unicode glyph. Normalize common input punctuation.
const text = (value: string) => value.replace(/[–—]/g, "-").replace(/[’‘]/g, "'").replace(/[“”]/g, '"').replace(/×/g, "x");

export function createOrderPlanPdf(plan: PalletEstimateResult, order: Order, skus: Sku[]) {
  const doc = new jsPDF({ compress: true });
  const noun = plan.palletType.locationKind === "cage" ? "Cage" : "Pallet";
  const type = plan.palletType;
  const skuIndex = new Map(plan.skus.map((sku, index) => [sku.sku, index]));
  const alias = (sku: string) => `S${(skuIndex.get(sku) ?? 0) + 1}`;
  const color = (sku: string) => palette[(skuIndex.get(sku) ?? 0) % palette.length];
  const description = (code: string) => {
    const sku = skus.find((item) => item.code.trim().toUpperCase() === code);
    return order.lines.find((line) => line.skuId === sku?.id && line.description)?.description ?? sku?.description ?? "";
  };
  const wrapped = (value: string, width: number) => doc.splitTextToSize(text(value), width) as string[];
  let y = 0;
  let pageTitle = "Order overview";
  const page = (title: string, first = false) => {
    if (!first) doc.addPage();
    pageTitle = title;
    doc.setFillColor("#0f172a").rect(0, 0, 210, 30, "F");
    doc.setTextColor("#ffffff").setFont("helvetica", "bold").setFontSize(17);
    doc.text(title, 14, 13);
    doc.setFont("helvetica", "normal").setFontSize(9);
    const name = text(order.name || "Untitled order");
    let shortName = name;
    while (doc.getTextWidth(shortName) > 178) shortName = shortName.slice(0, -1);
    doc.text(shortName === name ? name : `${shortName.slice(0, -3)}...`, 14, 23);
    doc.setTextColor("#0f172a");
    y = 40;
  };
  const ensure = (height: number) => {
    if (y + height > 274) page(`${pageTitle.replace(/ - continued$/, "")} - continued`);
  };
  const paragraph = (value: string, size = 10, bold = false) => {
    doc.setFont("helvetica", bold ? "bold" : "normal").setFontSize(size);
    for (const line of wrapped(value, 182)) {
      ensure(5.2);
      doc.setFont("helvetica", bold ? "bold" : "normal").setFontSize(size);
      doc.text(line, 14, y);
      y += 5.2;
    }
    y += 3;
  };
  const table = (headers: string[], rows: string[][], widths: number[]) => {
    const header = () => {
      doc.setFillColor("#e2e8f0").rect(14, y - 4, 182, 8, "F");
      doc.setFont("helvetica", "bold").setFontSize(8);
      let x = 16;
      headers.forEach((h, i) => { doc.text(h, x, y + 1); x += widths[i]; });
      y += 9;
    };
    ensure(18); header();
    for (const row of rows) {
      doc.setFont("helvetica", "normal").setFontSize(8);
      const cells = row.map((cell, i) => wrapped(cell, widths[i] - 4));
      const lines = Math.max(...cells.map((cell) => cell.length));
      // Split unusually long descriptions across pages rather than clipping them.
      for (let offset = 0; offset < lines;) {
        if (y + 6 > 274) { page(`${pageTitle.replace(/ - continued$/, "")} - continued`); header(); }
        const take = Math.min(lines - offset, Math.max(1, Math.floor((272 - y) / 4)));
        doc.setFont("helvetica", "normal").setFontSize(8);
        let x = 16;
        cells.forEach((cell, i) => {
          const part = cell.slice(offset, offset + take);
          if (part.length) doc.text(part, x, y, { lineHeightFactor: 1.42 });
          x += widths[i];
        });
        y += take * 4 + 3;
        doc.setDrawColor("#e2e8f0").setLineWidth(0.2).line(14, y - 2, 196, y - 2);
        offset += take;
      }
    }
    y += 4;
  };

  page("Order loading plan", true);
  paragraph(order.name || "Untitled order", 13, true);
  paragraph(`${type.displayLabel ?? noun} | ${type.name}`);
  paragraph(`Usable space: ${n(type.width)} W x ${n(type.depth)} D x ${n(type.height)} H cm. Height starts above the base.`);
  paragraph(`${plan.pallets.length} ${noun.toLowerCase()}s | ${plan.pallets.reduce((sum, p) => sum + p.boxes.length, 0)} boxes packed / ${plan.totalBoxes} required | ${plan.totalOrderQuantity} units ordered`, 12, true);
  paragraph(`Selected: ${packingMethods[resolvePackingMode(order.packingMode)].label}. Layout: ${packingMethods[plan.packingMethod].label}.`);
  if (plan.oversizedSkus.length) {
    paragraph("INCOMPLETE ORDER - the following SKUs cannot fit this location:", 11, true);
    paragraph(plan.oversizedSkus.map((sku) => `${sku.sku} (${sku.boxesRequired} boxes / ${sku.orderQuantity} units)`).join("; "));
  }
  paragraph("How to follow this plan", 12, true);
  paragraph(`1. Label each ${noun.toLowerCase()} with its number below. Check its contents list before loading.`);
  paragraph("2. Follow numbered steps in ascending order, from the lowest base height upwards. Complete each stage before starting the next.");
  paragraph("3. In the top view, FRONT is at the bottom and BACK at the top. Positions measure from the front-left corner; height measures from the deck. Rotate each box to its listed W x D x H.");
  paragraph("Diagrams show calculated positions. Labels are step numbers; S1, S2, etc. identify SKUs. P marks a partial box, which still uses a full box footprint. Grey boxes provide context.");
  paragraph("Geometry estimate: check load weight, box strength and permitted rotations before loading. These properties are not configured in this planner.", 9);
  table([noun, "Boxes", "Units", "Contents"], plan.pallets.map((pallet) => [
    String(pallet.index), String(pallet.boxes.length), String(pallet.boxes.reduce((sum, box) => sum + unitsInBox(box, plan), 0)),
    pallet.lines.map((line) => `${line.sku}: ${line.boxes}`).join("; "),
  ]), [18, 18, 20, 126]);

  // Vector diagrams stay sharp when printed, with the same geometry as the 3D view.
  const diagram = (boxes: PackedBox[], selected: Map<string, number>, base: number, frontView: boolean, x: number, top: number, width: number, height: number, complete = false) => {
    const vertical = frontView ? type.height : type.depth;
    const scale = Math.min(width / type.width, height / vertical);
    const w = type.width * scale, h = vertical * scale;
    const left = x + (width - w) / 2, bottom = top + height;
    doc.setFillColor("#f8fafc").setDrawColor("#64748b").rect(left, bottom - h, w, h, "FD");
    const visible = frontView ? [...boxes].sort((a, b) => b.z - a.z)
      : complete ? [...boxes].sort((a, b) => boxBase(a) - boxBase(b))
      : boxes.filter((box) => boxBase(box) <= base + 0.00001 && box.y + box.height / 2 > base + 0.00001);
    for (const box of visible) {
      const step = selected.get(box.id);
      const bx = left + (box.x - box.width / 2) * scale;
      const by = bottom - (frontView ? box.y + box.height / 2 : box.z + box.depth / 2) * scale;
      const bw = box.width * scale, bh = (frontView ? box.height : box.depth) * scale;
      doc.setFillColor(step ? color(box.sku) : "#e2e8f0").setDrawColor(step ? "#334155" : "#94a3b8").setLineWidth(step ? 0.3 : 0.15).rect(bx, by, bw, bh, "FD");
      if (step && !frontView && !complete) {
        const label = `${step}${box.isPartial ? "P" : ""}`;
        const size = Math.min(8, bh * 1.2, bw * 2 / label.length);
        if (size >= 4) {
          doc.setFont("helvetica", "bold").setFontSize(size).setTextColor("#0f172a");
          doc.text(label, bx + bw / 2, by + bh / 2 + size * 0.12, { align: "center" });
        }
      }
    }
    doc.setDrawColor("#0f172a").setLineWidth(0.35).rect(left, bottom - h, w, h);
    doc.setFont("helvetica", "normal").setFontSize(7).setTextColor("#334155");
    doc.text(frontView ? `FRONT ELEVATION - ${n(type.height)} cm high` : `FRONT - width ${n(type.width)} cm`, left + w / 2, bottom + 5, { align: "center" });
    if (!frontView) doc.text(`BACK - depth ${n(type.depth)} cm`, left + w / 2, bottom - h - 3, { align: "center" });
  };

  for (const pallet of plan.pallets) {
    page(`${noun} ${pallet.index} - contents`);
    paragraph(`${type.displayLabel ?? noun} | ${pallet.boxes.length} boxes | ${n(Math.max(...pallet.boxes.map((box) => box.y + box.height / 2)))} cm load height`, 12, true);
    paragraph(`Label: ${order.name || "Order"} / ${noun} ${pallet.index}. Load steps run from 1 to ${pallet.boxes.length}.`);
    table(["Key / SKU / Description", "Full", "Partial", "Units"], pallet.lines.map((line) => {
      const boxes = pallet.boxes.filter((box) => box.sku === line.sku);
      return [`${alias(line.sku)} | ${line.sku}\n${description(line.sku)}`, String(line.boxes - line.partialBoxes), String(line.partialBoxes), String(boxes.reduce((sum, box) => sum + unitsInBox(box, plan), 0))];
    }), [122, 18, 20, 22]);
    paragraph("Read the following placement sheets in order. Different box heights can create different starting elevations; these are stages, not necessarily uniform layers.");
    const stages = loadingStages(pallet);
    ensure(120);
    paragraph("Completed load - top and front views", 11, true);
    const allSteps = new Map(stages.flatMap(stage => stage.steps).map(({ box, step }) => [box.id, step]));
    diagram(pallet.boxes, allSteps, 0, false, 14, y + 8, 86, 80, true);
    diagram(pallet.boxes, allSteps, 0, true, 110, y + 8, 86, 80, true);
    y += 100;
    paragraph("The top view shows the uppermost boxes. Follow the stage sheets for numbered placements, including boxes hidden in these views.", 8);
    for (const [stageIndex, stage] of stages.entries()) {
      for (let offset = 0; offset < stage.steps.length; offset += 15) {
        const batch = stage.steps.slice(offset, offset + 15);
        page(`${noun} ${pallet.index} - stage ${stageIndex + 1} of ${stages.length}`);
        paragraph(`Base height ${n(stage.base)} cm | Place boxes ${batch[0].step}-${batch[batch.length - 1].step}`, 12, true);
        const selected = new Map(batch.map(({ box, step }) => [box.id, step]));
        diagram(pallet.boxes, selected, stage.base, false, 14, 57, 86, 67);
        diagram(pallet.boxes, selected, stage.base, true, 110, 57, 86, 67);
        y = 140;
        paragraph("Top view: numbered boxes are this sheet's steps. Front view: nearer boxes may hide boxes behind. Use the coordinates below for exact placement.", 8);
        table(["Step", "SKU key", "Units", "Left / Front / Base (cm)", "W x D x H (cm)"], batch.map(({ box, step, left, front, base }) => [
          `${step}${box.isPartial ? " P" : ""}`, alias(box.sku), String(unitsInBox(box, plan)), `${n(left)} / ${n(front)} / ${n(base)}`, `${n(box.width)} x ${n(box.depth)} x ${n(box.height)}`,
        ]), [16, 20, 16, 69, 61]);
      }
    }
  }
  const pages = doc.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    doc.setDrawColor("#cbd5e1").line(14, 282, 196, 282);
    doc.setFont("helvetica", "normal").setFontSize(8).setTextColor("#64748b");
    doc.text("LOCATION FIT  |  Loading plan  |  Dimensions in cm", 14, 288);
    doc.text(`${i} / ${pages}`, 196, 288, { align: "right" });
  }
  return doc;
}

export function orderPlanFilename(order: Order) {
  const name = (order.name || "order").replace(/[^a-zA-Z0-9_-]+/g, "-").slice(0, 70);
  return `${name}-loading-plan.pdf`;
}
