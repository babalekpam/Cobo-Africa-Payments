import { Router } from "express";
import { db, transactionsTable, paymentIntentsTable, walletsTable, notificationsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { logger } from "../lib/logger.js";

const router = Router();

router.post("/webhooks/flutterwave", async (req, res): Promise<void> => {
  const signature = req.headers["verif-hash"] as string;
  if (process.env.FLUTTERWAVE_WEBHOOK_HASH && signature !== process.env.FLUTTERWAVE_WEBHOOK_HASH) {
    res.status(401).json({ message: "Invalid signature" });
    return;
  }

  const event = req.body as { event?: string; data?: { status?: string; tx_ref?: string; id?: number; amount?: number; currency?: string } };

  if (event.event === "charge.completed" && event.data?.status === "successful") {
    const ref = event.data.tx_ref;
    if (!ref) { res.json({ status: "ok" }); return; }

    const [intent] = await db.select().from(paymentIntentsTable).where(eq(paymentIntentsTable.reference, ref));
    if (intent && intent.status === "pending") {
      await db.update(paymentIntentsTable).set({
        status: "success",
        providerReference: event.data.id ? String(event.data.id) : intent.providerReference,
        metadata: event.data as Record<string, unknown>,
      }).where(eq(paymentIntentsTable.reference, ref));

      if (intent.transactionReference) {
        await db.update(transactionsTable).set({ status: "completed" }).where(eq(transactionsTable.reference, intent.transactionReference));
      }

      if (intent.walletId) {
        const [wallet] = await db.select().from(walletsTable).where(eq(walletsTable.id, intent.walletId));
        if (wallet) {
          const locked = Number(wallet.lockedBalance || 0);
          const fee = Number(intent.fee || 0);
          const total = Number(intent.amount) + fee;
          if (locked >= total) {
            await db.update(walletsTable).set({
              lockedBalance: String(Math.max(0, locked - total)),
            }).where(eq(walletsTable.id, intent.walletId));
          }
        }
      }

      await db.insert(notificationsTable).values({
        userId: intent.userId,
        title: "Payment Confirmed",
        message: `Your transfer of ${intent.currency} ${Number(intent.amount).toLocaleString()} has been confirmed.`,
        type: "success",
      }).catch(() => {});

      logger.info({ ref, provider: "flutterwave" }, "Payment confirmed via webhook");
    }
  }

  res.json({ status: "ok" });
});

router.post("/webhooks/mpesa", async (req, res): Promise<void> => {
  const callback = (req.body as { Body?: { stkCallback?: { MerchantRequestID?: string; CheckoutRequestID?: string; ResultCode?: number; ResultDesc?: string; CallbackMetadata?: { Item?: Array<{ Name: string; Value?: unknown }> } } } })?.Body?.stkCallback;
  if (!callback) { res.json({ ResultCode: 0, ResultDesc: "Accepted" }); return; }

  const resultCode = callback.ResultCode;
  const checkoutRequestId = callback.CheckoutRequestID;
  const isSuccess = resultCode === 0;

  if (!checkoutRequestId) { res.json({ ResultCode: 0, ResultDesc: "Accepted" }); return; }

  const intents = await db.select().from(paymentIntentsTable).where(eq(paymentIntentsTable.providerReference, checkoutRequestId));
  const intent = intents[0];

  if (intent) {
    const newStatus = isSuccess ? "success" : "failed";
    const mpesaRef = callback.CallbackMetadata?.Item?.find((i) => i.Name === "MpesaReceiptNumber")?.Value;

    await db.update(paymentIntentsTable).set({
      status: newStatus,
      metadata: { ...callback, mpesaReceiptNumber: mpesaRef } as Record<string, unknown>,
    }).where(eq(paymentIntentsTable.id, intent.id));

    if (intent.transactionReference) {
      await db.update(transactionsTable).set({ status: isSuccess ? "completed" : "failed" }).where(eq(transactionsTable.reference, intent.transactionReference));
    }

    if (intent.walletId) {
      const [wallet] = await db.select().from(walletsTable).where(eq(walletsTable.id, intent.walletId));
      if (wallet) {
        const locked = Number(wallet.lockedBalance || 0);
        const total = Number(intent.amount) + Number(intent.fee || 0);
        if (isSuccess) {
          await db.update(walletsTable).set({
            lockedBalance: String(Math.max(0, locked - total)),
          }).where(eq(walletsTable.id, intent.walletId));
        } else {
          // Refund locked funds back to available balance
          await db.update(walletsTable).set({
            balance: String(Number(wallet.balance) + total),
            lockedBalance: String(Math.max(0, locked - total)),
          }).where(eq(walletsTable.id, intent.walletId));
        }
      }
    }

    await db.insert(notificationsTable).values({
      userId: intent.userId,
      title: isSuccess ? "M-Pesa Payment Confirmed" : "M-Pesa Payment Failed",
      message: isSuccess
        ? `Your M-Pesa payment of KES ${Number(intent.amount).toLocaleString()} was successful. Receipt: ${mpesaRef}`
        : `Your M-Pesa payment of KES ${Number(intent.amount).toLocaleString()} failed: ${callback.ResultDesc}`,
      type: isSuccess ? "success" : "error",
    }).catch(() => {});
  }

  res.json({ ResultCode: 0, ResultDesc: "Accepted" });
});

router.post("/webhooks/mtn", async (req, res): Promise<void> => {
  const { referenceId, status, financialTransactionId } = req.body as { referenceId?: string; status?: string; financialTransactionId?: string };
  if (!referenceId) { res.json({ message: "ok" }); return; }

  const intents = await db.select().from(paymentIntentsTable).where(eq(paymentIntentsTable.providerReference, referenceId));
  const intent = intents[0];

  if (intent) {
    const isSuccess = status === "SUCCESSFUL";
    await db.update(paymentIntentsTable).set({
      status: isSuccess ? "success" : "failed",
      metadata: req.body as Record<string, unknown>,
    }).where(eq(paymentIntentsTable.id, intent.id));

    if (intent.transactionReference) {
      await db.update(transactionsTable).set({ status: isSuccess ? "completed" : "failed" }).where(eq(transactionsTable.reference, intent.transactionReference));
    }

    await db.insert(notificationsTable).values({
      userId: intent.userId,
      title: isSuccess ? "MTN MoMo Payment Confirmed" : "MTN MoMo Payment Failed",
      message: isSuccess
        ? `MTN MoMo transfer confirmed. Ref: ${financialTransactionId || referenceId}`
        : `MTN MoMo transfer failed.`,
      type: isSuccess ? "success" : "error",
    }).catch(() => {});
  }

  res.json({ message: "ok" });
});

router.post("/webhooks/airtel", async (req, res): Promise<void> => {
  const { transaction } = req.body as { transaction?: { id?: string; status?: string } };
  if (!transaction) { res.json({ message: "ok" }); return; }

  const ref = transaction.id;
  const isSuccess = transaction.status === "TS";

  if (!ref) { res.json({ message: "ok" }); return; }

  const intents = await db.select().from(paymentIntentsTable).where(eq(paymentIntentsTable.providerReference, ref));
  const intent = intents[0];

  if (intent) {
    await db.update(paymentIntentsTable).set({
      status: isSuccess ? "success" : "failed",
      metadata: req.body as Record<string, unknown>,
    }).where(eq(paymentIntentsTable.id, intent.id));

    if (intent.transactionReference) {
      await db.update(transactionsTable).set({ status: isSuccess ? "completed" : "failed" }).where(eq(transactionsTable.reference, intent.transactionReference));
    }

    await db.insert(notificationsTable).values({
      userId: intent.userId,
      title: isSuccess ? "Airtel Money Payment Confirmed" : "Airtel Money Payment Failed",
      message: isSuccess ? "Airtel Money transfer confirmed." : "Airtel Money transfer failed.",
      type: isSuccess ? "success" : "error",
    }).catch(() => {});
  }

  res.json({ message: "ok" });
});

export default router;
