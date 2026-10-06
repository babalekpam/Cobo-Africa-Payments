// express-rate-limit store backed by Postgres, so every API instance counts against the SAME limit
// (the default memory store gives each instance — and each restart — its own fresh allowance).
import type { Options, Store, IncrementResponse } from "express-rate-limit";
import { sql } from "drizzle-orm";
import { db } from "@workspace/db";

export class PostgresRateLimitStore implements Store {
  windowMs = 60_000;
  readonly prefix: string;

  constructor(prefix: string) {
    this.prefix = `${prefix}:`;
  }

  init(options: Options): void {
    this.windowMs = options.windowMs;
  }

  async increment(key: string): Promise<IncrementResponse> {
    const window = sql.raw(`interval '${Math.max(1, Math.round(this.windowMs))} milliseconds'`);
    // One atomic upsert: a fresh window starts at 1, an open window counts up.
    const result = await db.execute(sql`
      INSERT INTO rate_limit_counters (key, hits, reset_at) VALUES (${this.prefix + key}, 1, now() + ${window})
      ON CONFLICT (key) DO UPDATE SET
        hits = CASE WHEN rate_limit_counters.reset_at <= now() THEN 1 ELSE rate_limit_counters.hits + 1 END,
        reset_at = CASE WHEN rate_limit_counters.reset_at <= now() THEN now() + ${window} ELSE rate_limit_counters.reset_at END
      RETURNING hits, reset_at`);
    const row = result.rows[0] as { hits: number; reset_at: string | Date };
    if (Math.random() < 0.01) void this.sweep();
    return { totalHits: Number(row.hits), resetTime: new Date(row.reset_at) };
  }

  async decrement(key: string): Promise<void> {
    await db.execute(sql`UPDATE rate_limit_counters SET hits = GREATEST(hits - 1, 0) WHERE key = ${this.prefix + key}`);
  }

  async resetKey(key: string): Promise<void> {
    await db.execute(sql`DELETE FROM rate_limit_counters WHERE key = ${this.prefix + key}`);
  }

  private async sweep(): Promise<void> {
    await db.execute(sql`DELETE FROM rate_limit_counters WHERE reset_at < now() - interval '1 hour'`).catch(() => {});
  }
}

/** The store for a limiter: shared Postgres counters, except in unit/integration tests (each test
 *  run would otherwise inherit the previous run's counters) unless RATE_LIMIT_STORE=postgres. */
export function rateLimitStore(prefix: string): Store | undefined {
  const mode = process.env.RATE_LIMIT_STORE ?? (process.env.NODE_ENV === "test" ? "memory" : "postgres");
  return mode === "memory" ? undefined : new PostgresRateLimitStore(prefix);
}
