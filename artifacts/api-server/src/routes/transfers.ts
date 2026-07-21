import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import { db, walletsTable, transactionsTable, usersTable, notificationsTable, auditLogsTable, paymentIntentsTable } from "@workspace/db";
import { requireAuth, type AuthenticatedRequest } from "../middlewares/requireAuth.js";
import { emailService } from "../services/email.js";
import { checkAndCreateCTR } from "../lib/ctr.js";
import { generateBankRef, generateMobileRef, generateInternalRef } from "../lib/refgen.js";
import { screenAgainstOFAC, assessCountryRisk as checkCountry } from "../lib/ofac.js";
import { getRate } from "../services/fxRates.js";
import { initiateTransfer } from "../services/paymentGateway.js";
import { checkDailyLimit, sentTodayUSD, KYC_LIMITS } from "../lib/limits.js";
import { getCallbackSecret } from "../lib/security.js";

const router: IRouter = Router();
const FEE_RATE = 0.005;
const MIN_FEE = 0.25;
const INTL_FLAT_FEE = 0.99;

function calcFee(amount: number, type: string, isInternational: boolean = false) {
  if (type === "internal") return 0;
  const percentFee = Math.max(amount * FEE_RATE, MIN_FEE);
  return isInternational ? percentFee + INTL_FLAT_FEE : percentFee;
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
  const sentToday = await sentTodayUSD(req.user!.id);

  res.json({
    success: true, amount, fee, fee_percent: type === "internal" ? 0 : FEE_RATE * 100,
    total: amount + fee, daily_limit: limit, today_sent: sentToday,
    daily_remaining: Math.max(0, limit - sentToday), kyc_level: kycLevel,
  });
});

router.post("/transfers/bank", requireAuth, async (req: AuthenticatedRequest, res): Promise<void> => {
  const { wallet_id, currency, amount, account_number, bank_name, account_name, swift_code, description, recipient_currency, recipient_country } = req.body as Record<string, string>;
  if (!amount || Number(amount) <= 0) { res.status(400).json({ success: false, message: "Invalid amount" }); return; }

  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, req.user!.id));
  const kycLevel = Number(user?.kycLevel || 0);
  const limitCheck = await checkDailyLimit(req.user!.id, kycLevel, Number(amount));
  if (!limitCheck.allowed) { res.status(403).json({ success: false, ...limitCheck }); return; }

  const wallet = await getWallet(req.user!.id, wallet_id ? Number(wallet_id) : undefined, currency);
  if (!wallet) { res.status(404).json({ success: false, message: "Wallet not found" }); return; }
  const recipCurrency = recipient_currency || wallet.currency;
  const isInternational = recipCurrency !== wallet.currency;
  const fee = calcFee(Number(amount), "bank", isInternational);
  const total = Number(amount) + fee;
  if (Number(wallet.balance) < total) { res.status(400).json({ success: false, message: "Insufficient funds" }); return; }

  let convertedAmount = Number(amount);
  let fxRate: number | null = 1;
  if (isInternational) {
    fxRate = await getRate(wallet.currency, recipCurrency);
    if (!fxRate) { res.status(400).json({ success: false, message: `Exchange rate unavailable for ${wallet.currency} → ${recipCurrency}` }); return; }
    convertedAmount = Number(amount) * fxRate;
  }

  const recipientName = account_name || bank_name || "recipient";
  const ofacResult = screenAgainstOFAC(recipientName);
  if (!ofacResult.clear && ofacResult.riskScore >= 80) {
    res.status(403).json({ success: false, message: "This transfer has been flagged for compliance review. Please contact support.", code: "SANCTIONS_FLAG" });
    return;
  }
  if (recipient_country) {
    const countryRisk = checkCountry(recipient_country);
    if (countryRisk.level === "high" || countryRisk.level === "prohibited") {
      res.status(403).json({ success: false, message: `Transfers to ${recipient_country} are blocked due to sanctions restrictions.`, code: "COUNTRY_BLOCKED" });
      return;
    }
  }

  await db.update(walletsTable).set({ balance: String(Number(wallet.balance) - total) }).where(eq(walletsTable.id, wallet.id));
  const ref = generateBankRef();
  const desc = description || `Bank transfer to ${recipientName}${isInternational ? ` (${wallet.currency} → ${recipCurrency})` : ""}`;
  await db.insert(transactionsTable).values({
    reference: ref, amount: String(amount), currency: wallet.currency, status: "completed", type: "send",
    customerId: req.user!.id, description: desc,
    paymentMethod: "bank",
  });
  await checkAndCreateCTR(req.user!.id, ref, Number(amount), wallet.currency, "bank_transfer");
  await db.insert(notificationsTable).values({
    userId: req.user!.id, title: "Transfer Sent", message: `${wallet.currency} ${Number(amount).toLocaleString()} sent to ${recipientName}${isInternational ? ` (${recipCurrency} ${convertedAmount.toFixed(2)} received)` : ""}`, type: "success",
  });
  await db.insert(auditLogsTable).values({ userId: req.user!.id, action: "transfer_bank", ip: req.ip || "unknown", meta: { amount, currency: wallet.currency, recipient_currency: recipCurrency, fx_rate: fxRate, converted_amount: convertedAmount, recipient_country, ref, fee, is_international: isInternational } });
  emailService.sendTransferSentEmail(user, { amount: Number(amount), currency: wallet.currency, recipient: recipientName, reference: ref, fee }).catch(() => {});
  res.json({ success: true, message: "Transfer sent", reference: ref, fee, net_amount: Number(amount), recipient_currency: recipCurrency, converted_amount: convertedAmount, fx_rate: fxRate, is_international: isInternational });
});

