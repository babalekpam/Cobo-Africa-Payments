import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import { db, walletsTable, transactionsTable, usersTable, notificationsTable } from "@workspace/db";
import { requireAuth, type AuthenticatedRequest } from "../middlewares/requireAuth";

const router: IRouter = Router();
const FEE_RATE = 0.009;
const MIN_FEE = 0.5;

function calcFee(amount: number, type: string) {
  if (type === "internal") return 0;
  return Math.max(amount * FEE_RATE, MIN_FEE);
}

async function getWallet(userId: number, walletId?: number, currency?: string) {
  if (walletId) {
    const [w] = await db.select().from(walletsTable).where(and(eq(walletsTable.id, walletId), eq(walletsTable.userId, userId)));
    return w;
  }
  if (currency) {
    const [w] = await db.select().from(walletsTable).where(and(eq(walletsTable.userId, userId), eq(walletsTable.currency, currency)));
    return w;
  }
  return null;
}

router.get("/transfers/fee", requireAuth, async (req: AuthenticatedRequest, res): Promise<void> => {
  const amount = parseFloat(String(req.query.amount)) || 0;
  const type = String(req.query.type || "bank");
  const fee = calcFee(amount, type);
  res.json({ success: true, amount, fee, fee_percent: type === "internal" ? 0 : FEE_RATE * 100, total: amount + fee });
});

router.post("/transfers/bank", requireAuth, async (req: AuthenticatedRequest, res): Promise<void> => {
  const { wallet_id, currency, amount, account_number, bank_name, account_name, description } = req.body;
  if (!amount || amount <= 0) { res.status(400).json({ success: false, message: "Invalid amount" }); return; }
  const wallet = await getWallet(req.user!.id, wallet_id, currency);
  if (!wallet) { res.status(404).json({ success: false, message: "Wallet not found" }); return; }
  const fee = calcFee(Number(amount), "bank");
  const total = Number(amount) + fee;
  if (Number(wallet.balance) < total) { res.status(400).json({ success: false, message: "Insufficient funds" }); return; }
  await db.update(walletsTable).set({ balance: String(Number(wallet.balance) - total) }).where(eq(walletsTable.id, wallet.id));
  const ref = "COBO-BANK-" + Date.now() + "-" + Math.random().toString(36).slice(2, 6).toUpperCase();
  await db.insert(transactionsTable).values({
    reference: ref, amount: String(amount), currency: wallet.currency, status: "completed", type: "send",
    customerId: req.user!.id, description: description || `Bank transfer to ${account_name || bank_name}`,
    paymentMethod: "bank",
  });
  res.json({ success: true, message: "Transfer sent", reference: ref, fee, net_amount: Number(amount) });
});

router.post("/transfers/mobile", requireAuth, async (req: AuthenticatedRequest, res): Promise<void> => {
  const { wallet_id, currency, amount, phone, provider, recipient_name, description } = req.body;
  if (!amount || amount <= 0) { res.status(400).json({ success: false, message: "Invalid amount" }); return; }
  const wallet = await getWallet(req.user!.id, wallet_id, currency);
  if (!wallet) { res.status(404).json({ success: false, message: "Wallet not found" }); return; }
  const fee = calcFee(Number(amount), "mobile");
  const total = Number(amount) + fee;
  if (Number(wallet.balance) < total) { res.status(400).json({ success: false, message: "Insufficient funds" }); return; }
  await db.update(walletsTable).set({ balance: String(Number(wallet.balance) - total) }).where(eq(walletsTable.id, wallet.id));
  const ref = "COBO-MOMO-" + Date.now() + "-" + Math.random().toString(36).slice(2, 6).toUpperCase();
  await db.insert(transactionsTable).values({
    reference: ref, amount: String(amount), currency: wallet.currency, status: "completed", type: "send",
    customerId: req.user!.id, description: description || `Mobile money to ${recipient_name || phone}`,
    paymentMethod: provider || "mobile_money",
  });
  res.json({ success: true, message: "Transfer sent", reference: ref, fee });
});

router.post("/transfers/internal", requireAuth, async (req: AuthenticatedRequest, res): Promise<void> => {
  const { wallet_id, recipient_email, email, currency, amount, note, description } = req.body;
  const recipientEmail = recipient_email || email;
  if (!recipientEmail || !amount || amount <= 0) { res.status(400).json({ success: false, message: "Invalid data" }); return; }
  const [recipient] = await db.select().from(usersTable).where(eq(usersTable.email, recipientEmail));
  if (!recipient) { res.status(404).json({ success: false, message: "Recipient not found on COBO" }); return; }
  if (recipient.id === req.user!.id) { res.status(400).json({ success: false, message: "Cannot send to yourself" }); return; }
  const senderWallet = await getWallet(req.user!.id, wallet_id, currency);
  if (!senderWallet || Number(senderWallet.balance) < Number(amount)) { res.status(400).json({ success: false, message: "Insufficient funds" }); return; }
  let [recipientWallet] = await db.select().from(walletsTable).where(and(eq(walletsTable.userId, recipient.id), eq(walletsTable.currency, senderWallet.currency)));
  if (!recipientWallet) {
    [recipientWallet] = await db.insert(walletsTable).values({ userId: recipient.id, currency: senderWallet.currency }).returning();
  }
  await db.update(walletsTable).set({ balance: String(Number(senderWallet.balance) - Number(amount)) }).where(eq(walletsTable.id, senderWallet.id));
  await db.update(walletsTable).set({ balance: String(Number(recipientWallet.balance) + Number(amount)) }).where(eq(walletsTable.id, recipientWallet.id));
  const ref = "COBO-INT-" + Date.now();
  const desc = note || description || `Internal transfer to ${recipient.email}`;
  await db.insert(transactionsTable).values({ reference: ref, amount: String(amount), currency: senderWallet.currency, status: "completed", type: "send", customerId: req.user!.id, description: desc, paymentMethod: "internal" });
  await db.insert(transactionsTable).values({ reference: ref + "-R", amount: String(amount), currency: senderWallet.currency, status: "completed", type: "deposit", customerId: recipient.id, description: `Internal transfer from ${req.user!.email}`, paymentMethod: "internal" });
  await db.insert(notificationsTable).values({ userId: recipient.id, title: "Money Received! 💰", message: `${senderWallet.currency} ${amount} received`, type: "success" });
  res.json({ success: true, message: "Transfer sent (free)", reference: ref });
});

export default router;
