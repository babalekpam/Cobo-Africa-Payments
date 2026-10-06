// Wrong-secret counters with lockout (passwords, USSD PINs, alias verification codes), stored in
// Postgres so every API instance — and a restarted one — enforces the same limit.
// MAX_ATTEMPTS wrong answers lock the key for LOCKOUT_MINUTES; failures older than that are forgotten.
import { eq, sql } from "drizzle-orm";
import { db, authLockoutsTable } from "@workspace/db";

export const MAX_ATTEMPTS = 5;
export const LOCKOUT_MINUTES = 15;
const LOCK = sql.raw(`interval '${LOCKOUT_MINUTES} minutes'`);

export async function isLockedOut(key: string): Promise<boolean> {
  const [row] = await db
    .select({ locked: sql<boolean>`${authLockoutsTable.lockedUntil} IS NOT NULL AND ${authLockoutsTable.lockedUntil} > now()` })
    .from(authLockoutsTable)
    .where(eq(authLockoutsTable.key, key));
  return Boolean(row?.locked);
}

/** Atomically counts one wrong answer (safe under concurrent attempts on several instances). */
export async function recordFailedAttempt(key: string): Promise<{ locked: boolean; remaining: number }> {
  // Failures carried forward: none if the previous lock has expired or the last failure is stale.
  const base = sql`CASE
      WHEN auth_lockouts.locked_until IS NOT NULL AND auth_lockouts.locked_until <= now() THEN 0
      WHEN auth_lockouts.locked_until IS NULL AND auth_lockouts.updated_at < now() - ${LOCK} THEN 0
      ELSE auth_lockouts.failures END`;
  const result = await db.execute(sql`
    INSERT INTO auth_lockouts (key, failures, locked_until, updated_at)
    VALUES (${key}, 1, CASE WHEN 1 >= ${MAX_ATTEMPTS} THEN now() + ${LOCK} ELSE NULL END, now())
    ON CONFLICT (key) DO UPDATE SET
      failures = CASE WHEN ${base} + 1 >= ${MAX_ATTEMPTS} THEN 0 ELSE ${base} + 1 END,
      locked_until = CASE
        WHEN ${base} + 1 >= ${MAX_ATTEMPTS} THEN now() + ${LOCK}
        WHEN auth_lockouts.locked_until <= now() THEN NULL
        ELSE auth_lockouts.locked_until END,
      updated_at = now()
    RETURNING failures, (locked_until IS NOT NULL AND locked_until > now()) AS locked`);
  const row = result.rows[0] as { failures: number; locked: boolean };
  return row.locked ? { locked: true, remaining: 0 } : { locked: false, remaining: MAX_ATTEMPTS - Number(row.failures) };
}

export async function clearAttempts(key: string): Promise<void> {
  await db.delete(authLockoutsTable).where(eq(authLockoutsTable.key, key));
}
