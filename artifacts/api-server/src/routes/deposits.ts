import { Router, type IRouter } from "express";
import { eq, desc, and, sql } from "drizzle-orm";
import { db, depositRequestsTable, walletsTable, transactionsTable, notificationsTable } from "@workspace/db";
import { requireAuth, type AuthenticatedRequest } from "../middlewares/requireAuth";
import { checkAndCreateCTR } from "../lib/ctr";
import { generateDepositRef } from "../lib/refgen";

const router: IRouter = Router();

router.post("/deposits", requireAuth, async (req: AuthenticatedRequest, res): Promise<void> => {
  const { currency, amount, method, bankName, senderName, senderAccount, proofUrl, notes } = req.body;
  if (!currency || !amount || Number(amount) <= 0) {
    res.status(400).json({ success: false, message: "Currency and amount are required" });
    return;
  }
  const reference = generateDepositRef();
  const [deposit] = await db.insert(depositRequestsTable).values({
    userId: req.user!.id,
    currency: currency.toUpperCase(),
    amount: String(amount),
    method: method || "bank",
    reference,
    bankName,
    senderName,
    senderAccount,
    proofUrl,
    notes,
  }).returning();

  await db.insert(notificationsTable).values({
    userId: req.user!.id,
    title: "Deposit Request Submitted",
    message: `Your deposit of ${currency} ${Number(amount).toLocaleString()} (ref: ${reference}) is being reviewed.`,
    type: "info",
  });

  res.status(201).json({ success: true, deposit: { ...deposit, amount: Number(deposit.amount) } });
});

router.get("/deposits", requireAuth, async (req: AuthenticatedRequest, res): Promise<void> => {
  const deposits = await db.select().from(depositRequestsTable)
    .where(eq(depositRequestsTable.userId, req.user!.id))
    .orderBy(desc(depositRequestsTable.createdAt));
  res.json({ success: true, deposits: deposits.map(d => ({ ...d, amount: Number(d.amount) })) });
});

router.get("/admin/deposits", requireAuth, async (req: AuthenticatedRequest, res): Promise<void> => {
  if (req.user!.role !== "admin") { res.status(403).json({ success: false, message: "Admin only" }); return; }
  const status = req.query.status as string || undefined;
  let query = db.select().from(depositRequestsTable).orderBy(desc(depositRequestsTable.createdAt));
  const deposits = await query;
  const filtered = status ? deposits.filter(d => d.status === status) : deposits;
  res.json({ success: true, deposits: filtered.map(d => ({ ...d, amount: Number(d.amount) })) });
});

router.post("/admin/deposits/:id/approve", requireAuth, async (req: AuthenticatedRequest, res): Promise<void> => {
  if (req.user!.role !== "admin") { res.status(403).json({ success: false, message: "Admin only" }); return; }
  const id = parseInt(req.params.id);
  const [deposit] = await db.select().from(depositRequestsTable).where(eq(depositRequestsTable.id, id));
  if (!deposit) { res.status(404).json({ success: false, message: "Deposit not found" }); return; }
  if (deposit.status !== "pending") { res.status(400).json({ success: false, message: "Deposit already processed" }); return; }

  const [wallet] = await db.select().from(walletsTable)
    .where(and(eq(walletsTable.userId, deposit.userId), eq(walletsTable.currency, deposit.currency)));

  if (!wallet) {
    const [newWallet] = await db.insert(walletsTable).values({
      userId: deposit.userId, currency: deposit.currency,
    }).returning();
    await db.update(walletsTable).set({
      balance: String(Number(deposit.amount)),
    }).where(eq(walletsTable.id, newWallet.id));
  } else {
    const newBalance = Number(wallet.balance) + Number(deposit.amount);
    await db.update(walletsTable).set({ balance: String(newBalance) }).where(eq(walletsTable.id, wallet.id));
  }

  await db.update(depositRequestsTable).set({
    status: "approved",
    reviewedBy: req.user!.id,
    reviewedAt: new Date(),
  }).where(eq(depositRequestsTable.id, id));

  const ref = generateDepositRef() + "-CR";
  await db.insert(transactionsTable).values({
    reference: ref,
    amount: String(deposit.amount),
    currency: deposit.currency,
    status: "completed",
    type: "deposit",
    customerId: deposit.userId,
    description: `Bank deposit approved (ref: ${deposit.reference})`,
    paymentMethod: deposit.method,
  });

  await checkAndCreateCTR(deposit.userId, ref, Number(deposit.amount), deposit.currency, "deposit");

  await db.insert(notificationsTable).values({
    userId: deposit.userId,
    title: "Deposit Approved",
    message: `Your deposit of ${deposit.currency} ${Number(deposit.amount).toLocaleString()} has been credited to your wallet.`,
    type: "success",
  });

  res.json({ success: true, message: "Deposit approved and wallet credited" });
});

router.post("/admin/deposits/:id/reject", requireAuth, async (req: AuthenticatedRequest, res): Promise<void> => {
  if (req.user!.role !== "admin") { res.status(403).json({ success: false, message: "Admin only" }); return; }
  const id = parseInt(req.params.id);
  const { reason } = req.body;
  const [deposit] = await db.select().from(depositRequestsTable).where(eq(depositRequestsTable.id, id));
  if (!deposit) { res.status(404).json({ success: false, message: "Deposit not found" }); return; }
  if (deposit.status !== "pending") { res.status(400).json({ success: false, message: "Deposit already processed" }); return; }

  await db.update(depositRequestsTable).set({
    status: "rejected",
    reviewedBy: req.user!.id,
    reviewedAt: new Date(),
    rejectionReason: reason || "Payment not verified",
  }).where(eq(depositRequestsTable.id, id));

  await db.insert(notificationsTable).values({
    userId: deposit.userId,
    title: "Deposit Rejected",
    message: `Your deposit of ${deposit.currency} ${Number(deposit.amount).toLocaleString()} was rejected. Reason: ${reason || "Payment not verified"}.`,
    type: "error",
  });

  res.json({ success: true, message: "Deposit rejected" });
});

export default router;
