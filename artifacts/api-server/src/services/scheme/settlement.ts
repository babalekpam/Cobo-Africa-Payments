// IAPAY Settlement — deferred multilateral net settlement between scheme participants.
// Cleared transfers accumulate in an open batch; closing the cycle nets every
// participant's payables against receivables per currency (the model used by
// card schemes like UnionPay and by PAPSS for cross-border netting), then marks
// the batch and its transfers settled.

import { eq, and, inArray, sql } from "drizzle-orm";
import { currentOpenBatch } from "./batches.js";
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

  // Claim the batch atomically: of any concurrent callers (every instance's scheduler plus the
  // admin endpoint) exactly one moves it open -> netting; the rest stop here instead of
  // double-inserting positions and double-applying settlement balances.
  const [claimed] = await db
    .update(settlementBatchesTable)
    .set({ status: "netting", closedAt: new Date() })
    .where(and(eq(settlementBatchesTable.id, batch.id), eq(settlementBatchesTable.status, "open")))
    .returning({ id: settlementBatchesTable.id });
  if (!claimed) return null;

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
      // Single-statement arithmetic in SQL: no read-modify-write window for a lost update.
      await db
        .update(schemeParticipantsTable)
        .set({ settlementBalance: sql`${schemeParticipantsTable.settlementBalance} + ${(net * usdRate).toFixed(2)}::numeric` })
        .where(eq(schemeParticipantsTable.id, pos.participantId));
    }
  }

  const now = new Date();
  // Settle exactly the transfers that were netted above — never "everything cleared in this
  // batch", which would also mark a payment that cleared after the snapshot as settled without
  // it ever being netted.
  await db
    .update(schemeTransfersTable)
    .set({ status: "settled", settledAt: now })
    .where(
      and(
        inArray(
          schemeTransfersTable.id,
          transfers.map((t) => t.id)
        ),
        eq(schemeTransfersTable.status, "cleared")
      )
    );
  // Any straggler that cleared into this batch after the snapshot moves to the next open batch.
  const stragglers = await db
    .select({ id: schemeTransfersTable.id })
    .from(schemeTransfersTable)
    .where(and(eq(schemeTransfersTable.settlementBatchId, batch.id), eq(schemeTransfersTable.status, "cleared")));
  if (stragglers.length > 0) {
    const nextBatchId = await currentOpenBatch();
    await db
      .update(schemeTransfersTable)
      .set({ settlementBatchId: nextBatchId })
      .where(
        inArray(
          schemeTransfersTable.id,
          stragglers.map((s) => s.id)
        )
      );
  }

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
