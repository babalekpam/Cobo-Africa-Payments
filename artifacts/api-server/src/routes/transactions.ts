import { Router, type IRouter } from "express";
import { eq, ilike, and, SQL, count, gte, lte, or, inArray } from "drizzle-orm";
import { db, transactionsTable, merchantsTable, usersTable } from "@workspace/db";
import {
  ListTransactionsQueryParams,
  CreateTransactionBody,
  GetTransactionParams,
  UpdateTransactionParams,
  UpdateTransactionBody,
} from "@workspace/api-zod";
import { requireAuth, requireAdmin, type AuthenticatedRequest } from "../middlewares/requireAuth";
import { canSeeTransaction, ownedMerchantIds } from "../lib/access";

const router: IRouter = Router();

function generateReference(): string {
  const ts = Date.now().toString(36).toUpperCase();
  const rand = Math.random().toString(36).substring(2, 7).toUpperCase();
  return `IAPAY-${ts}-${rand}`;
}

async function enrichTransaction(tx: typeof transactionsTable.$inferSelect) {
  let merchantName: string | null = null;
  let customerName: string | null = null;

  if (tx.merchantId) {
    const [merchant] = await db.select({ name: merchantsTable.name }).from(merchantsTable).where(eq(merchantsTable.id, tx.merchantId));
    merchantName = merchant?.name ?? null;
  }
  if (tx.customerId) {
    const [customer] = await db.select({ name: usersTable.name }).from(usersTable).where(eq(usersTable.id, tx.customerId));
    customerName = customer?.name ?? null;
  }

  return {
    ...tx,
    amount: Number(tx.amount),
    merchantName,
    customerName,
  };
}

router.get("/transactions", requireAuth, async (req: AuthenticatedRequest, res): Promise<void> => {
  const parsed = ListTransactionsQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid query params", message: parsed.error.message });
    return;
  }

  const { page = 1, limit = 20, status, merchantId, startDate, endDate, search } = parsed.data;
  const offset = (page - 1) * limit;

  const conditions: SQL[] = [];
  // Privacy boundary: users only ever see their own transactions and those at merchants they own.
  // Administrators see everything. (A client-supplied merchantId filter can only narrow this.)
  if (req.user!.role !== "admin") {
    const mine = await ownedMerchantIds(req.user!.id);
    const scope = mine.length > 0 ? or(eq(transactionsTable.customerId, req.user!.id), inArray(transactionsTable.merchantId, mine)) : eq(transactionsTable.customerId, req.user!.id);
    conditions.push(scope!);
  }
  if (status) conditions.push(eq(transactionsTable.status, status));
  if (merchantId) conditions.push(eq(transactionsTable.merchantId, merchantId));
  if (startDate) conditions.push(gte(transactionsTable.createdAt, new Date(startDate)));
  if (endDate) conditions.push(lte(transactionsTable.createdAt, new Date(endDate)));
  if (search) conditions.push(ilike(transactionsTable.reference, `%${search}%`));

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  const [txs, [{ value: totalCount }]] = await Promise.all([
    db.select().from(transactionsTable).where(whereClause).limit(limit).offset(offset).orderBy(transactionsTable.createdAt),
    db.select({ value: count() }).from(transactionsTable).where(whereClause),
  ]);

  const enriched = await Promise.all(txs.map(enrichTransaction));
  const total = Number(totalCount);

  res.json({
    data: enriched,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  });
});

// Ledger records are created by the payment flows themselves; creating or rewriting one by hand is an
// administrator-only correction tool (it does not move wallet funds).
router.post("/transactions", requireAuth, requireAdmin, async (req: AuthenticatedRequest, res): Promise<void> => {
  const parsed = CreateTransactionBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request", message: parsed.error.message });
    return;
  }

  const reference = generateReference();
  const [tx] = await db
    .insert(transactionsTable)
    .values({
      ...parsed.data,
      amount: String(parsed.data.amount),
      reference,
    })
    .returning();

  const enriched = await enrichTransaction(tx);
  res.status(201).json(enriched);
});

router.get("/transactions/:id", requireAuth, async (req: AuthenticatedRequest, res): Promise<void> => {
  const params = GetTransactionParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: "Invalid params", message: params.error.message });
    return;
  }

  const [tx] = await db.select().from(transactionsTable).where(eq(transactionsTable.id, params.data.id));
  // Someone else's transaction is indistinguishable from a nonexistent one (404, not 403).
  if (!tx || !canSeeTransaction(req.user!, tx, req.user!.role === "admin" ? [] : await ownedMerchantIds(req.user!.id))) {
    res.status(404).json({ error: "Not found", message: "Transaction not found" });
    return;
  }

  const enriched = await enrichTransaction(tx);
  res.json(enriched);
});

router.put("/transactions/:id", requireAuth, requireAdmin, async (req: AuthenticatedRequest, res): Promise<void> => {
  const params = UpdateTransactionParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: "Invalid params", message: params.error.message });
    return;
  }

  const parsed = UpdateTransactionBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request", message: parsed.error.message });
    return;
  }

  const [tx] = await db
    .update(transactionsTable)
    .set(parsed.data)
    .where(eq(transactionsTable.id, params.data.id))
    .returning();

  if (!tx) {
    res.status(404).json({ error: "Not found", message: "Transaction not found" });
    return;
  }

  const enriched = await enrichTransaction(tx);
  res.json(enriched);
});

export default router;
