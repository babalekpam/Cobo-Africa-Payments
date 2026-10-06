import pino from "pino";

const isProduction = process.env.NODE_ENV === "production";

export const logger = pino({
  level: process.env.LOG_LEVEL ?? "info",
  redact: [
    "req.headers.authorization",
    "req.headers.cookie",
    "res.headers['set-cookie']",
  ],
  // No pretty-print worker thread in production (plain JSON) or under test (the worker
  // cannot be resolved from the bundled test files and would die mid-run).
  ...(isProduction || process.env.NODE_ENV === "test"
    ? {}
    : {
        transport: {
          target: "pino-pretty",
          options: { colorize: true },
        },
      }),
});
