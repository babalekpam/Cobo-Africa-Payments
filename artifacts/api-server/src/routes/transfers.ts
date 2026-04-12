import { Router, type IRouter } from "express";
import { eq, and, gte } from "drizzle-orm";
import { db, walletsTable, transactionsTable, usersTable, notificationsTable, auditLogsTable } from "@workspace/db";
import { requireAuth, type AuthenticatedRequest } from "../middlewares/requireAuth";
import { emailService } from "../services/email";

const router: IRouter = Router();
const FEE_RATE = 0.009;
const MIN_FEE = 0.5;
const KYC_LIMITS: Record<number, number> = { 0: 100, 1: 5000, 2: 50000 };

const FX_RATES: Record<string, Record<string, number>> = {
  USD: {
    NGN: 1580, GHS: 14.5, XOF: 620, XAF: 620, KES: 129, ZAR: 18.9, EGP: 48.5,
    MAD: 10.1, TZS: 2540, UGX: 3750, ETB: 57.5, RWF: 1290,
    CDF: 2780, AOA: 830, MZN: 63.8, BWP: 13.6, MWK: 1720, ZMW: 26.5,
    SDG: 601, TND: 3.12, DZD: 134.5, LYD: 4.85,
    GMD: 67.5, SLL: 22500, GNF: 8600, CVE: 102, STN: 23.2,
    SCR: 14.2, MUR: 45.5, MGA: 4520, KMF: 460, DJF: 177.7,
    ERN: 15, SOS: 571, SSP: 1320, BIF: 2870, LSL: 18.9, SZL: 18.9, NAD: 18.9,
    LRD: 192, MRU: 39.7,
    EUR: 0.92, GBP: 0.79,
  },
};

function getFxRate(from: string, to: string): number | null {
  if (from === to) return 1;
  if (FX_RATES[from]?.[to]) return FX_RATES[from][to];
  if (FX_RATES[to]?.[from]) return 1 / FX_RATES[to][from];
  if (FX_RATES.USD[from] && FX_RATES.USD[to]) return FX_RATES.USD[to] / FX_RATES.USD[from];
  if (FX_RATES.USD[from]) return 1 / FX_RATES.USD[from];
  return null;
}

function calcFee(amount: number, type: string) {
  if (type === "internal") return 0;
  return Math.max(amount * FEE_RATE, MIN_FEE);
}

async function checkDailyLimit(userId: number, kycLevel: number, amountUSD: number) {
  const limit = KYC_LIMITS[kycLevel] || 100;
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const todayTxs = await db.select().from(transactionsTable).where(
    and(
      eq(transactionsTable.customerId, userId),
      eq(transactionsTable.type, "send"),
      gte(transactionsTable.createdAt, todayStart)
    )
  );
  const sentToday = todayTxs.filter(t => t.status !== "failed").reduce((s, t) => s + Number(t.amount || 0), 0);

  if (sentToday + amountUSD > limit) {
    const remaining = Math.max(0, limit - sentToday);
    return {
      allowed: false,
      message: `Daily limit: $${limit.toLocaleString()}. Sent today: $${sentToday.toLocaleString()}. Remaining: $${remaining.toLocaleString()}.${kycLevel < 2 ? " Complete KYC to increase your limit." : ""}`,
      code: "LIMIT_EXCEEDED",
      limit,
      sent_today: sentToday,
    };
  }
  return { allowed: true, limit, sent_today: sentToday };
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
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, req.user!.id));
  const kycLevel = Number(user?.kycLevel || 0);
  const limit = KYC_LIMITS[kycLevel] || 100;

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayTxs = await db.select().from(transactionsTable).where(
    and(eq(transactionsTable.customerId, req.user!.id), eq(transactionsTable.type, "send"), gte(transactionsTable.createdAt, todayStart))
  );
  const sentToday = todayTxs.filter(t => t.status !== "failed").reduce((s, t) => s + Number(t.amount || 0), 0);

  res.json({
    success: true, amount, fee, fee_percent: type === "internal" ? 0 : FEE_RATE * 100,
    total: amount + fee, daily_limit: limit, today_sent: sentToday,
    daily_remaining: Math.max(0, limit - sentToday), kyc_level: kycLevel,
  });
});

