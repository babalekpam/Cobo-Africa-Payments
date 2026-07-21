// KYC-tiered daily sending limits, enforced across every rail (bank, mobile
// money, internal, Afrix scheme payments) so no channel can bypass compliance.

import { eq, and, gte } from "drizzle-orm";
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

export async function sentTodayUSD(userId: number): Promise<number> {
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayTxs = await db.select().from(transactionsTable).where(
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
