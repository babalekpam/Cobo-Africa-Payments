// `node dist/bootstrap.mjs` — first-run setup for a fresh deployment (run after the schema is
// applied). Reads ADMIN_EMAIL, ADMIN_PASSWORD and optional ADMIN_NAME. Safe to run on every
// start: it never changes an existing administrator.

import { pool } from "@workspace/db";
import { bootstrapOperator } from "./lib/bootstrapOperator";
import { logger } from "./lib/logger";

async function main(): Promise<void> {
  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;
  if (!email || !password) {
    logger.error("ADMIN_EMAIL and ADMIN_PASSWORD are required for first-run bootstrap");
    process.exitCode = 1;
    return;
  }
  const result = await bootstrapOperator({ email, password, name: process.env.ADMIN_NAME });
  logger.info({ adminCreated: result.adminCreated }, result.adminCreated ? "Administrator created" : "Administrator already exists; nothing changed");
}

main()
  .catch((err) => {
    logger.error({ err: err instanceof Error ? err.message : err }, "Bootstrap failed");
    process.exitCode = 1;
  })
  .finally(() => pool.end());
