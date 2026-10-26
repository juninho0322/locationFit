import { build } from "esbuild";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createRequire } from "node:module";
const temp = await mkdtemp(join(tmpdir(), "location-fit-pdf-"));
try {
  const bundle = join(temp, "preview.cjs");
  await build({
    stdin: { contents: `export { createOrderPlanPdf } from './src/utils/orderPlanPdf'; export * from './tests/fixtures/orderPlan';`, resolveDir: process.cwd() },
    bundle: true, platform: "node", format: "cjs", outfile: bundle,
  });
  const { createOrderPlanPdf, examplePlan, exampleOrder, exampleSkus } = createRequire(import.meta.url)(bundle);
  const doc = createOrderPlanPdf(examplePlan(), exampleOrder, exampleSkus);
  await mkdir("output/pdf", { recursive: true });
  await writeFile("output/pdf/example-loading-plan.pdf", Buffer.from(doc.output("arraybuffer")));
  console.log(`Created output/pdf/example-loading-plan.pdf (${doc.getNumberOfPages()} pages)`);
} finally {
  await rm(temp, { recursive: true, force: true });
}
