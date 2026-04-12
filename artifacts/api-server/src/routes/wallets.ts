import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import { db, walletsTable, transactionsTable } from "@workspace/db";
import { requireAuth, type AuthenticatedRequest } from "../middlewares/requireAuth";

const router: IRouter = Router();

const ALLOWED_CURRENCIES = ['USD','NGN','GHS','XOF','XAF','KES','ZAR','EGP','MAD','TZS','UGX','ETB','RWF','EUR','GBP'];

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

router.post("/wallets/fund", requireAuth, async (req: AuthenticatedRequest, res): Promise<void> => {
  const { currency, amount } = req.body;
  if (!currency || !amount || amount <= 0 || amount > 100000) {
    res.status(400).json({ success: false, message: "Invalid funding. Max 100,000 in sandbox." });
    return;
  }
  const cur = currency.toUpperCase();
  const [wallet] = await db.select().from(walletsTable).where(and(eq(walletsTable.userId, req.user!.id), eq(walletsTable.currency, cur)));
  if (!wallet) {
    res.status(404).json({ success: false, message: "Wallet not found" });
    return;
  }
  const newBalance = Number(wallet.balance) + Number(amount);
  await db.update(walletsTable).set({ balance: String(newBalance) }).where(eq(walletsTable.id, wallet.id));
  const ref = "COBO-FUND-" + Date.now();
  await db.insert(transactionsTable).values({
    reference: ref, amount: String(amount), currency: cur, status: "completed",
    type: "deposit", customerId: req.user!.id, description: "Sandbox wallet funding",
    paymentMethod: "sandbox",
  });
  const [updated] = await db.select().from(walletsTable).where(eq(walletsTable.id, wallet.id));
  res.json({ success: true, message: `${cur} ${amount} added (sandbox)`, wallet: { ...updated, balance: Number(updated.balance), lockedBalance: Number(updated.lockedBalance) } });
});

export default router;
