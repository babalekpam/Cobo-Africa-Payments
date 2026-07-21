// Afrix Returns — payment returns and the dispute path (equivalent of Pix's
// devolução + MED). A return is a new scheme transfer travelling the original
// path in reverse: the recipient gives back what they received, in the currency
// they received it, and the original transfer is marked "returned". Returns are
// allowed for 90 days, by the recipient voluntarily or forced by the scheme
// operator when a dispute is resolved in the sender's favour.

import { eq, and, sql } from "drizzle-orm";
import {
  db,
  walletsTable,
  transactionsTable,
  notificationsTable,
  auditLogsTable,
  schemeTransfersTable,
  settlementBatchesTable,
  type SchemeTransfer,
} from "@workspace/db";
import { generateRef } from "../../lib/refgen.js";
import { emitPaymentUpdate } from "../socketio.js";
import { generateEndToEndId } from "./switchEngine.js";
import { getHomeParticipant } from "./directory.js";

export const RETURN_WINDOW_DAYS = 90;

export interface ReturnResult {
  ok: boolean;
  status: number;
  message: string;
  returnTransfer?: SchemeTransfer;
}

// initiatedBy: "recipient" for a voluntary return, "operator" for a dispute refund.
export async function returnSchemeTransfer(
  originalReference: string,
  actorUserId: number,
  reason: string,
  initiatedBy: "recipient" | "operator"
): Promise<ReturnResult> {
  const [original] = await db
    .select()
    .from(schemeTransfersTable)
    .where(eq(schemeTransfersTable.reference, originalReference));
  if (!original) return { ok: false, status: 404, message: "Original transfer not found" };

  if (initiatedBy === "recipient" && original.recipientUserId !== actorUserId) {
    return { ok: false, status: 403, message: "Only the recipient of a payment can return it" };
  }
  if (original.status === "returned") return { ok: false, status: 409, message: "This payment was already returned" };
  if (original.status !== "cleared" && original.status !== "settled") {
    return { ok: false, status: 400, message: `Cannot return a transfer in status "${original.status}"` };
  }
  const ageMs = Date.now() - new Date(original.initiatedAt).getTime();
  if (initiatedBy === "recipient" && ageMs > RETURN_WINDOW_DAYS * 24 * 60 * 60 * 1000) {
    return { ok: false, status: 400, message: `Returns are only possible within ${RETURN_WINDOW_DAYS} days` };
  }
  if (!original.recipientUserId || !original.senderUserId) {
    return { ok: false, status: 400, message: "Transfer parties cannot be resolved" };
  }

  const returnAmount = Number(original.recipientAmount);
  const returnCurrency = original.recipientCurrency;
  const ref = generateRef("RTN");
  const home = await getHomeParticipant();
  const endToEndId = generateEndToEndId(home?.code || "COBOPANA");

  // Find the open batch for the return leg's settlement
  let [openBatch] = await db.select().from(settlementBatchesTable).where(eq(settlementBatchesTable.status, "open"));
  if (!openBatch) {
    [openBatch] = await db.insert(settlementBatchesTable).values({ batchRef: generateRef("STL") }).returning();
  }

  let returnTransfer: SchemeTransfer;
  try {
    returnTransfer = await db.transaction(async (tx) => {
      const [recipientWallet] = await tx
        .select()
        .from(walletsTable)
        .where(and(eq(walletsTable.userId, original.recipientUserId!), eq(walletsTable.currency, returnCurrency)))
        .for("update");
      if (!recipientWallet || Number(recipientWallet.balance) < returnAmount) {
        throw new Error("INSUFFICIENT_FUNDS");
      }
      await tx
        .update(walletsTable)
        .set({ balance: sql`${walletsTable.balance} - ${String(returnAmount)}` })
        .where(eq(walletsTable.id, recipientWallet.id));

      let [senderWallet] = await tx
        .select()
        .from(walletsTable)
        .where(and(eq(walletsTable.userId, original.senderUserId!), eq(walletsTable.currency, returnCurrency)))
        .for("update");
      if (!senderWallet) {
        [senderWallet] = await tx
          .insert(walletsTable)
          .values({ userId: original.senderUserId!, currency: returnCurrency })
          .returning();
      }
      await tx
        .update(walletsTable)
        .set({ balance: sql`${walletsTable.balance} + ${String(returnAmount)}` })
        .where(eq(walletsTable.id, senderWallet.id));

      const [row] = await tx
        .insert(schemeTransfersTable)
        .values({
          reference: ref,
          endToEndId,
          senderUserId: original.recipientUserId,
          senderParticipantId: original.recipientParticipantId,
          recipientAlias: original.senderAlias || `user:${original.senderUserId}`,
          recipientUserId: original.senderUserId,
          recipientParticipantId: original.senderParticipantId,
          amount: String(returnAmount),
          currency: returnCurrency,
          recipientAmount: String(returnAmount),
          recipientCurrency: returnCurrency,
          fxRate: "1",
          fee: "0",
          status: "cleared",
          clearedAt: new Date(),
          settlementBatchId: openBatch.id,
          metadata: { returnOf: original.reference, reason, initiatedBy },
        })
        .returning();

      await tx
        .update(schemeTransfersTable)
        .set({ status: "returned", statusReason: `${initiatedBy === "operator" ? "Dispute refund" : "Returned by recipient"}: ${reason}` })
        .where(eq(schemeTransfersTable.id, original.id));

      await tx.insert(transactionsTable).values({
        reference: ref,
        amount: String(returnAmount),
        currency: returnCurrency,
        status: "completed",
        type: "send",
        customerId: original.recipientUserId!,
        description: `Afrix return of ${original.reference}`,
        paymentMethod: "afrix",
      });
      await tx.insert(transactionsTable).values({
        reference: `${ref}-R`,
        amount: String(returnAmount),
        currency: returnCurrency,
        status: "completed",
        type: "deposit",
        customerId: original.senderUserId!,
        description: `Afrix payment ${original.reference} returned to you`,
        paymentMethod: "afrix",
      });

      return row;
    });
  } catch (err) {
    if (err instanceof Error && err.message === "INSUFFICIENT_FUNDS") {
      return { ok: false, status: 400, message: "Recipient balance is insufficient to return this payment" };
    }
    throw err;
  }

  await db.insert(notificationsTable).values({
    userId: original.senderUserId,
    title: "Afrix Payment Returned",
    message: `${returnCurrency} ${returnAmount.toLocaleString(undefined, { maximumFractionDigits: 2 })} from payment ${original.reference} was returned to you`,
    type: "info",
  });
  await db.insert(auditLogsTable).values({
    userId: actorUserId,
    action: "afrix_return",
    ip: "scheme-switch",
    meta: { originalReference: original.reference, returnReference: ref, amount: returnAmount, currency: returnCurrency, reason, initiatedBy },
  });
  emitPaymentUpdate(original.senderUserId, {
    reference: ref,
    status: "completed",
    amount: returnAmount,
    currency: returnCurrency,
    provider: "afrix",
    message: `Payment ${original.reference} was returned to you`,
  });

  return { ok: true, status: 200, message: "Payment returned along the original path", returnTransfer };
}
