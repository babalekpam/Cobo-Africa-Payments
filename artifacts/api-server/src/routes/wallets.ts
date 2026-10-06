import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import { db, walletsTable, transactionsTable } from "@workspace/db";
import { requireAuth, type AuthenticatedRequest } from "../middlewares/requireAuth";
import { parseAmount, credit } from "../lib/ledger.js";
import { isSandbox } from "../lib/environment.js";

const router: IRouter = Router();

const ALLOWED_CURRENCIES = [
  'USD', 'EUR', 'GBP',
  'NGN', 'GHS', 'KES', 'XOF', 'XAF', 'ZAR', 'EGP', 'MAD', 'TZS', 'UGX', 'ETB', 'RWF',
  'CDF', 'AOA', 'MZN', 'BWP', 'MWK', 'ZMW', 'SDG', 'TND', 'DZD', 'LYD',
  'GMD', 'SLL', 'GNF', 'CVE', 'STN', 'SCR', 'MUR', 'MGA', 'KMF', 'DJF',
  'ERN', 'SOS', 'SSP', 'BIF', 'LSL', 'SZL', 'NAD', 'LRD', 'MRU',
];

router.get("/wallets", requireAuth, async (req: AuthenticatedRequest, res): Promise<void> => {
  const wallets = await db.select().from(walletsTable).where(eq(walletsTable.userId, req.user!.id));
  res.json({ success: true, wallets: wallets.map(w => ({ ...w, balance: Number(w.balance), lockedBalance: Number(w.lockedBalance) })) });
});

router.post("/wallets", requireAuth, async (req: AuthenticatedRequest, res): Promise<void> => {
  const { currency } = req.body;
  if (!currency || !ALLOWED_CURRENCIES.includes(currency.toUpperCase())) {
    res.status(400).json({ success: false, message: "Unsupported currency" });
    return;
  }
  const cur = currency.toUpperCase();
  const existing = await db.select().from(walletsTable).where(and(eq(walletsTable.userId, req.user!.id), eq(walletsTable.currency, cur)));
  if (existing.length > 0) {
    res.status(409).json({ success: false, message: "Wallet already exists" });
    return;
  }
  const [wallet] = await db.insert(walletsTable).values({ userId: req.user!.id, currency: cur }).returning();
  res.status(201).json({ success: true, wallet: { ...wallet, balance: Number(wallet.balance), lockedBalance: Number(wallet.lockedBalance) } });
});

router.put("/wallets/:id/default", requireAuth, async (req: AuthenticatedRequest, res): Promise<void> => {
  const id = parseInt(req.params.id);
  await db.update(walletsTable).set({ isDefault: false }).where(eq(walletsTable.userId, req.user!.id));
  await db.update(walletsTable).set({ isDefault: true }).where(and(eq(walletsTable.id, id), eq(walletsTable.userId, req.user!.id)));
  res.json({ success: true, message: "Default wallet updated" });
});

// Self-service TEST money. Sandbox installations only: on a live installation money enters a wallet
// only through a verified deposit, an incoming payment or a provider — never by asking for it.
router.post("/wallets/fund", requireAuth, async (req: AuthenticatedRequest, res): Promise<void> => {
  if (!isSandbox()) {
    res.status(403).json({ success: false, message: "Test funding is only available on a sandbox installation. Use a deposit instead." });
    return;
  }
  const { currency } = req.body;
  const amount = parseAmount(req.body.amount);
  if (!currency || !amount || Number(amount) > 100000) {
    res.status(400).json({ success: false, message: "Invalid funding: 0.01 to 100,000 with at most 2 decimal places (sandbox)." });
    return;
  }
  const cur = String(currency).toUpperCase();
  const [wallet] = await db.select().from(walletsTable).where(and(eq(walletsTable.userId, req.user!.id), eq(walletsTable.currency, cur)));
  if (!wallet) {
    res.status(404).json({ success: false, message: "Wallet not found" });
    return;
  }
  const ref = "IAPAY-FUND-" + Date.now();
  await db.transaction(async (tx) => {
    await credit(tx, wallet.id, amount);
    await tx.insert(transactionsTable).values({
      reference: ref, amount, currency: cur, status: "completed",
      type: "deposit", customerId: req.user!.id, description: "Sandbox test funding (not real money)",
      paymentMethod: "sandbox",
    });
  });
  const [updated] = await db.select().from(walletsTable).where(eq(walletsTable.id, wallet.id));
  res.json({ success: true, message: `${cur} ${amount} added (sandbox test money)`, wallet: { ...updated, balance: Number(updated.balance), lockedBalance: Number(updated.lockedBalance) } });
});

export default router;
