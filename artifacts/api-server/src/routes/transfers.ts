import { Router, type IRouter } from "express";
import { eq, and, desc } from "drizzle-orm";
import { db, walletsTable, transactionsTable, usersTable, notificationsTable, auditLogsTable, paymentIntentsTable } from "@workspace/db";
import { requireAuth, requireAdmin, type AuthenticatedRequest } from "../middlewares/requireAuth.js";
import { emailService } from "../services/email.js";
import { checkAndCreateCTR } from "../lib/ctr.js";
import { generateBankRef, generateMobileRef, generateInternalRef } from "../lib/refgen.js";
import { screenAgainstOFAC, assessCountryRisk as checkCountry } from "../lib/ofac.js";
import { getRate } from "../services/fxRates.js";
import { initiateTransfer } from "../services/paymentGateway.js";
import { checkDailyLimit, sentTodayUSD, KYC_LIMITS } from "../lib/limits.js";
import { getCallbackSecret } from "../lib/security.js";
import { parseAmount, toCents, addAmounts, hold, debit, credit, walletFor, InsufficientFunds } from "../lib/ledger.js";
import { finalizePayout } from "../lib/payouts.js";
import { isSandbox } from "../lib/environment.js";
import { logger } from "../lib/logger.js";

// Money rules for every route here (see lib/ledger.ts and lib/payouts.ts):
//  * amounts are exact cents; fees and FX conversions are rounded to cents once;
//  * every balance change is one atomic conditional update inside a database transaction;
//  * an outgoing payout HOLDS the funds and is resolved exactly once — by the provider's answer, its
//    callback, or an operator — never marked "completed" before money actually went out.

const router: IRouter = Router();
const FEE_RATE = 0.005;
const MIN_FEE = 0.25;
const INTL_FLAT_FEE = 0.99;

function calcFee(amount: number, type: string, isInternational: boolean = false): string {
  if (type === "internal") return "0.00";
  const percentFee = Math.max(amount * FEE_RATE, MIN_FEE);
  return toCents(isInternational ? percentFee + INTL_FLAT_FEE : percentFee);
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

/** Sanctions and country screening of the beneficiary; returns a refusal or null. */
function screenRecipient(name: string, country?: string): { status: number; body: Record<string, unknown> } | null {
  const ofac = screenAgainstOFAC(name);
  if (!ofac.clear && ofac.riskScore >= 80) {
    return { status: 403, body: { success: false, message: "This transfer has been flagged for compliance review. Please contact support.", code: "SANCTIONS_FLAG" } };
  }
  if (country) {
    const risk = checkCountry(country);
    if (risk.level === "high" || risk.level === "prohibited") {
      return { status: 403, body: { success: false, message: `Transfers to ${country} are blocked due to sanctions restrictions.`, code: "COUNTRY_BLOCKED" } };
    }
  }
  return null;
}

router.get("/transfers/fee", requireAuth, async (req: AuthenticatedRequest, res): Promise<void> => {
  const amount = parseFloat(String(req.query.amount)) || 0;
  const type = String(req.query.type || "bank");
  const fee = Number(calcFee(amount, type));
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, req.user!.id));
  const kycLevel = Number(user?.kycLevel || 0);
  const limit = KYC_LIMITS[kycLevel] || 100;
  const sentToday = await sentTodayUSD(req.user!.id);

  res.json({
    success: true, amount, fee, fee_percent: type === "internal" ? 0 : FEE_RATE * 100,
    total: Number(toCents(amount + fee)), daily_limit: limit, today_sent: sentToday,
    daily_remaining: Math.max(0, limit - sentToday), kyc_level: kycLevel,
  });
});

