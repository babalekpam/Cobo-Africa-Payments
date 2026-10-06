// KYC-tiered daily sending limits, enforced across every rail (bank, mobile
// money, internal, IAPAY scheme payments) so no channel can bypass compliance.

import { eq, and, gte, sql } from "drizzle-orm";
import { db, transactionsTable, usersTable } from "@workspace/db";

export const KYC_LIMITS: Record<number, number> = { 0: 100, 1: 5000, 2: 50000 };

export interface DailyLimitCheck {
  allowed: boolean;
  message?: string;
  code?: string;
  limit: number;
  sent_today: number;
}

export async function getKycLevel(userId: number): Promise<number> {
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId));
  return Number(user?.kycLevel || 0);
}

type Reader = Pick<typeof db, "select" | "execute">;

export async function sentTodayUSD(userId: number, exec: Reader = db): Promise<number> {
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayTxs = await exec.select().from(transactionsTable).where(
    and(
      eq(transactionsTable.customerId, userId),
      eq(transactionsTable.type, "send"),
      gte(transactionsTable.createdAt, todayStart)
    )
  );
  return todayTxs
    .filter((t) => t.status !== "failed")
    .reduce((s, t) => s + Number(t.amount || 0), 0);
}

export async function checkDailyLimit(userId: number, kycLevel: number, amountUSD: number): Promise<DailyLimitCheck> {
  const limit = KYC_LIMITS[kycLevel] || 100;
  const sentToday = await sentTodayUSD(userId);

  if (sentToday + amountUSD > limit) {
    const remaining = Math.max(0, limit - sentToday);
    return {
      allowed: false,
      message: `Daily limit: $${limit.toLocaleString()}. Sent today: $${sentToday.toLocaleString()}. Remaining: $${remaining.toLocaleString()}.${kycLevel < 2 ? " Complete KYC to increase your limit." : ""}`,
      code: "LIMIT_EXCEEDED",
      limit,
      sent_today: sentToday,
    };
  }
  return { allowed: true, limit, sent_today: sentToday };
}

export class DailyLimitExceeded extends Error {
  constructor(readonly check: DailyLimitCheck) {
    super(check.message || "Daily limit exceeded");
  }
}

/**
 * The atomic form of checkDailyLimit, for use INSIDE the transaction that records the "send": takes
 * a per-customer lock first, so two simultaneous payments are checked one after the other and the
 * second one sees the first. Throws DailyLimitExceeded (rolling the transaction back).
 */
export async function enforceDailyLimit(tx: Reader, userId: number, kycLevel: number, amountUSD: number): Promise<void> {
  await tx.execute(sql`SELECT pg_advisory_xact_lock(1003, ${userId})`);
  const limit = KYC_LIMITS[kycLevel] || 100;
  const sentToday = await sentTodayUSD(userId, tx);
  if (sentToday + amountUSD > limit) {
    const remaining = Math.max(0, limit - sentToday);
    throw new DailyLimitExceeded({
      allowed: false,
      message: `Daily limit: $${limit.toLocaleString()}. Sent today: $${sentToday.toLocaleString()}. Remaining: $${remaining.toLocaleString()}.${kycLevel < 2 ? " Complete KYC to increase your limit." : ""}`,
      code: "LIMIT_EXCEEDED",
      limit,
      sent_today: sentToday,
    });
  }
}
