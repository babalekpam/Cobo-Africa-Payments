// IAPAY Settlement — deferred multilateral net settlement between scheme participants.
// Cleared transfers accumulate in an open batch; closing the cycle nets every
// participant's payables against receivables per currency (the model used by
// card schemes like UnionPay and by PAPSS for cross-border netting), then marks
// waits for the money to actually move.
//
// Two phases on a LIVE installation (SETTLEMENT_REQUIRES_CONFIRMATION, default on unless sandbox):
//   1. close   — net positions are computed and frozen; the batch is "awaiting_settlement" and every
//                netted transfer still counts toward its bank's exposure (nothing is released yet);
//   2. confirm — an operator records the settlement-bank / RTGS reference proving the positions were
//                paid; only then are the transfers "settled", exposure released and balances applied.
// A sandbox (or SETTLEMENT_REQUIRES_CONFIRMATION=false) settles at close, in one step.

import { eq, and, inArray, notInArray, sql } from "drizzle-orm";
import { isSandbox } from "../../lib/environment.js";
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

export function settlementRequiresConfirmation(): boolean {
  const v = (process.env.SETTLEMENT_REQUIRES_CONFIRMATION || "").toLowerCase();
  if (v === "true") return true;
  if (v === "false") return false;
  return !isSandbox();
}

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
    const [row] = await db
      .insert(settlementPositionsTable)
      .values({
        batchId: batch.id,
        participantId: pos.participantId,
        currency: pos.currency,
        totalDebit: pos.debit.toFixed(2),
        totalCredit: pos.credit.toFixed(2),
        netPosition: pos.net.toFixed(2),
      })
      .returning();
    saved.push(row);
  }

  // The batch must contain exactly the transfers that were netted: anything that cleared into it
  // after the snapshot moves to the next open batch (it was not netted here).
  const nettedIds = transfers.map((t) => t.id);
  const stragglers = await db
    .select({ id: schemeTransfersTable.id })
    .from(schemeTransfersTable)
    .where(and(
      eq(schemeTransfersTable.settlementBatchId, batch.id),
      eq(schemeTransfersTable.status, "cleared"),
      notInArray(schemeTransfersTable.id, nettedIds),
    ));
  if (stragglers.length > 0) {
    const nextBatchId = await currentOpenBatch();
    await db
      .update(schemeTransfersTable)
      .set({ settlementBatchId: nextBatchId })
      .where(inArray(schemeTransfersTable.id, stragglers.map((s) => s.id)));
  }

  const [closed] = await db
    .update(settlementBatchesTable)
    .set({ status: "awaiting_settlement", transferCount: transfers.length, totalGrossUsd: totalGrossUsd.toFixed(2) })
    .where(eq(settlementBatchesTable.id, batch.id))
    .returning();

  if (settlementRequiresConfirmation()) {
    return { batch: closed, positions: saved, transferCount: transfers.length };
  }
  const settled = await confirmSettlement(batch.id, { reference: null, confirmedBy: null });
  return { batch: settled ?? closed, positions: saved, transferCount: transfers.length };
}

/**
 * Phase 2: the net positions of a closed batch were paid. Exactly once (a conditional status change
 * inside one transaction): applies each participant's settlement balance, marks the netted transfers
 * settled (releasing their exposure) and records the proof. Returns null if the batch is not
 * awaiting settlement (unknown, still open, or already settled).
 */
export async function confirmSettlement(
  batchId: number,
  proof: { reference: string | null; confirmedBy: number | null },
): Promise<SettlementBatch | null> {
  return db.transaction(async (tx) => {
    const now = new Date();
    const [batch] = await tx
      .update(settlementBatchesTable)
      .set({ status: "settled", settledAt: now, settlementReference: proof.reference, settledBy: proof.confirmedBy })
      .where(and(eq(settlementBatchesTable.id, batchId), eq(settlementBatchesTable.status, "awaiting_settlement")))
      .returning();
    if (!batch) return null;

    const positions = await tx.select().from(settlementPositionsTable).where(eq(settlementPositionsTable.batchId, batchId));
    for (const pos of positions) {
      // Reflect the net movement on each participant's settlement account (in USD terms).
      const usdRate = pos.currency === "USD" ? 1 : await getRate(pos.currency, "USD");
      if (usdRate) {
        await tx
          .update(schemeParticipantsTable)
          .set({ settlementBalance: sql`${schemeParticipantsTable.settlementBalance} + ${(Number(pos.netPosition) * usdRate).toFixed(2)}::numeric` })
          .where(eq(schemeParticipantsTable.id, pos.participantId));
      }
    }
    await tx
      .update(schemeTransfersTable)
      .set({ status: "settled", settledAt: now })
      .where(and(eq(schemeTransfersTable.settlementBatchId, batchId), eq(schemeTransfersTable.status, "cleared")));
    return batch;
  });
}

export async function getBatchPositions(batchId: number): Promise<SettlementPosition[]> {
  return db.select().from(settlementPositionsTable).where(eq(settlementPositionsTable.batchId, batchId));
}
