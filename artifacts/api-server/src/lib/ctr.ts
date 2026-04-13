import { eq, and, gte } from "drizzle-orm";
import { db, ctrReportsTable, transactionsTable, usersTable } from "@workspace/db";

const CTR_THRESHOLD_USD = 10000;

const USD_RATES: Record<string, number> = {
  USD: 1, EUR: 1.09, GBP: 1.27, NGN: 0.000633, GHS: 0.069, KES: 0.00775,
  ZAR: 0.053, XOF: 0.00161, XAF: 0.00161, TZS: 0.000394, UGX: 0.000267,
  ETB: 0.0174, EGP: 0.0206, RWF: 0.000775, CDF: 0.00036, AOA: 0.0012,
  MZN: 0.0157, BWP: 0.0735, MWK: 0.000581, ZMW: 0.0377, SDG: 0.00166,
  TND: 0.321, DZD: 0.00743, LYD: 0.206, GMD: 0.0148, SLL: 0.0000444,
  GNF: 0.000116, CVE: 0.0098, STN: 0.0431, SCR: 0.0704, MUR: 0.022,
  MGA: 0.000221, KMF: 0.00217, DJF: 0.00563, ERN: 0.0667, SOS: 0.00175,
  SSP: 0.000758, BIF: 0.000348, LSL: 0.053, SZL: 0.053, NAD: 0.053,
  LRD: 0.00521, MRU: 0.0252,
};

export function toUsd(amount: number, currency: string): number {
  const rate = USD_RATES[currency.toUpperCase()] || 1;
  return amount * rate;
}

export async function checkAndCreateCTR(
  userId: number,
  transactionRef: string,
  amount: number,
  currency: string,
  transactionType: string
): Promise<{ ctrTriggered: boolean; ctrId?: number }> {
  const amountUsd = toUsd(amount, currency);

  if (amountUsd >= CTR_THRESHOLD_USD) {
    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId));
    const [ctr] = await db.insert(ctrReportsTable).values({
      userId,
      transactionRef,
      amount: String(amount),
      currency,
      amountUsd: String(amountUsd),
      transactionType,
      triggerType: "single",
      customerName: user ? `${user.firstName || ""} ${user.lastName || ""}`.trim() : undefined,
      customerEmail: user?.email,
      customerCountry: user?.country,
    }).returning();
    return { ctrTriggered: true, ctrId: ctr.id };
  }

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const existingAggregateCTR = await db.select().from(ctrReportsTable).where(
    and(
      eq(ctrReportsTable.userId, userId),
      eq(ctrReportsTable.triggerType, "aggregate"),
      gte(ctrReportsTable.createdAt, todayStart)
    )
  );
  if (existingAggregateCTR.length > 0) {
    return { ctrTriggered: false };
  }

  const todayTxs = await db.select().from(transactionsTable).where(
    and(
      eq(transactionsTable.customerId, userId),
      gte(transactionsTable.createdAt, todayStart)
    )
  );
  const dailyTotalUsd = todayTxs
    .filter(t => t.status !== "failed")
    .reduce((s, t) => s + toUsd(Number(t.amount), t.currency), 0);

  if (dailyTotalUsd >= CTR_THRESHOLD_USD) {
    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId));
    const [ctr] = await db.insert(ctrReportsTable).values({
      userId,
      transactionRef,
      amount: String(amount),
      currency,
      amountUsd: String(amountUsd),
      transactionType,
      triggerType: "aggregate",
      aggregateTotal: String(dailyTotalUsd),
      customerName: user ? `${user.firstName || ""} ${user.lastName || ""}`.trim() : undefined,
      customerEmail: user?.email,
      customerCountry: user?.country,
    }).returning();
    return { ctrTriggered: true, ctrId: ctr.id };
  }

  return { ctrTriggered: false };
}
