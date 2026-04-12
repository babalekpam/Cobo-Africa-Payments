import { Router, type IRouter } from "express";
import { eq, count, sum, sql } from "drizzle-orm";
import { db, transactionsTable, merchantsTable, usersTable } from "@workspace/db";
import { GetRecentTransactionsQueryParams } from "@workspace/api-zod";
import { requireAuth, type AuthenticatedRequest } from "../middlewares/requireAuth";

const router: IRouter = Router();

router.get("/dashboard/summary", requireAuth, async (req: AuthenticatedRequest, res): Promise<void> => {
  const [txStats] = await db
    .select({
      total: count(),
      volume: sum(transactionsTable.amount),
      completed: sql<number>`COUNT(*) FILTER (WHERE ${transactionsTable.status} = 'completed')`,
      pending: sql<number>`COUNT(*) FILTER (WHERE ${transactionsTable.status} = 'pending')`,
    })
    .from(transactionsTable);

  const [merchantStats] = await db
    .select({ active: sql<number>`COUNT(*) FILTER (WHERE ${merchantsTable.status} = 'active')` })
    .from(merchantsTable);

  const [userStats] = await db.select({ total: count() }).from(usersTable);

  const total = Number(txStats?.total ?? 0);
  const completed = Number(txStats?.completed ?? 0);
  const successRate = total > 0 ? Math.round((completed / total) * 100) : 0;

  res.json({
    totalTransactions: total,
    totalVolume: Number(txStats?.volume ?? 0),
    successRate,
    activeMerchants: Number(merchantStats?.active ?? 0),
    pendingTransactions: Number(txStats?.pending ?? 0),
    totalUsers: Number(userStats?.total ?? 0),
    volumeGrowth: 12.5,
    transactionGrowth: 8.3,
  });
});

router.get("/dashboard/recent-transactions", requireAuth, async (req: AuthenticatedRequest, res): Promise<void> => {
  const parsed = GetRecentTransactionsQueryParams.safeParse(req.query);
  const limit = parsed.success ? (parsed.data.limit ?? 10) : 10;

  const txs = await db
    .select()
    .from(transactionsTable)
    .orderBy(sql`${transactionsTable.createdAt} DESC`)
    .limit(limit);

  const enriched = await Promise.all(
    txs.map(async (tx) => {
      let merchantName: string | null = null;
      let customerName: string | null = null;

      if (tx.merchantId) {
        const [m] = await db.select({ name: merchantsTable.name }).from(merchantsTable).where(eq(merchantsTable.id, tx.merchantId));
        merchantName = m?.name ?? null;
      }
      if (tx.customerId) {
        const [u] = await db.select({ name: usersTable.name }).from(usersTable).where(eq(usersTable.id, tx.customerId));
        customerName = u?.name ?? null;
      }

      return { ...tx, amount: Number(tx.amount), merchantName, customerName };
    })
  );

  res.json(enriched);
});

router.get("/dashboard/volume-by-country", requireAuth, async (req: AuthenticatedRequest, res): Promise<void> => {
  const results = await db
    .select({
      country: transactionsTable.country,
      volume: sum(transactionsTable.amount),
      count: count(),
    })
    .from(transactionsTable)
    .groupBy(transactionsTable.country)
    .orderBy(sql`SUM(${transactionsTable.amount}) DESC`);

  res.json(
    results
      .filter((r) => r.country)
      .map((r) => ({
        country: r.country!,
        volume: Number(r.volume ?? 0),
        count: Number(r.count),
      }))
  );
});

router.get("/dashboard/monthly-volume", requireAuth, async (req: AuthenticatedRequest, res): Promise<void> => {
  const results = await db
    .select({
      month: sql<string>`TO_CHAR(DATE_TRUNC('month', ${transactionsTable.createdAt}), 'YYYY-MM')`,
      volume: sum(transactionsTable.amount),
      count: count(),
    })
    .from(transactionsTable)
    .groupBy(sql`DATE_TRUNC('month', ${transactionsTable.createdAt})`)
    .orderBy(sql`DATE_TRUNC('month', ${transactionsTable.createdAt}) ASC`)
    .limit(12);

  res.json(
    results.map((r) => ({
      month: r.month,
      volume: Number(r.volume ?? 0),
      count: Number(r.count),
    }))
  );
});

router.get("/dashboard/top-merchants", requireAuth, async (req: AuthenticatedRequest, res): Promise<void> => {
  const limitParam = req.query.limit;
  const limit = limitParam ? parseInt(String(limitParam), 10) : 5;

  const results = await db
    .select({
      id: merchantsTable.id,
      name: merchantsTable.name,
      country: merchantsTable.country,
      volume: sum(transactionsTable.amount),
      count: count(),
    })
    .from(transactionsTable)
    .innerJoin(merchantsTable, eq(transactionsTable.merchantId, merchantsTable.id))
    .groupBy(merchantsTable.id, merchantsTable.name, merchantsTable.country)
    .orderBy(sql`SUM(${transactionsTable.amount}) DESC`)
    .limit(limit);

  res.json(
    results.map((r) => ({
      id: r.id,
      name: r.name,
      country: r.country,
      volume: Number(r.volume ?? 0),
      count: Number(r.count),
    }))
  );
});

export default router;
