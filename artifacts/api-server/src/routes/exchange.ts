import { Router, type IRouter } from "express";
import { eq, and, gte } from "drizzle-orm";
import { db, walletsTable, transactionsTable, usersTable } from "@workspace/db";
import { requireAuth, type AuthenticatedRequest } from "../middlewares/requireAuth";
import { checkAndCreateCTR } from "../lib/ctr";
import { generateFxRef } from "../lib/refgen";

const router: IRouter = Router();

const KYC_LIMITS: Record<number, number> = { 0: 100, 1: 5000, 2: 50000 };

const RATES: Record<string, Record<string, number>> = {
  USD: {
    NGN: 1580, GHS: 14.5, XOF: 620, XAF: 620, KES: 129, ZAR: 18.9, EGP: 48.5,
    MAD: 10.1, TZS: 2540, UGX: 3750, ETB: 57.5, RWF: 1290,
    CDF: 2780, AOA: 830, MZN: 63.8, BWP: 13.6, MWK: 1720, ZMW: 26.5,
    SDG: 601, TND: 3.12, DZD: 134.5, LYD: 4.85,
    GMD: 67.5, SLL: 22500, GNF: 8600, CVE: 102, STN: 23.2,
    SCR: 14.2, MUR: 45.5, MGA: 4520, KMF: 460, DJF: 177.7,
    ERN: 15, SOS: 571, SSP: 1320, BIF: 2870, LSL: 18.9, SZL: 18.9, NAD: 18.9,
    LRD: 192, MRU: 39.7,
    EUR: 0.92, GBP: 0.79, CAD: 1.36, CHF: 0.88, SEK: 10.85, NOK: 10.65,
    DKK: 6.88, PLN: 4.02, CZK: 23.2,
  },
};
function getRate(from: string, to: string): number | null {
  if (from === to) return 1;
  if (RATES[from]?.[to]) return RATES[from][to];
  if (RATES[to]?.[from]) return 1 / RATES[to][from];
  if (RATES.USD[from] && RATES.USD[to]) return RATES.USD[to] / RATES.USD[from];
  if (RATES.USD[from]) return 1 / RATES.USD[from];
  return null;
}

router.get("/exchange/rates", requireAuth, async (_req, res): Promise<void> => {
  const rates: Record<string, number> = { USD: 1 };
  Object.entries(RATES.USD).forEach(([cur, rate]) => { rates[cur] = rate; });
  res.json({ success: true, rates, base: "USD" });
});

router.post("/exchange/convert", requireAuth, async (req: AuthenticatedRequest, res): Promise<void> => {
  const { from, to, amount } = req.body;
  if (!from || !to || !amount || amount <= 0) { res.status(400).json({ success: false, message: "Invalid data" }); return; }
  const rate = getRate(from, to);
  if (!rate) { res.status(400).json({ success: false, message: "Rate not available" }); return; }
  const converted = Number(amount) * rate;
  const feePercent = 0.0035;
  const feeAmount = Number(amount) * feePercent;
  const netAmount = converted * (1 - feePercent);
  res.json({ success: true, from, to, amount: Number(amount), rate, converted, fee_percent: feePercent * 100, fee_amount: feeAmount, net_amount: netAmount });
});

router.post("/exchange/swap", requireAuth, async (req: AuthenticatedRequest, res): Promise<void> => {
  const { from, to, amount } = req.body;
  if (!from || !to || !amount || amount <= 0 || from === to) { res.status(400).json({ success: false, message: "Invalid swap" }); return; }
  const rate = getRate(from, to);
  if (!rate) { res.status(400).json({ success: false, message: "Rate not available" }); return; }

  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, req.user!.id));
  const kycLevel = Number(user?.kycLevel || 0);
  const limit = KYC_LIMITS[kycLevel] || 100;
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayTxs = await db.select().from(transactionsTable).where(
    and(eq(transactionsTable.customerId, req.user!.id), gte(transactionsTable.createdAt, todayStart))
  );
  const usedToday = todayTxs.filter(t => t.status !== "failed").reduce((s, t) => s + Number(t.amount || 0), 0);
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
