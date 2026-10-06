// Outgoing payouts (mobile money, bank) hold the sender's funds while the provider works. This module
// resolves a pending payout EXACTLY ONCE: the first resolution (provider callback, synchronous
// provider answer, or an operator) wins with a conditional status update; every later or replayed
// callback is a no-op, so a payout can never be refunded twice or refunded after it was paid.
import { and, eq, type SQL } from "drizzle-orm";
import { db, paymentIntentsTable, transactionsTable, type PaymentIntent } from "@workspace/db";
import { addAmounts, refundHold, releaseHold } from "./ledger.js";

export async function finalizePayout(
  where: SQL,
  outcome: "success" | "failed",
  extra: { providerReference?: string; metadata?: Record<string, unknown> } = {},
): Promise<PaymentIntent | null> {
  return db.transaction(async (tx) => {
    const [intent] = await tx
      .update(paymentIntentsTable)
      .set({
        status: outcome,
        ...(extra.providerReference ? { providerReference: extra.providerReference } : {}),
        ...(extra.metadata ? { metadata: extra.metadata } : {}),
      })
      .where(and(where, eq(paymentIntentsTable.status, "pending")))
      .returning();
    if (!intent) return null; // already resolved (or unknown): nothing moves

    if (intent.walletId) {
      const total = addAmounts(String(intent.amount), String(intent.fee ?? "0"));
      const ok = outcome === "success" ? await releaseHold(tx, intent.walletId, total) : await refundHold(tx, intent.walletId, total);
      // The hold was placed when the payout started; if it is not there the books disagree — stop
      // (the transaction rolls back and the payout stays pending for an operator).
      if (!ok) throw new Error(`payout ${intent.reference}: held funds missing on wallet ${intent.walletId}`);
    }
    if (intent.transactionReference) {
      await tx
        .update(transactionsTable)
        .set({ status: outcome === "success" ? "completed" : "failed" })
        .where(eq(transactionsTable.reference, intent.transactionReference));
    }
    return intent;
  });
}
