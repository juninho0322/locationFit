import { build } from "esbuild";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
const directory = await mkdtemp(join(tmpdir(), "location-fit-tests-"));
try {
  const entries = [
    "tests/planning.test.ts",
    "tests/csv-viewport.test.ts",
    "tests/location-rules.test.ts",
    "tests/loading-plan.test.ts",
    "tests/saved-orders.test.ts",
    "tests/code-quality.test.ts",
  ];
  await build({
    entryPoints: entries,
    bundle: true,
    jsx: "automatic",
    platform: "node",
    format: "cjs",
    outdir: directory,
    outExtension: { ".js": ".cjs" },
  });
  const result = spawnSync(
    process.execPath,
    [
      "--test",
      ...entries.map((entry) =>
        join(directory, entry.split("/").pop().replace(/\.ts$/, ".cjs")),
      ),
    ],
    {
      stdio: "inherit",
    },
  );
  process.exitCode = result.status ?? 1;
} finally {
  await rm(directory, { recursive: true, force: true });
}
