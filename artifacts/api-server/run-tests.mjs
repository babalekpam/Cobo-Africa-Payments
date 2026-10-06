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

// `pnpm test` runs the pure unit suites; `pnpm test:integration` (DATABASE_URL required)
// runs the *.int.test.ts suites that exercise the money path against a real Postgres.
const integration = process.argv.includes("--integration");
if (integration && !process.env.DATABASE_URL) {
  console.error("Integration tests need DATABASE_URL pointing at a disposable Postgres (tables are truncated).");
  process.exit(2);
}
const entries = readdirSync(testDir)
  .filter((f) => f.endsWith(".test.ts") && f.endsWith(".int.test.ts") === integration)
  .map((f) => path.join(testDir, f));

await build({
  entryPoints: entries,
  outdir: outDir,
  bundle: true,
  format: "esm",
  platform: "node",
  outExtension: { ".js": ".mjs" },
  logLevel: "silent",
  // Same shims as the production build (build.mjs): CJS deps (pino, express) expect
  // require/__dirname/__filename in the ESM bundle. The integration suites import the real app.
  external: ["*.node", "sharp", "better-sqlite3", "sqlite3", "canvas", "bcrypt", "argon2", "fsevents", "re2", "farmhash", "xxhash-addon", "bufferutil", "utf-8-validate", "ssh2", "cpu-features", "dtrace-provider", "isolated-vm", "electron"],
  banner: {
    js: [
      "import { createRequire as __bannerCrReq } from 'node:module';",
      "import __bannerPath from 'node:path';",
      "import __bannerUrl from 'node:url';",
      "globalThis.require = __bannerCrReq(import.meta.url);",
      "globalThis.__filename = __bannerUrl.fileURLToPath(import.meta.url);",
      "globalThis.__dirname = __bannerPath.dirname(globalThis.__filename);",
    ].join("\n"),
  },
});

const bundled = readdirSync(outDir)
  .filter((f) => f.endsWith(".mjs"))
  .map((f) => path.join(outDir, f));

// The app keeps a few interval timers alive (FX refresh); integration runs must force-exit.
const flags = integration ? ["--test-force-exit", "--test-concurrency=1"] : [];
const result = spawnSync(process.execPath, ["--test", ...flags, ...bundled], { stdio: "inherit" });
process.exit(result.status ?? 1);
