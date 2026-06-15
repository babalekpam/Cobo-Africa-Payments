import { Router, type IRouter } from "express";
import { eq, and, gte } from "drizzle-orm";
import { db, walletsTable, transactionsTable, usersTable } from "@workspace/db";
import { requireAuth, type AuthenticatedRequest } from "../middlewares/requireAuth.js";
import { checkAndCreateCTR } from "../lib/ctr.js";
import { generateFxRef } from "../lib/refgen.js";
import { getRate, getAllRates } from "../services/fxRates.js";

const router: IRouter = Router();

const KYC_LIMITS: Record<number, number> = { 0: 100, 1: 5000, 2: 50000 };

router.get("/exchange/rates", requireAuth, async (_req, res): Promise<void> => {
  const rates = await getAllRates();
  res.json({ success: true, rates, base: "USD" });
});

router.post("/exchange/convert", requireAuth, async (req: AuthenticatedRequest, res): Promise<void> => {
  const { from, to, amount } = req.body as { from: string; to: string; amount: number };
  if (!from || !to || !amount || amount <= 0) { res.status(400).json({ success: false, message: "Invalid data" }); return; }
  const rate = await getRate(from, to);
  if (!rate) { res.status(400).json({ success: false, message: "Rate not available" }); return; }
  const converted = Number(amount) * rate;
  const feePercent = 0.0035;
  const feeAmount = Number(amount) * feePercent;
  const netAmount = converted * (1 - feePercent);
  res.json({ success: true, from, to, amount: Number(amount), rate, converted, fee_percent: feePercent * 100, fee_amount: feeAmount, net_amount: netAmount });
});

router.post("/exchange/swap", requireAuth, async (req: AuthenticatedRequest, res): Promise<void> => {
  const { from, to, amount } = req.body as { from: string; to: string; amount: number };
  if (!from || !to || !amount || amount <= 0 || from === to) { res.status(400).json({ success: false, message: "Invalid swap" }); return; }
  const rate = await getRate(from, to);
  if (!rate) { res.status(400).json({ success: false, message: "Rate not available" }); return; }

  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, req.user!.id));
  const kycLevel = Number(user?.kycLevel || 0);
  const limit = KYC_LIMITS[kycLevel] || 100;
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayTxs = await db.select().from(transactionsTable).where(
    and(eq(transactionsTable.customerId, req.user!.id), gte(transactionsTable.createdAt, todayStart))
  );
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const usedToday = todayTxs.filter((t: any) => t.status !== "failed").reduce((s: number, t: any) => s + Number(t.amount || 0), 0);
  if (usedToday + Number(amount) > limit) {
    const remaining = Math.max(0, limit - usedToday);
    res.status(403).json({ success: false, message: `Daily limit: $${limit.toLocaleString()}. Used today: $${usedToday.toLocaleString()}. Remaining: $${remaining.toLocaleString()}.${kycLevel < 2 ? " Complete KYC to increase your limit." : ""}`, code: "LIMIT_EXCEEDED" });
    return;
  }

  const [fromWallet] = await db.select().from(walletsTable).where(and(eq(walletsTable.userId, req.user!.id), eq(walletsTable.currency, from)));
  if (!fromWallet || Number(fromWallet.balance) < Number(amount)) { res.status(400).json({ success: false, message: "Insufficient funds" }); return; }
  let [toWallet] = await db.select().from(walletsTable).where(and(eq(walletsTable.userId, req.user!.id), eq(walletsTable.currency, to)));
  if (!toWallet) {
    [toWallet] = await db.insert(walletsTable).values({ userId: req.user!.id, currency: to }).returning();
  }
  const feePercent = 0.0035;
  const converted = Number(amount) * rate;
  const netAmount = converted * (1 - feePercent);
  await db.update(walletsTable).set({ balance: String(Number(fromWallet.balance) - Number(amount)) }).where(eq(walletsTable.id, fromWallet.id));
  await db.update(walletsTable).set({ balance: String(Number(toWallet.balance) + netAmount) }).where(eq(walletsTable.id, toWallet.id));
  const ref = generateFxRef();
  await db.insert(transactionsTable).values({ reference: ref, amount: String(amount), currency: from, status: "completed", type: "exchange", customerId: req.user!.id, description: `Swapped ${from} → ${to} at ${rate.toFixed(4)}`, paymentMethod: "fx" });
  await checkAndCreateCTR(req.user!.id, ref, Number(amount), from, "fx_exchange");
  res.json({ success: true, message: `Swapped ${amount} ${from} → ${netAmount.toFixed(2)} ${to}`, reference: ref, rate, fee_percent: feePercent * 100, net_amount: netAmount });
});

export default router;
