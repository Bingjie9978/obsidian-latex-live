// Bundle each tests/*.test.ts with esbuild and run them with node:test.
// Output goes under node_modules/.cache so externals (jsdom) resolve from
// this repository's node_modules. "obsidian" resolves to a test stand-in
// (tests/support/obsidian.ts). Pass test file names to run a subset.
import { build } from "esbuild";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readdirSync, rmSync } from "node:fs";
import { join, resolve } from "node:path";

const wanted = process.argv.slice(2).map((f) => f.replace(/^tests\//, ""));
const files = readdirSync("tests")
  .filter((f) => f.endsWith(".test.ts"))
  .filter((f) => !wanted.length || wanted.includes(f));
const cache = resolve("node_modules/.cache/test-build");
mkdirSync(cache, { recursive: true });
// A subset run and the full suite must never delete one another's bundles.
const outdir = mkdtempSync(join(cache, "run-"));
try {
  await build({
    entryPoints: files.map((f) => join("tests", f)),
    outdir,
    bundle: true,
    platform: "node",
    format: "cjs",
    target: "node20",
    outExtension: { ".js": ".cjs" },
    external: ["jsdom"],
    alias: { obsidian: resolve("tests/support/obsidian.ts") },
    logLevel: "warning",
  });
  // Each integration file can spawn TeX, biber and rendering processes. Keep
  // their resource use bounded so timer tests also run on ordinary CI hosts.
  const res = spawnSync(
    process.execPath,
    ["--test", "--test-concurrency=2", ...files.map((f) => join(outdir, f.replace(/\.ts$/, ".cjs")))],
    { stdio: "inherit" },
  );
  process.exitCode = res.status ?? 1;
} finally {
  rmSync(outdir, { recursive: true, force: true });
}