router.post("/transfers/bank", requireAuth, async (req: AuthenticatedRequest, res): Promise<void> => {
  const { wallet_id, currency, account_number, bank_name, account_name, description, recipient_currency, recipient_country } = req.body as Record<string, string>;
  const amount = parseAmount(req.body.amount);
  if (!amount) { res.status(400).json({ success: false, message: "Amount must be at least 0.01 with at most 2 decimal places" }); return; }
  if (!account_number || !(account_name || bank_name)) { res.status(400).json({ success: false, message: "Account number and account name are required" }); return; }

  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, req.user!.id));
  const kycLevel = Number(user?.kycLevel || 0);
  const limitCheck = await checkDailyLimit(req.user!.id, kycLevel, Number(amount));
  if (!limitCheck.allowed) { res.status(403).json({ success: false, ...limitCheck }); return; }

  const wallet = await getWallet(req.user!.id, wallet_id ? Number(wallet_id) : undefined, currency);
  if (!wallet) { res.status(404).json({ success: false, message: "Wallet not found" }); return; }
  const recipCurrency = recipient_currency || wallet.currency;
  const isInternational = recipCurrency !== wallet.currency;
  const fee = calcFee(Number(amount), "bank", isInternational);
  const total = addAmounts(amount, fee);

  let convertedAmount = amount;
  let fxRate: number | null = 1;
  if (isInternational) {
    fxRate = await getRate(wallet.currency, recipCurrency);
    if (!fxRate) { res.status(400).json({ success: false, message: `Exchange rate unavailable for ${wallet.currency} → ${recipCurrency}` }); return; }
    convertedAmount = toCents(Number(amount) * fxRate);
  }

  const recipientName = account_name || bank_name || "recipient";
  const refusal = screenRecipient(recipientName, recipient_country);
  if (refusal) { res.status(refusal.status).json(refusal.body); return; }

  const ref = generateBankRef();
  const desc = description || `Bank transfer to ${recipientName}${isInternational ? ` (${wallet.currency} → ${recipCurrency})` : ""}`;
  try {
    await db.transaction(async (tx) => {
      if (!(await hold(tx, wallet.id, total))) throw new InsufficientFunds();
      await tx.insert(transactionsTable).values({
        reference: ref, amount, currency: wallet.currency, status: "pending", type: "send",
        customerId: req.user!.id, description: desc, paymentMethod: "bank",
      });
      await tx.insert(paymentIntentsTable).values({
        reference: ref, transactionReference: ref, userId: req.user!.id, walletId: wallet.id,
        provider: "bank_payout", status: "pending", amount, currency: wallet.currency, fee,
        recipientName, recipientCountry: recipient_country || null, recipientCurrency: recipCurrency,
        metadata: { account_number, bank_name, account_name, isInternational, fxRate, convertedAmount } as Record<string, unknown>,
      });
    });
  } catch (err) {
    if (err instanceof InsufficientFunds) { res.status(400).json({ success: false, message: "Insufficient funds" }); return; }
    throw err;
  }

  // A sandbox has no bank to pay out to: the payout is simulated. On a LIVE installation the funds
  // stay held until an operator confirms the bank payout (POST /admin/payouts/:reference/complete).
  const simulated = isSandbox();
  if (simulated) await finalizePayout(eq(paymentIntentsTable.reference, ref), "success");

  await checkAndCreateCTR(req.user!.id, ref, Number(amount), wallet.currency, "bank_transfer");
  await db.insert(notificationsTable).values({
    userId: req.user!.id,
    title: simulated ? "Transfer Sent" : "Transfer Submitted",
    message: `${wallet.currency} ${Number(amount).toLocaleString()} ${simulated ? "sent" : "is being paid out"} to ${recipientName}${isInternational ? ` (${recipCurrency} ${convertedAmount} to be received)` : ""}`,
    type: simulated ? "success" : "info",
  });
  await db.insert(auditLogsTable).values({ userId: req.user!.id, action: "transfer_bank", ip: req.ip || "unknown", meta: { amount, currency: wallet.currency, recipient_currency: recipCurrency, fx_rate: fxRate, converted_amount: convertedAmount, recipient_country, ref, fee, is_international: isInternational, simulated } });
  if (simulated) emailService.sendTransferSentEmail(user, { amount: Number(amount), currency: wallet.currency, recipient: recipientName, reference: ref, fee: Number(fee) }).catch(() => {});
  res.json({
    success: true,
    message: simulated ? "Transfer sent (sandbox: payout simulated)" : "Transfer submitted — funds are held until the bank payout is confirmed",
    status: simulated ? "completed" : "pending",
    reference: ref, fee: Number(fee), net_amount: Number(amount), recipient_currency: recipCurrency,
    converted_amount: Number(convertedAmount), fx_rate: fxRate, is_international: isInternational,
  });
});

