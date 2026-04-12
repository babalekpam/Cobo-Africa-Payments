import { Router, type IRouter } from "express";
import { eq, ilike, and, SQL, count, gte, lte, or } from "drizzle-orm";
import { db, transactionsTable, merchantsTable, usersTable } from "@workspace/db";
import {
  ListTransactionsQueryParams,
  CreateTransactionBody,
  GetTransactionParams,
  UpdateTransactionParams,
  UpdateTransactionBody,
} from "@workspace/api-zod";
import { requireAuth, type AuthenticatedRequest } from "../middlewares/requireAuth";

const router: IRouter = Router();

function generateReference(): string {
  const ts = Date.now().toString(36).toUpperCase();
  const rand = Math.random().toString(36).substring(2, 7).toUpperCase();
  return `COBO-${ts}-${rand}`;
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

router.post("/transactions", requireAuth, async (req: AuthenticatedRequest, res): Promise<void> => {
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
  if (!tx) {
    res.status(404).json({ error: "Not found", message: "Transaction not found" });
    return;
  }

  const enriched = await enrichTransaction(tx);
  res.json(enriched);
});

router.put("/transactions/:id", requireAuth, async (req: AuthenticatedRequest, res): Promise<void> => {
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
