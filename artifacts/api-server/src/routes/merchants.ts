import { Router, type IRouter } from "express";
import { eq, ilike, and, SQL, count, sum } from "drizzle-orm";
import { db, merchantsTable, transactionsTable } from "@workspace/db";
import {
  ListMerchantsQueryParams,
  CreateMerchantBody,
  GetMerchantParams,
  UpdateMerchantParams,
  UpdateMerchantBody,
  DeleteMerchantParams,
} from "@workspace/api-zod";
import { requireAuth, type AuthenticatedRequest } from "../middlewares/requireAuth";

const router: IRouter = Router();

async function getMerchantWithStats(merchantId: number) {
  const [merchant] = await db.select().from(merchantsTable).where(eq(merchantsTable.id, merchantId));
  if (!merchant) return null;

  const [stats] = await db
    .select({
      totalVolume: sum(transactionsTable.amount),
      transactionCount: count(),
    })
    .from(transactionsTable)
    .where(eq(transactionsTable.merchantId, merchantId));

  return {
    ...merchant,
    totalVolume: stats?.totalVolume ? Number(stats.totalVolume) : 0,
    transactionCount: Number(stats?.transactionCount ?? 0),
  };
}

router.get("/merchants", requireAuth, async (req: AuthenticatedRequest, res): Promise<void> => {
  const parsed = ListMerchantsQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid query params", message: parsed.error.message });
    return;
  }

  const { page = 1, limit = 20, search, status, country } = parsed.data;
  const offset = (page - 1) * limit;

  const conditions: SQL[] = [];
  if (search) conditions.push(ilike(merchantsTable.name, `%${search}%`));
  if (status) conditions.push(eq(merchantsTable.status, status));
  if (country) conditions.push(eq(merchantsTable.country, country));

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  const [merchants, [{ value: totalCount }]] = await Promise.all([
    db.select().from(merchantsTable).where(whereClause).limit(limit).offset(offset).orderBy(merchantsTable.createdAt),
    db.select({ value: count() }).from(merchantsTable).where(whereClause),
  ]);

  const merchantIds = merchants.map((m) => m.id);
  const statsMap: Record<number, { totalVolume: number; transactionCount: number }> = {};

  if (merchantIds.length > 0) {
    for (const merchant of merchants) {
      const [stats] = await db
        .select({ totalVolume: sum(transactionsTable.amount), transactionCount: count() })
        .from(transactionsTable)
        .where(eq(transactionsTable.merchantId, merchant.id));
      statsMap[merchant.id] = {
        totalVolume: stats?.totalVolume ? Number(stats.totalVolume) : 0,
        transactionCount: Number(stats?.transactionCount ?? 0),
      };
    }
  }

  const total = Number(totalCount);
  res.json({
    data: merchants.map((m) => ({
      ...m,
      totalVolume: statsMap[m.id]?.totalVolume ?? 0,
      transactionCount: statsMap[m.id]?.transactionCount ?? 0,
    })),
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  });
});

router.post("/merchants", requireAuth, async (req: AuthenticatedRequest, res): Promise<void> => {
  const parsed = CreateMerchantBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request", message: parsed.error.message });
    return;
  }

  const [existing] = await db.select({ id: merchantsTable.id }).from(merchantsTable).where(eq(merchantsTable.email, parsed.data.email));
  if (existing) {
    res.status(409).json({ error: "Conflict", message: "Email already in use" });
    return;
  }

  const [merchant] = await db.insert(merchantsTable).values(parsed.data).returning();
  res.status(201).json({ ...merchant, totalVolume: 0, transactionCount: 0 });
});

router.get("/merchants/:id", requireAuth, async (req: AuthenticatedRequest, res): Promise<void> => {
  const params = GetMerchantParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: "Invalid params", message: params.error.message });
    return;
  }

  const merchant = await getMerchantWithStats(params.data.id);
  if (!merchant) {
    res.status(404).json({ error: "Not found", message: "Merchant not found" });
    return;
  }

  res.json(merchant);
});

router.put("/merchants/:id", requireAuth, async (req: AuthenticatedRequest, res): Promise<void> => {
  const params = UpdateMerchantParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: "Invalid params", message: params.error.message });
    return;
  }

  const parsed = UpdateMerchantBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request", message: parsed.error.message });
    return;
  }

  const [updated] = await db
    .update(merchantsTable)
    .set(parsed.data)
    .where(eq(merchantsTable.id, params.data.id))
    .returning();

  if (!updated) {
    res.status(404).json({ error: "Not found", message: "Merchant not found" });
    return;
  }

  const merchant = await getMerchantWithStats(updated.id);
  res.json(merchant);
});

router.delete("/merchants/:id", requireAuth, async (req: AuthenticatedRequest, res): Promise<void> => {
  const params = DeleteMerchantParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: "Invalid params", message: params.error.message });
    return;
  }

  const [merchant] = await db.delete(merchantsTable).where(eq(merchantsTable.id, params.data.id)).returning();
  if (!merchant) {
    res.status(404).json({ error: "Not found", message: "Merchant not found" });
    return;
  }

  res.json({ success: true, message: "Merchant deleted" });
});

export default router;