router.post("/transfers/mobile", requireAuth, async (req: AuthenticatedRequest, res): Promise<void> => {
  const { wallet_id, currency, amount, phone, provider, recipient_name, description, recipient_currency, recipient_country } = req.body as Record<string, string>;

  if (!amount || Number(amount) <= 0) { res.status(400).json({ success: false, message: "Invalid amount" }); return; }
  if (!phone) { res.status(400).json({ success: false, message: "Phone number is required" }); return; }

  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, req.user!.id));
  const kycLevel = Number(user?.kycLevel || 0);
  const limitCheck = await checkDailyLimit(req.user!.id, kycLevel, Number(amount));
  if (!limitCheck.allowed) { res.status(403).json({ success: false, ...limitCheck }); return; }

  const wallet = await getWallet(req.user!.id, wallet_id ? Number(wallet_id) : undefined, currency);
  if (!wallet) { res.status(404).json({ success: false, message: "Wallet not found" }); return; }
  const recipCurrency = recipient_currency || wallet.currency;
  const isInternational = recipCurrency !== wallet.currency;
  const fee = calcFee(Number(amount), "mobile", isInternational);
  const total = Number(amount) + fee;
  if (Number(wallet.balance) < total) { res.status(400).json({ success: false, message: "Insufficient funds" }); return; }

  let convertedAmount = Number(amount);
  let fxRate: number | null = 1;
  if (isInternational) {
    fxRate = await getRate(wallet.currency, recipCurrency);
    if (!fxRate) { res.status(400).json({ success: false, message: `Exchange rate unavailable for ${wallet.currency} → ${recipCurrency}` }); return; }
    convertedAmount = Number(amount) * fxRate;
  }

  const recipName = recipient_name || phone || "recipient";
  const ofacMobile = screenAgainstOFAC(recipName);
  if (!ofacMobile.clear && ofacMobile.riskScore >= 80) {
    res.status(403).json({ success: false, message: "This transfer has been flagged for compliance review. Please contact support.", code: "SANCTIONS_FLAG" });
    return;
  }
  if (recipient_country) {
    const countryRisk = checkCountry(recipient_country);
    if (countryRisk.level === "high" || countryRisk.level === "prohibited") {
      res.status(403).json({ success: false, message: `Transfers to ${recipient_country} are blocked due to sanctions restrictions.`, code: "COUNTRY_BLOCKED" });
      return;
    }
  }

  // Lock funds instead of deducting immediately
  await db.update(walletsTable).set({
    balance: String(Number(wallet.balance) - total),
    lockedBalance: String(Number(wallet.lockedBalance || 0) + total),
  }).where(eq(walletsTable.id, wallet.id));

  const ref = generateMobileRef();
  const desc = description || `${provider} to ${recipName}${recipCurrency !== wallet.currency ? ` (${wallet.currency} → ${recipCurrency})` : ""}`;

  await db.insert(transactionsTable).values({
    reference: ref, amount: String(amount), currency: wallet.currency, status: "pending", type: "send",
    customerId: req.user!.id, description: desc,
    paymentMethod: provider || "mobile_money",
  });

  const webhookBase = process.env.WEBHOOK_BASE_URL || "https://api.cob-o.com";
  // ?cb= proves the callback came through a URL only we and the provider know
  const callbackUrl = `${webhookBase}/api/webhooks/${
    (provider || "").toLowerCase().includes("pesa") || wallet.currency === "KES" ? "mpesa" :
    (provider || "").toLowerCase().includes("mtn") ? "mtn" :
    (provider || "").toLowerCase().includes("airtel") ? "airtel" :
    "flutterwave"
  }?cb=${getCallbackSecret()}`;

  const gatewayResult = await initiateTransfer({
    amount: Number(amount),
    currency: wallet.currency,
    phone: String(phone),
    email: user.email,
    name: `${user.firstName} ${user.lastName}`,
    reference: ref,
    country: recipient_country || "",
    providerName: String(provider || ""),
    callbackUrl,
  });

  await db.insert(paymentIntentsTable).values({
    reference: ref,
    transactionReference: ref,
    userId: req.user!.id,
    walletId: wallet.id,
    provider: gatewayResult.provider,
    providerReference: gatewayResult.providerReference,
    status: gatewayResult.status === "success" ? "success" : gatewayResult.status === "failed" ? "failed" : "pending",
    amount: String(amount),
    currency: wallet.currency,
    recipientPhone: String(phone),
    recipientName: recipName,
    recipientCountry: recipient_country || null,
    recipientCurrency: recipCurrency,
    fee: String(fee),
    metadata: { provider, isInternational, fxRate, convertedAmount } as Record<string, unknown>,
  });

  if (gatewayResult.status === "success") {
    // Provider confirmed synchronously — finalize immediately
    await db.update(transactionsTable).set({ status: "completed" }).where(eq(transactionsTable.reference, ref));
    await db.update(walletsTable).set({
      lockedBalance: String(Math.max(0, Number(wallet.lockedBalance || 0) + total - total)),
    }).where(eq(walletsTable.id, wallet.id));
    await checkAndCreateCTR(req.user!.id, ref, Number(amount), wallet.currency, "mobile_money");
    await db.insert(notificationsTable).values({
      userId: req.user!.id, title: "Mobile Money Sent",
      message: `${wallet.currency} ${Number(amount).toLocaleString()} sent via ${provider} to ${phone}${recipCurrency !== wallet.currency ? ` (${recipCurrency} ${convertedAmount.toFixed(2)} received)` : ""}`,
      type: "success",
    });
    emailService.sendTransferSentEmail(user, { amount: Number(amount), currency: wallet.currency, recipient: recipName, reference: ref, fee }).catch(() => {});
  } else if (gatewayResult.status === "failed") {
    // Refund locked funds
    await db.update(walletsTable).set({
      balance: String(Number(wallet.balance) - total + total),
      lockedBalance: String(Math.max(0, Number(wallet.lockedBalance || 0))),
    }).where(eq(walletsTable.id, wallet.id));
    await db.update(transactionsTable).set({ status: "failed" }).where(eq(transactionsTable.reference, ref));
  }

  await db.insert(auditLogsTable).values({
    userId: req.user!.id, action: "transfer_mobile_money", ip: req.ip || "unknown",
    meta: { amount, currency: wallet.currency, recipient_currency: recipCurrency, fx_rate: fxRate, converted_amount: convertedAmount, recipient_country, provider: gatewayResult.provider, ref, gateway_status: gatewayResult.status },
  });

  if (!gatewayResult.success && gatewayResult.status === "failed") {
    res.status(400).json({ success: false, message: gatewayResult.message || "Payment initiation failed", reference: ref });
    return;
  }

  res.json({
    success: true,
    message: gatewayResult.status === "success"
      ? "Transfer sent"
      : "Transfer initiated — waiting for confirmation on your phone",
    reference: ref,
    status: gatewayResult.status === "success" ? "completed" : "pending",
    requiresAction: gatewayResult.requiresAction || false,
    provider: gatewayResult.provider,
    fee,
    recipient_currency: recipCurrency,
    converted_amount: convertedAmount,
    fx_rate: fxRate,
  });
});

