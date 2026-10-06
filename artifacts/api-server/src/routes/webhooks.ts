import { Router, type Request, type Response, type NextFunction } from "express";
import { db, paymentIntentsTable, notificationsTable, type PaymentIntent } from "@workspace/db";
import { eq } from "drizzle-orm";
import { logger } from "../lib/logger.js";
import { emitPaymentUpdate } from "../services/socketio.js";
import { isProduction, safeEqual, verifyCallbackSecret } from "../lib/security.js";
import { finalizePayout } from "../lib/payouts.js";

const router = Router();

// Mobile-money providers don't sign their callbacks, so every callback URL we
// register carries an unguessable ?cb= secret (set at initiation time in
// transfers.ts). Fail closed: a webhook that can't prove its origin must never
// be able to mark payments successful and release locked funds.
function requireCallbackSecret(req: Request, res: Response, next: NextFunction): void {
  if (verifyCallbackSecret(req.query.cb)) { next(); return; }
  if (!isProduction()) {
    logger.warn({ path: req.path }, "Webhook accepted WITHOUT callback secret (non-production only)");
    next();
    return;
  }
  logger.warn({ path: req.path, ip: req.ip }, "Rejected webhook with missing/invalid callback secret");
  res.status(401).json({ message: "Unauthorized" });
}

// Every provider callback resolves its payout through finalizePayout, which acts only on a payout
// that is still pending: a replayed or late callback moves no money. Callbacks that report
// "still in progress" are ignored — only a definitive success or failure resolves a payout.
async function notifyResolved(intent: PaymentIntent, ok: boolean, provider: string, title: string, message: string, reference: string): Promise<void> {
  await db.insert(notificationsTable).values({ userId: intent.userId, title, message, type: ok ? "success" : "error" }).catch(() => {});
  emitPaymentUpdate(intent.userId, {
    reference: intent.transactionReference || reference,
    status: ok ? "completed" : "failed",
    amount: Number(intent.amount),
    currency: intent.currency,
    provider,
    message,
  });
  logger.info({ ref: intent.reference, provider, ok }, "Payout resolved via webhook");
}

router.post("/webhooks/flutterwave", async (req, res): Promise<void> => {
  // Flutterwave sends the configured hash in verif-hash — required, timing-safe
  const signature = req.headers["verif-hash"];
  const expected = process.env.FLUTTERWAVE_WEBHOOK_HASH;
  if (expected) {
    if (typeof signature !== "string" || !safeEqual(signature, expected)) {
      res.status(401).json({ message: "Invalid signature" });
      return;
    }
  } else if (isProduction()) {
    logger.error("FLUTTERWAVE_WEBHOOK_HASH not configured — rejecting webhook (fail closed)");
    res.status(401).json({ message: "Webhook verification not configured" });
    return;
  }

  const event = req.body as { event?: string; data?: { status?: string; tx_ref?: string; id?: number; amount?: number; currency?: string } };
  const ref = event.data?.tx_ref;
  const status = event.data?.status;
  if (ref && (status === "successful" || status === "failed")) {
    const ok = status === "successful";
    const intent = await finalizePayout(eq(paymentIntentsTable.reference, ref), ok ? "success" : "failed", {
      providerReference: event.data?.id ? String(event.data.id) : undefined,
      metadata: event.data as Record<string, unknown>,
    });
    if (intent) {
      const message = ok
        ? `Your transfer of ${intent.currency} ${Number(intent.amount).toLocaleString()} has been confirmed.`
        : `Your transfer of ${intent.currency} ${Number(intent.amount).toLocaleString()} failed and the funds were returned to your wallet.`;
      await notifyResolved(intent, ok, "flutterwave", ok ? "Payment Confirmed" : "Payment Failed", message, ref);
    }
  }

  res.json({ status: "ok" });
});

router.post("/webhooks/mpesa", requireCallbackSecret, async (req, res): Promise<void> => {
  const callback = (req.body as { Body?: { stkCallback?: { MerchantRequestID?: string; CheckoutRequestID?: string; ResultCode?: number; ResultDesc?: string; CallbackMetadata?: { Item?: Array<{ Name: string; Value?: unknown }> } } } })?.Body?.stkCallback;
  const checkoutRequestId = callback?.CheckoutRequestID;
  if (!callback || !checkoutRequestId || typeof callback.ResultCode !== "number") { res.json({ ResultCode: 0, ResultDesc: "Accepted" }); return; }

  const ok = callback.ResultCode === 0; // an STK callback is always a final result
  const mpesaRef = callback.CallbackMetadata?.Item?.find((i) => i.Name === "MpesaReceiptNumber")?.Value;
  const intent = await finalizePayout(eq(paymentIntentsTable.providerReference, checkoutRequestId), ok ? "success" : "failed", {
    metadata: { ...callback, mpesaReceiptNumber: mpesaRef } as Record<string, unknown>,
  });
  if (intent) {
    const message = ok
      ? `Your M-Pesa payment of ${intent.currency} ${Number(intent.amount).toLocaleString()} was successful. Receipt: ${mpesaRef}`
      : `Your M-Pesa payment of ${intent.currency} ${Number(intent.amount).toLocaleString()} failed: ${callback.ResultDesc}`;
    await notifyResolved(intent, ok, "mpesa", ok ? "M-Pesa Payment Confirmed" : "M-Pesa Payment Failed", message, checkoutRequestId);
  }

  res.json({ ResultCode: 0, ResultDesc: "Accepted" });
});

router.post("/webhooks/mtn", requireCallbackSecret, async (req, res): Promise<void> => {
  const { referenceId, status, financialTransactionId } = req.body as { referenceId?: string; status?: string; financialTransactionId?: string };
  // MTN MoMo: SUCCESSFUL and FAILED are final; PENDING (or anything else) is not a result.
  if (!referenceId || (status !== "SUCCESSFUL" && status !== "FAILED")) { res.json({ message: "ok" }); return; }

  const ok = status === "SUCCESSFUL";
  const intent = await finalizePayout(eq(paymentIntentsTable.providerReference, referenceId), ok ? "success" : "failed", {
    metadata: req.body as Record<string, unknown>,
  });
  if (intent) {
    const message = ok ? `MTN MoMo transfer confirmed. Ref: ${financialTransactionId || referenceId}` : "MTN MoMo transfer failed. The funds were returned to your wallet.";
    await notifyResolved(intent, ok, "mtn", ok ? "MTN MoMo Payment Confirmed" : "MTN MoMo Payment Failed", message, referenceId);
  }

  res.json({ message: "ok" });
});

router.post("/webhooks/airtel", requireCallbackSecret, async (req, res): Promise<void> => {
  const { transaction } = req.body as { transaction?: { id?: string; status?: string } };
  const ref = transaction?.id;
  // Airtel Money: TS = success, TF = failed; TIP/TA (in progress) are not results.
  if (!ref || (transaction?.status !== "TS" && transaction?.status !== "TF")) { res.json({ message: "ok" }); return; }

  const ok = transaction.status === "TS";
  const intent = await finalizePayout(eq(paymentIntentsTable.providerReference, ref), ok ? "success" : "failed", {
    metadata: req.body as Record<string, unknown>,
  });
  if (intent) {
    const message = ok ? "Airtel Money transfer confirmed." : "Airtel Money transfer failed. The funds were returned to your wallet.";
    await notifyResolved(intent, ok, "airtel", ok ? "Airtel Money Payment Confirmed" : "Airtel Money Payment Failed", message, ref);
  }

  res.json({ message: "ok" });
});

export default router;