router.post("/transfers/bank", requireAuth, async (req: AuthenticatedRequest, res): Promise<void> => {
  const { wallet_id, currency, amount, account_number, bank_name, account_name, swift_code, description, recipient_currency, recipient_country } = req.body;
  if (!amount || amount <= 0) { res.status(400).json({ success: false, message: "Invalid amount" }); return; }

  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, req.user!.id));
  const kycLevel = Number(user?.kycLevel || 0);
  const limitCheck = await checkDailyLimit(req.user!.id, kycLevel, Number(amount));
  if (!limitCheck.allowed) { res.status(403).json({ success: false, ...limitCheck }); return; }

  const wallet = await getWallet(req.user!.id, wallet_id, currency);
  if (!wallet) { res.status(404).json({ success: false, message: "Wallet not found" }); return; }
  const fee = calcFee(Number(amount), "bank");
  const total = Number(amount) + fee;
  if (Number(wallet.balance) < total) { res.status(400).json({ success: false, message: "Insufficient funds" }); return; }

  const recipCurrency = recipient_currency || wallet.currency;
  let convertedAmount = Number(amount);
  let fxRate: number | null = 1;
  if (recipCurrency !== wallet.currency) {
    fxRate = getFxRate(wallet.currency, recipCurrency);
    if (!fxRate) { res.status(400).json({ success: false, message: `Exchange rate unavailable for ${wallet.currency} → ${recipCurrency}` }); return; }
    convertedAmount = Number(amount) * fxRate;
  }

  await db.update(walletsTable).set({ balance: String(Number(wallet.balance) - total) }).where(eq(walletsTable.id, wallet.id));
  const ref = "COBO-BANK-" + Date.now() + "-" + Math.random().toString(36).slice(2, 6).toUpperCase();
  const desc = description || `Bank transfer to ${account_name || bank_name}${recipCurrency !== wallet.currency ? ` (${wallet.currency} → ${recipCurrency})` : ""}`;
  await db.insert(transactionsTable).values({
    reference: ref, amount: String(amount), currency: wallet.currency, status: "completed", type: "send",
    customerId: req.user!.id, description: desc,
    paymentMethod: "bank",
  });
  await db.insert(notificationsTable).values({
    userId: req.user!.id, title: "Transfer Sent", message: `${wallet.currency} ${Number(amount).toLocaleString()} sent to ${account_name || bank_name}${recipCurrency !== wallet.currency ? ` (${recipCurrency} ${convertedAmount.toFixed(2)} received)` : ""}`, type: "success",
  });
  await db.insert(auditLogsTable).values({ userId: req.user!.id, action: "transfer_bank", ip: req.ip || "unknown", meta: { amount, currency: wallet.currency, recipient_currency: recipCurrency, fx_rate: fxRate, converted_amount: convertedAmount, recipient_country, ref } });
  emailService.sendTransferSentEmail(user, { amount: Number(amount), currency: wallet.currency, recipient: account_name || bank_name, reference: ref, fee }).catch(() => {});
  res.json({ success: true, message: "Transfer sent", reference: ref, fee, net_amount: Number(amount), recipient_currency: recipCurrency, converted_amount: convertedAmount, fx_rate: fxRate });
});

router.post("/transfers/mobile", requireAuth, async (req: AuthenticatedRequest, res): Promise<void> => {
  const { wallet_id, currency, amount, phone, provider, recipient_name, description, recipient_currency, recipient_country } = req.body;
  if (!amount || amount <= 0) { res.status(400).json({ success: false, message: "Invalid amount" }); return; }

  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, req.user!.id));
  const kycLevel = Number(user?.kycLevel || 0);
  const limitCheck = await checkDailyLimit(req.user!.id, kycLevel, Number(amount));
  if (!limitCheck.allowed) { res.status(403).json({ success: false, ...limitCheck }); return; }

  const wallet = await getWallet(req.user!.id, wallet_id, currency);
  if (!wallet) { res.status(404).json({ success: false, message: "Wallet not found" }); return; }
  const fee = calcFee(Number(amount), "mobile");
  const total = Number(amount) + fee;
  if (Number(wallet.balance) < total) { res.status(400).json({ success: false, message: "Insufficient funds" }); return; }

  const recipCurrency = recipient_currency || wallet.currency;
  let convertedAmount = Number(amount);
  let fxRate: number | null = 1;
  if (recipCurrency !== wallet.currency) {
    fxRate = getFxRate(wallet.currency, recipCurrency);
    if (!fxRate) { res.status(400).json({ success: false, message: `Exchange rate unavailable for ${wallet.currency} → ${recipCurrency}` }); return; }
    convertedAmount = Number(amount) * fxRate;
  }

  await db.update(walletsTable).set({ balance: String(Number(wallet.balance) - total) }).where(eq(walletsTable.id, wallet.id));
  const ref = "COBO-MOMO-" + Date.now() + "-" + Math.random().toString(36).slice(2, 6).toUpperCase();
  const desc = description || `${provider} to ${recipient_name || phone}${recipCurrency !== wallet.currency ? ` (${wallet.currency} → ${recipCurrency})` : ""}`;
  await db.insert(transactionsTable).values({
    reference: ref, amount: String(amount), currency: wallet.currency, status: "completed", type: "send",
    customerId: req.user!.id, description: desc,
    paymentMethod: provider || "mobile_money",
  });
  await db.insert(notificationsTable).values({
    userId: req.user!.id, title: "Mobile Money Sent", message: `${wallet.currency} ${Number(amount).toLocaleString()} sent via ${provider} to ${phone}${recipCurrency !== wallet.currency ? ` (${recipCurrency} ${convertedAmount.toFixed(2)} received)` : ""}`, type: "success",
  });
  await db.insert(auditLogsTable).values({ userId: req.user!.id, action: "transfer_mobile_money", ip: req.ip || "unknown", meta: { amount, currency: wallet.currency, recipient_currency: recipCurrency, fx_rate: fxRate, converted_amount: convertedAmount, recipient_country, provider, ref } });
  emailService.sendTransferSentEmail(user, { amount: Number(amount), currency: wallet.currency, recipient: recipient_name || phone, reference: ref, fee }).catch(() => {});
  res.json({ success: true, message: "Transfer sent", reference: ref, fee, recipient_currency: recipCurrency, converted_amount: convertedAmount, fx_rate: fxRate });
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
  await db.insert(notificationsTable).values({ userId: recipient.id, title: "Money Received!", message: `${senderWallet.currency} ${amount} received`, type: "success" });
  const [senderUser] = await db.select().from(usersTable).where(eq(usersTable.id, req.user!.id));
  const sName = `${senderUser.firstName} ${senderUser.lastName}`;
  const rName = `${recipient.firstName} ${recipient.lastName}`;
  emailService.sendTransferSentEmail(senderUser, { amount: Number(amount), currency: senderWallet.currency, recipient: rName, reference: ref, fee: 0 }).catch(() => {});
  emailService.sendTransferReceivedEmail(recipient, { amount: Number(amount), currency: senderWallet.currency, sender: sName, reference: ref }).catch(() => {});
  res.json({ success: true, message: "Transfer sent (free)", reference: ref });
});

export default router;
