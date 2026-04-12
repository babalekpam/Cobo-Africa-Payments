import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import { db, walletsTable, transactionsTable } from "@workspace/db";
import { requireAuth, type AuthenticatedRequest } from "../middlewares/requireAuth";

const router: IRouter = Router();

const RATES: Record<string, Record<string, number>> = {
  USD: { NGN: 1580, GHS: 14.5, XOF: 620, KES: 129, ZAR: 18.9, EGP: 48.5, MAD: 10.1, TZS: 2540, UGX: 3750, ETB: 57.5, RWF: 1290, EUR: 0.92, GBP: 0.79, XAF: 620 },
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
  const feePercent = 0.005;
  const feeAmount = Number(amount) * feePercent;
  const netAmount = converted * (1 - feePercent);
  res.json({ success: true, from, to, amount: Number(amount), rate, converted, fee_percent: feePercent * 100, fee_amount: feeAmount, net_amount: netAmount });
});

router.post("/exchange/swap", requireAuth, async (req: AuthenticatedRequest, res): Promise<void> => {
  const { from, to, amount } = req.body;
  if (!from || !to || !amount || amount <= 0 || from === to) { res.status(400).json({ success: false, message: "Invalid swap" }); return; }
  const rate = getRate(from, to);
  if (!rate) { res.status(400).json({ success: false, message: "Rate not available" }); return; }
  const [fromWallet] = await db.select().from(walletsTable).where(and(eq(walletsTable.userId, req.user!.id), eq(walletsTable.currency, from)));
  if (!fromWallet || Number(fromWallet.balance) < Number(amount)) { res.status(400).json({ success: false, message: "Insufficient funds" }); return; }
  let [toWallet] = await db.select().from(walletsTable).where(and(eq(walletsTable.userId, req.user!.id), eq(walletsTable.currency, to)));
  if (!toWallet) {
    [toWallet] = await db.insert(walletsTable).values({ userId: req.user!.id, currency: to }).returning();
  }
  const feePercent = 0.005;
  const converted = Number(amount) * rate;
  const netAmount = converted * (1 - feePercent);
  await db.update(walletsTable).set({ balance: String(Number(fromWallet.balance) - Number(amount)) }).where(eq(walletsTable.id, fromWallet.id));
  await db.update(walletsTable).set({ balance: String(Number(toWallet.balance) + netAmount) }).where(eq(walletsTable.id, toWallet.id));
  const ref = "COBO-FX-" + Date.now();
  await db.insert(transactionsTable).values({ reference: ref, amount: String(amount), currency: from, status: "completed", type: "exchange", customerId: req.user!.id, description: `Swapped ${from} → ${to}`, paymentMethod: "fx" });
  res.json({ success: true, message: `Swapped ${amount} ${from} → ${netAmount.toFixed(2)} ${to}`, reference: ref });
});

export default router;
