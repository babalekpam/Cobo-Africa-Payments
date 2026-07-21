// IAPAY Settlement — deferred multilateral net settlement between scheme participants.
// Cleared transfers accumulate in an open batch; closing the cycle nets every
// participant's payables against receivables per currency (the model used by
// card schemes like UnionPay and by PAPSS for cross-border netting), then marks
// the batch and its transfers settled.

import { eq, and } from "drizzle-orm";
import {
  db,
  schemeTransfersTable,
  settlementBatchesTable,
  settlementPositionsTable,
  schemeParticipantsTable,
  type SettlementBatch,
  type SettlementPosition,
} from "@workspace/db";
import { getRate } from "../fxRates.js";
import { computeNetPositions } from "./netting.js";

export interface SettlementSummary {
  batch: SettlementBatch;
  positions: SettlementPosition[];
  transferCount: number;
}

export async function closeSettlementCycle(): Promise<SettlementSummary | null> {
  const [batch] = await db.select().from(settlementBatchesTable).where(eq(settlementBatchesTable.status, "open"));
  if (!batch) return null;

  const transfers = await db
    .select()
    .from(schemeTransfersTable)
    .where(and(eq(schemeTransfersTable.settlementBatchId, batch.id), eq(schemeTransfersTable.status, "cleared")));

  // Nothing cleared since the last cycle — leave the batch open rather than
  // churning out empty settled batches.
  if (transfers.length === 0) return null;

  await db.update(settlementBatchesTable).set({ status: "netting", closedAt: new Date() }).where(eq(settlementBatchesTable.id, batch.id));

  // Multilateral netting: per participant per currency, debit what they owe the
  // network (their customers sent) and credit what the network owes them (their
  // customers received). The math lives in netting.ts (pure, unit-tested).
  const positions = computeNetPositions(
    transfers.map((t) => ({
      senderParticipantId: t.senderParticipantId,
      recipientParticipantId: t.recipientParticipantId,
      currency: t.currency,
      recipientCurrency: t.recipientCurrency,
      amount: Number(t.amount),
      recipientAmount: Number(t.recipientAmount),
    }))
  );

  let totalGrossUsd = 0;
  for (const t of transfers) {
    const usdRate = t.currency === "USD" ? 1 : await getRate(t.currency, "USD");
    totalGrossUsd += Number(t.amount) * (usdRate || 0);
  }

  const saved: SettlementPosition[] = [];
  for (const pos of positions) {
    const net = pos.net;
    const [row] = await db
      .insert(settlementPositionsTable)
      .values({
        batchId: batch.id,
        participantId: pos.participantId,
        currency: pos.currency,
        totalDebit: pos.debit.toFixed(2),
        totalCredit: pos.credit.toFixed(2),
        netPosition: net.toFixed(2),
      })
      .returning();
    saved.push(row);

    // Reflect the net movement on each participant's settlement account (in USD terms)
    const usdRate = pos.currency === "USD" ? 1 : await getRate(pos.currency, "USD");
    if (usdRate) {
      const [participant] = await db.select().from(schemeParticipantsTable).where(eq(schemeParticipantsTable.id, pos.participantId));
      if (participant) {
        await db
          .update(schemeParticipantsTable)
          .set({ settlementBalance: (Number(participant.settlementBalance) + net * usdRate).toFixed(2) })
          .where(eq(schemeParticipantsTable.id, pos.participantId));
      }
    }
  }

  const now = new Date();
  await db
    .update(schemeTransfersTable)
    .set({ status: "settled", settledAt: now })
    .where(and(eq(schemeTransfersTable.settlementBatchId, batch.id), eq(schemeTransfersTable.status, "cleared")));

  const [settled] = await db
    .update(settlementBatchesTable)
    .set({
      status: "settled",
      settledAt: now,
      transferCount: transfers.length,
      totalGrossUsd: totalGrossUsd.toFixed(2),
    })
    .where(eq(settlementBatchesTable.id, batch.id))
    .returning();

  return { batch: settled, positions: saved, transferCount: transfers.length };
}

export async function getBatchPositions(batchId: number): Promise<SettlementPosition[]> {
  return db.select().from(settlementPositionsTable).where(eq(settlementPositionsTable.batchId, batchId));
}
