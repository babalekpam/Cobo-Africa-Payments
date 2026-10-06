// Wallet money movements, done the only safe way: each one is a single conditional UPDATE that the
// database applies atomically. Never read a balance, do arithmetic in JavaScript and write it back —
// two concurrent requests would both "see" the same balance and money is created or lost.
//
// All amounts are exact cents (wallets are numeric(15,2)): parseAmount refuses anything else, and
// arithmetic happens in Postgres numeric, never in floating point.
import { and, eq, gte, sql } from "drizzle-orm";
import { db, walletsTable } from "@workspace/db";

/** The transaction handle drizzle passes to db.transaction(cb), or db itself. */
export type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0] | typeof db;

const MAX_AMOUNT = 1_000_000_000; // far above any real single payment; guards numeric overflow

/** A positive amount with at most 2 decimals, as a canonical string ("12.50"), or null. */
export function parseAmount(input: unknown): string | null {
  const n = typeof input === "string" && input.trim() !== "" ? Number(input) : typeof input === "number" ? input : NaN;
  if (!Number.isFinite(n) || n < 0.01 || n > MAX_AMOUNT) return null;
  if (Math.round(n * 100) / 100 !== n) return null;
  return n.toFixed(2);
}

/** Rounds a computed amount (fee, FX conversion) to cents, half away from zero. */
export function toCents(n: number): string {
  return (Math.round((n + Number.EPSILON) * 100) / 100).toFixed(2);
}

export function addAmounts(...xs: string[]): string {
  return toCents(xs.reduce((s, x) => s + Number(x), 0));
}

/** Debit available balance; returns false (and changes nothing) if funds are insufficient. */
export async function debit(tx: Tx, walletId: number, amount: string): Promise<boolean> {
  const rows = await tx
    .update(walletsTable)
    .set({ balance: sql`${walletsTable.balance} - ${amount}::numeric` })
    .where(and(eq(walletsTable.id, walletId), gte(walletsTable.balance, amount)))
    .returning({ id: walletsTable.id });
  return rows.length === 1;
}

export async function credit(tx: Tx, walletId: number, amount: string): Promise<void> {
  const rows = await tx
    .update(walletsTable)
    .set({ balance: sql`${walletsTable.balance} + ${amount}::numeric` })
    .where(eq(walletsTable.id, walletId))
    .returning({ id: walletsTable.id });
  if (rows.length !== 1) throw new Error(`credit: wallet ${walletId} not found`);
}

/** Move available -> held (pending payout); false if funds are insufficient. */
export async function hold(tx: Tx, walletId: number, amount: string): Promise<boolean> {
  const rows = await tx
    .update(walletsTable)
    .set({
      balance: sql`${walletsTable.balance} - ${amount}::numeric`,
      lockedBalance: sql`coalesce(${walletsTable.lockedBalance}, 0) + ${amount}::numeric`,
    })
    .where(and(eq(walletsTable.id, walletId), gte(walletsTable.balance, amount)))
    .returning({ id: walletsTable.id });
  return rows.length === 1;
}

/** The held payout went out: the held funds leave the wallet. */
export async function releaseHold(tx: Tx, walletId: number, amount: string): Promise<boolean> {
  const rows = await tx
    .update(walletsTable)
    .set({ lockedBalance: sql`${walletsTable.lockedBalance} - ${amount}::numeric` })
    .where(and(eq(walletsTable.id, walletId), gte(walletsTable.lockedBalance, amount)))
    .returning({ id: walletsTable.id });
  return rows.length === 1;
}

/** The held payout failed: the held funds return to the available balance. */
export async function refundHold(tx: Tx, walletId: number, amount: string): Promise<boolean> {
  const rows = await tx
    .update(walletsTable)
    .set({
      balance: sql`${walletsTable.balance} + ${amount}::numeric`,
      lockedBalance: sql`${walletsTable.lockedBalance} - ${amount}::numeric`,
    })
    .where(and(eq(walletsTable.id, walletId), gte(walletsTable.lockedBalance, amount)))
    .returning({ id: walletsTable.id });
  return rows.length === 1;
}

/** The user's wallet in a currency, created if missing (race-safe: per-user advisory lock, the same
 *  lock the scheme engine uses for wallet creation). */
export async function walletFor(tx: Tx, userId: number, currency: string): Promise<typeof walletsTable.$inferSelect> {
  const [existing] = await tx.select().from(walletsTable).where(and(eq(walletsTable.userId, userId), eq(walletsTable.currency, currency)));
  if (existing) return existing;
  await tx.execute(sql`SELECT pg_advisory_xact_lock(1002, ${userId})`);
  const [again] = await tx.select().from(walletsTable).where(and(eq(walletsTable.userId, userId), eq(walletsTable.currency, currency)));
  if (again) return again;
  const [created] = await tx.insert(walletsTable).values({ userId, currency }).returning();
  return created;
}

export class InsufficientFunds extends Error {
  constructor() {
    super("Insufficient funds");
  }
}
