import { Router, type IRouter } from "express";
import { eq, and, gte } from "drizzle-orm";
import { db, walletsTable, transactionsTable, usersTable } from "@workspace/db";
import { requireAuth, type AuthenticatedRequest } from "../middlewares/requireAuth.js";
import { checkAndCreateCTR } from "../lib/ctr.js";
import { generateFxRef } from "../lib/refgen.js";
import { getRate, getAllRates } from "../services/fxRates.js";
import { parseAmount, toCents, debit, credit, walletFor, InsufficientFunds } from "../lib/ledger.js";

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
  const { from, to } = req.body as { from: string; to: string };
  const amount = parseAmount(req.body.amount);
  if (!from || !to || !amount || from === to) { res.status(400).json({ success: false, message: "Invalid swap: amount must be at least 0.01 with at most 2 decimal places" }); return; }
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
  if (!fromWallet) { res.status(400).json({ success: false, message: "Insufficient funds" }); return; }
  const feePercent = 0.0035;
  // Rounded to cents once; a conversion that rounds to nothing is refused (it would destroy money).
  const netAmount = toCents(Number(amount) * rate * (1 - feePercent));
  if (Number(netAmount) < 0.01) { res.status(400).json({ success: false, message: "Amount is too small to convert" }); return; }

  const ref = generateFxRef();
  try {
    await db.transaction(async (tx) => {
      if (!(await debit(tx, fromWallet.id, amount))) throw new InsufficientFunds();
      const toWallet = await walletFor(tx, req.user!.id, to);
      await credit(tx, toWallet.id, netAmount);
      await tx.insert(transactionsTable).values({ reference: ref, amount, currency: from, status: "completed", type: "exchange", customerId: req.user!.id, description: `Swapped ${from} → ${to} at ${rate.toFixed(4)}`, paymentMethod: "fx" });
    });
  } catch (err) {
    if (err instanceof InsufficientFunds) { res.status(400).json({ success: false, message: "Insufficient funds" }); return; }
    throw err;
  }
  await checkAndCreateCTR(req.user!.id, ref, Number(amount), from, "fx_exchange");
  res.json({ success: true, message: `Swapped ${amount} ${from} → ${netAmount} ${to}`, reference: ref, rate, fee_percent: feePercent * 100, net_amount: Number(netAmount) });
});

export default router;