router.post("/transfers/mobile", requireAuth, async (req: AuthenticatedRequest, res): Promise<void> => {
  const { wallet_id, currency, phone, provider, recipient_name, description, recipient_currency, recipient_country } = req.body as Record<string, string>;
  const amount = parseAmount(req.body.amount);
  if (!amount) { res.status(400).json({ success: false, message: "Amount must be at least 0.01 with at most 2 decimal places" }); return; }
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
  const total = addAmounts(amount, fee);

  let convertedAmount = amount;
  let fxRate: number | null = 1;
  if (isInternational) {
    fxRate = await getRate(wallet.currency, recipCurrency);
    if (!fxRate) { res.status(400).json({ success: false, message: `Exchange rate unavailable for ${wallet.currency} → ${recipCurrency}` }); return; }
    convertedAmount = toCents(Number(amount) * fxRate);
  }

  const recipName = recipient_name || phone || "recipient";
  const refusal = screenRecipient(recipName, recipient_country);
  if (refusal) { res.status(refusal.status).json(refusal.body); return; }

  const ref = generateMobileRef();
  const desc = description || `${provider} to ${recipName}${recipCurrency !== wallet.currency ? ` (${wallet.currency} → ${recipCurrency})` : ""}`;

  // 1. Hold the funds and record the pending payout — one database transaction, committed BEFORE the
  //    provider is called, so a crash afterwards leaves a pending payout an operator can see.
  try {
    await db.transaction(async (tx) => {
      if (!(await hold(tx, wallet.id, total))) throw new InsufficientFunds();
      await tx.insert(transactionsTable).values({
        reference: ref, amount, currency: wallet.currency, status: "pending", type: "send",
        customerId: req.user!.id, description: desc, paymentMethod: provider || "mobile_money",
      });
      await tx.insert(paymentIntentsTable).values({
        reference: ref, transactionReference: ref, userId: req.user!.id, walletId: wallet.id,
        provider: String(provider || "mobile_money"), status: "pending", amount, currency: wallet.currency, fee,
        recipientPhone: String(phone), recipientName: recipName, recipientCountry: recipient_country || null,
        recipientCurrency: recipCurrency,
        metadata: { provider, isInternational, fxRate, convertedAmount } as Record<string, unknown>,
      });
    });
  } catch (err) {
    if (err instanceof InsufficientFunds) { res.status(400).json({ success: false, message: "Insufficient funds" }); return; }
    throw err;
  }

  const webhookBase = process.env.WEBHOOK_BASE_URL || process.env.PUBLIC_URL || "https://api.cob-o.com";
  // ?cb= proves the callback came through a URL only we and the provider know
  const callbackUrl = `${webhookBase}/api/webhooks/${
    (provider || "").toLowerCase().includes("pesa") || wallet.currency === "KES" ? "mpesa" :
    (provider || "").toLowerCase().includes("mtn") ? "mtn" :
    (provider || "").toLowerCase().includes("airtel") ? "airtel" :
    "flutterwave"
  }?cb=${getCallbackSecret()}`;

  // 2. Call the provider OUTSIDE any database transaction. If the call itself fails we do not know
  //    whether the money went out, so the payout stays pending (funds held) for the provider's
  //    callback or an operator — never refunded on a guess.
  let gatewayResult: Awaited<ReturnType<typeof initiateTransfer>>;
  try {
    gatewayResult = await initiateTransfer({
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
  } catch (err) {
    logger.error({ err, ref }, "Mobile-money provider call failed; payout left pending for reconciliation");
    res.status(202).json({ success: true, message: "Transfer submitted — awaiting provider confirmation", reference: ref, status: "pending" });
    return;
  }

  await db.update(paymentIntentsTable)
    .set({ provider: gatewayResult.provider, providerReference: gatewayResult.providerReference || null })
    .where(eq(paymentIntentsTable.reference, ref));

  // 3. A synchronous final answer resolves the payout now (exactly once).
  if (gatewayResult.status === "success" || gatewayResult.status === "failed") {
    await finalizePayout(eq(paymentIntentsTable.reference, ref), gatewayResult.status);
  }
  if (gatewayResult.status === "success") {
    await checkAndCreateCTR(req.user!.id, ref, Number(amount), wallet.currency, "mobile_money");
    await db.insert(notificationsTable).values({
      userId: req.user!.id, title: "Mobile Money Sent",
      message: `${wallet.currency} ${Number(amount).toLocaleString()} sent via ${provider} to ${phone}${recipCurrency !== wallet.currency ? ` (${recipCurrency} ${convertedAmount} received)` : ""}`,
      type: "success",
    });
    emailService.sendTransferSentEmail(user, { amount: Number(amount), currency: wallet.currency, recipient: recipName, reference: ref, fee: Number(fee) }).catch(() => {});
  }

  await db.insert(auditLogsTable).values({
    userId: req.user!.id, action: "transfer_mobile_money", ip: req.ip || "unknown",
    meta: { amount, currency: wallet.currency, recipient_currency: recipCurrency, fx_rate: fxRate, converted_amount: convertedAmount, recipient_country, provider: gatewayResult.provider, ref, gateway_status: gatewayResult.status },
  });

  if (gatewayResult.status === "failed") {
    res.status(400).json({ success: false, message: `${gatewayResult.message || "Payment initiation failed"}. Your funds were not sent.`, reference: ref });
    return;
  }

  res.json({
    success: true,
    message: gatewayResult.status === "success"
      ? (gatewayResult.provider === "mock" ? "Transfer sent (sandbox: payout simulated)" : "Transfer sent")
      : "Transfer initiated — waiting for confirmation on your phone",
    reference: ref,
    status: gatewayResult.status === "success" ? "completed" : "pending",
    requiresAction: gatewayResult.requiresAction || false,
    provider: gatewayResult.provider,
    fee: Number(fee),
    recipient_currency: recipCurrency,
    converted_amount: Number(convertedAmount),
    fx_rate: fxRate,
  });
});

router.post("/transfers/internal", requireAuth, async (req: AuthenticatedRequest, res): Promise<void> => {
  const { wallet_id, recipient_email, email, currency, note, description } = req.body as Record<string, string>;
  const recipientEmail = String(recipient_email || email || "").trim().toLowerCase();
  const amount = parseAmount(req.body.amount);
  if (!recipientEmail || !amount) { res.status(400).json({ success: false, message: "A recipient and an amount of at least 0.01 with at most 2 decimal places are required" }); return; }
  const [recipient] = await db.select().from(usersTable).where(eq(usersTable.email, recipientEmail));
  if (!recipient) { res.status(404).json({ success: false, message: "Recipient not found on IAPAY" }); return; }
  if (recipient.id === req.user!.id) { res.status(400).json({ success: false, message: "Cannot send to yourself" }); return; }

  const [senderUser] = await db.select().from(usersTable).where(eq(usersTable.id, req.user!.id));
  const limitCheck = await checkDailyLimit(req.user!.id, Number(senderUser?.kycLevel || 0), Number(amount));
  if (!limitCheck.allowed) { res.status(403).json({ success: false, ...limitCheck }); return; }

  const senderWallet = await getWallet(req.user!.id, wallet_id ? Number(wallet_id) : undefined, currency ?? undefined);
  if (!senderWallet) { res.status(404).json({ success: false, message: "Wallet not found" }); return; }

  const ref = generateInternalRef();
  const desc = note || description || `Internal transfer to ${recipient.email}`;
  try {
    // Debit and credit commit together or not at all.
    await db.transaction(async (tx) => {
      if (!(await debit(tx, senderWallet.id, amount))) throw new InsufficientFunds();
      const recipientWallet = await walletFor(tx, recipient.id, senderWallet.currency);
      await credit(tx, recipientWallet.id, amount);
      await tx.insert(transactionsTable).values({ reference: ref, amount, currency: senderWallet.currency, status: "completed", type: "send", customerId: req.user!.id, description: desc, paymentMethod: "internal" });
      await tx.insert(transactionsTable).values({ reference: ref + "-R", amount, currency: senderWallet.currency, status: "completed", type: "deposit", customerId: recipient.id, description: `Internal transfer from ${req.user!.email}`, paymentMethod: "internal" });
    });
  } catch (err) {
    if (err instanceof InsufficientFunds) { res.status(400).json({ success: false, message: "Insufficient funds" }); return; }
    throw err;
  }

  await db.insert(notificationsTable).values({ userId: recipient.id, title: "Money Received!", message: `${senderWallet.currency} ${amount} received`, type: "success" });
  const sName = `${senderUser.firstName} ${senderUser.lastName}`;
  const rName = `${recipient.firstName} ${recipient.lastName}`;
  emailService.sendTransferSentEmail(senderUser, { amount: Number(amount), currency: senderWallet.currency, recipient: rName, reference: ref, fee: 0 }).catch(() => {});
  emailService.sendTransferReceivedEmail(recipient, { amount: Number(amount), currency: senderWallet.currency, sender: sName, reference: ref }).catch(() => {});
  res.json({ success: true, message: "Transfer sent (free)", reference: ref });
});

router.get("/transfers/status/:reference", requireAuth, async (req: AuthenticatedRequest, res): Promise<void> => {
  const reference = String(req.params.reference);
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

// ---------- Operator payout desk ----------
// Payouts that are still pending (bank payouts on a live installation, or mobile-money payouts whose
// provider never answered). An operator resolves each one exactly once, after checking the bank or
// provider statement: "complete" releases the held funds, "fail" returns them to the customer.

router.get("/admin/payouts", requireAuth, requireAdmin, async (req: AuthenticatedRequest, res): Promise<void> => {
  const status = typeof req.query.status === "string" ? req.query.status : "pending";
  const payouts = await db.select().from(paymentIntentsTable)
    .where(eq(paymentIntentsTable.status, status))
    .orderBy(desc(paymentIntentsTable.createdAt))
    .limit(200);
  res.json({ success: true, payouts: payouts.map((p) => ({ ...p, amount: Number(p.amount), fee: Number(p.fee ?? 0) })) });
});

for (const action of ["complete", "fail"] as const) {
  router.post(`/admin/payouts/:reference/${action}`, requireAuth, requireAdmin, async (req: AuthenticatedRequest, res): Promise<void> => {
    const reference = String(req.params.reference);
    const note = typeof req.body?.note === "string" ? req.body.note.slice(0, 500) : undefined;
    if (!note) { res.status(400).json({ success: false, message: "A note (e.g. the bank or provider confirmation reference) is required" }); return; }
    const outcome = action === "complete" ? "success" : "failed";
    const intent = await finalizePayout(eq(paymentIntentsTable.reference, reference), outcome);
    if (!intent) { res.status(409).json({ success: false, message: "Payout not found or already resolved" }); return; }
    await db.insert(auditLogsTable).values({ userId: req.user!.id, action: `payout_${action}`, ip: req.ip || "unknown", meta: { reference, note, amount: intent.amount, currency: intent.currency } });
    await db.insert(notificationsTable).values({
      userId: intent.userId,
      title: outcome === "success" ? "Transfer Completed" : "Transfer Failed",
      message: outcome === "success"
        ? `Your transfer of ${intent.currency} ${Number(intent.amount).toLocaleString()} has been paid out.`
        : `Your transfer of ${intent.currency} ${Number(intent.amount).toLocaleString()} could not be paid out; the funds were returned to your wallet.`,
      type: outcome === "success" ? "success" : "error",
    });
    res.json({ success: true, message: outcome === "success" ? "Payout marked complete" : "Payout failed and funds returned", reference, status: outcome });
  });
}

export default router;