router.post("/transfers/internal", requireAuth, async (req: AuthenticatedRequest, res): Promise<void> => {
  const { wallet_id, recipient_email, email, currency, amount, note, description } = req.body as Record<string, string>;
  const recipientEmail = recipient_email || email;
  if (!recipientEmail || !amount || Number(amount) <= 0) { res.status(400).json({ success: false, message: "Invalid data" }); return; }
  const [recipient] = await db.select().from(usersTable).where(eq(usersTable.email, recipientEmail));
  if (!recipient) { res.status(404).json({ success: false, message: "Recipient not found on IAPAY" }); return; }
  if (recipient.id === req.user!.id) { res.status(400).json({ success: false, message: "Cannot send to yourself" }); return; }
  const senderWallet = await getWallet(req.user!.id, wallet_id ? Number(wallet_id) : undefined, currency ?? undefined);
  if (!senderWallet || Number(senderWallet.balance) < Number(amount)) { res.status(400).json({ success: false, message: "Insufficient funds" }); return; }
  let [recipientWallet] = await db.select().from(walletsTable).where(and(eq(walletsTable.userId, recipient.id), eq(walletsTable.currency, senderWallet.currency)));
  if (!recipientWallet) {
    [recipientWallet] = await db.insert(walletsTable).values({ userId: recipient.id, currency: senderWallet.currency }).returning();
  }
  await db.update(walletsTable).set({ balance: String(Number(senderWallet.balance) - Number(amount)) }).where(eq(walletsTable.id, senderWallet.id));
  await db.update(walletsTable).set({ balance: String(Number(recipientWallet.balance) + Number(amount)) }).where(eq(walletsTable.id, recipientWallet.id));
  const ref = generateInternalRef();
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

router.get("/transfers/status/:reference", requireAuth, async (req: AuthenticatedRequest, res): Promise<void> => {
  const { reference } = req.params;
  const [intent] = await db.select().from(paymentIntentsTable).where(
    and(eq(paymentIntentsTable.reference, reference), eq(paymentIntentsTable.userId, req.user!.id))
  );

  if (!intent) {
    res.status(404).json({ success: false, message: "Payment intent not found" });
    return;
  }

  res.json({
    success: true,
    status: intent.status,
    providerReference: intent.providerReference,
    amount: intent.amount,
    currency: intent.currency,
    provider: intent.provider,
    createdAt: intent.createdAt,
  });
});

export default router;
