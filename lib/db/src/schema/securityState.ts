import { pgTable, text, timestamp, integer, jsonb } from "drizzle-orm/pg-core";

// Security state that must be shared by EVERY API instance (it used to live in one process's memory,
// so a second instance — or a restart — silently reset it).

// Request counters behind the rate limiters (one row per limiter + client key per window).
export const rateLimitCountersTable = pgTable("rate_limit_counters", {
  key: text("key").primaryKey(),
  hits: integer("hits").notNull().default(0),
  resetAt: timestamp("reset_at", { withTimezone: true }).notNull(),
});

// Wrong-secret counters with lockout: passwords, USSD PINs, alias verification codes.
export const authLockoutsTable = pgTable("auth_lockouts", {
  key: text("key").primaryKey(),
  failures: integer("failures").notNull().default(0),
  lockedUntil: timestamp("locked_until", { withTimezone: true }),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

// Idempotency-Key ledger for client POSTs: a retried request replays the first response instead of
// running twice; a concurrent duplicate is refused while the first is still in flight.
export const idempotencyRecordsTable = pgTable("idempotency_records", {
  key: text("key").primaryKey(),
  bodyHash: text("body_hash").notNull(),
  state: text("state").notNull(), // pending | done
  statusCode: integer("status_code"),
  response: jsonb("response"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
