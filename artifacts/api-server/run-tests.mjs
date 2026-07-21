// Bundles src/tests/*.test.ts with esbuild (same toolchain as the server build)
// and runs them with the built-in node:test runner. No extra test framework.
import { build } from "esbuild";
import { readdirSync, mkdirSync, rmSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(fileURLToPath(import.meta.url));
const testDir = path.join(root, "src", "tests");
const outDir = path.join(root, "dist-tests");

rmSync(outDir, { recursive: true, force: true });
mkdirSync(outDir, { recursive: true });

const entries = readdirSync(testDir)
  .filter((f) => f.endsWith(".test.ts"))
  .map((f) => path.join(testDir, f));

await build({
  entryPoints: entries,
  outdir: outDir,
  bundle: true,
  format: "esm",
  platform: "node",
  outExtension: { ".js": ".mjs" },
  logLevel: "silent",
  // CJS deps (pino) use dynamic require; provide it in the ESM bundle
  banner: { js: "import { createRequire as __cr } from 'node:module'; const require = __cr(import.meta.url);" },
});

const bundled = readdirSync(outDir)
  .filter((f) => f.endsWith(".mjs"))
  .map((f) => path.join(outDir, f));

const result = spawnSync(process.execPath, ["--test", ...bundled], { stdio: "inherit" });
process.exit(result.status ?? 1);
