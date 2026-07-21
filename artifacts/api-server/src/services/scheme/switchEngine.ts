// Afrix Switch — the scheme's instant payment engine (equivalent of Pix's SPI or
// a card network's authorization switch). Resolves the recipient key through the
// directory, screens for sanctions, converts currency at scheme FX rates, clears the
// payment instantly (24/7), and queues it for deferred net settlement between the
// sender's and recipient's institutions.

import { randomUUID } from "crypto";
import { eq, and, sql } from "drizzle-orm";
import {
  db,
  walletsTable,
  usersTable,
  transactionsTable,
  notificationsTable,
  auditLogsTable,
  schemeTransfersTable,
  settlementBatchesTable,
  type SchemeTransfer,
} from "@workspace/db";
import { getRate } from "../fxRates.js";
import { screenAgainstOFAC } from "../../lib/ofac.js";
import { checkAndCreateCTR } from "../../lib/ctr.js";
import { generateRef } from "../../lib/refgen.js";
import { checkDailyLimit, getKycLevel } from "../../lib/limits.js";
import { emitPaymentUpdate } from "../socketio.js";
import { emailService } from "../email.js";
import { resolveAlias, getHomeParticipant, type ResolvedAlias } from "./directory.js";

// Scheme pricing: free for individuals (like Pix), small merchant discount rate applied upstream
const SCHEME_FEE = 0;

export function generateSchemeRef(): string {
  return generateRef("AFX");
}

// ISO 20022-flavoured end-to-end id, unique across the whole network
export function generateEndToEndId(participantCode: string): string {
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  return `E${participantCode}${date}${randomUUID().replace(/-/g, "").slice(0, 11).toUpperCase()}`;
}

async function currentOpenBatch(): Promise<number> {
  const [open] = await db.select().from(settlementBatchesTable).where(eq(settlementBatchesTable.status, "open"));
  if (open) return open.id;
  const [batch] = await db
    .insert(settlementBatchesTable)
    .values({ batchRef: generateRef("STL") })
    .returning();
  return batch.id;
}

export interface InstantPaymentInput {
  senderUserId: number;
  senderEmail: string;
  alias: string;
  amount: number;
  currency?: string; // sender wallet currency; defaults to recipient's preferred
  walletId?: number;
  description?: string;
  qrRef?: string;
}

export interface InstantPaymentResult {
  ok: boolean;
  status: number;
  message: string;
  code?: string;
  transfer?: SchemeTransfer;
  recipientName?: string;
  fxRate?: number | null;
  recipientAmount?: number;
  recipientCurrency?: string;
}

export async function processInstantPayment(input: InstantPaymentInput): Promise<InstantPaymentResult> {
  const amount = Number(input.amount);
  if (!amount || amount <= 0) return { ok: false, status: 400, message: "Invalid amount" };

  // 1. Directory lookup
  const resolved: ResolvedAlias | null = await resolveAlias(input.alias);
  if (!resolved) return { ok: false, status: 404, message: "Afrix key not found in the network directory", code: "KEY_NOT_FOUND" };
  if (resolved.holderUserId === input.senderUserId) {
    return { ok: false, status: 400, message: "Cannot send to your own Afrix key" };
  }

  // 2. Sender wallet
  let senderWallet;
  if (input.walletId) {
    [senderWallet] = await db
      .select()
      .from(walletsTable)
      .where(and(eq(walletsTable.id, input.walletId), eq(walletsTable.userId, input.senderUserId)));
  } else {
    const currency = input.currency || resolved.alias.currency;
    [senderWallet] = await db
      .select()
      .from(walletsTable)
      .where(and(eq(walletsTable.userId, input.senderUserId), eq(walletsTable.currency, currency)));
  }
  if (!senderWallet) return { ok: false, status: 404, message: "Sender wallet not found" };
  if (Number(senderWallet.balance) < amount + SCHEME_FEE) {
    return { ok: false, status: 400, message: "Insufficient funds" };
  }

  // 3a. KYC daily limits — same tiers as every other rail, in USD terms
  const usdRate = senderWallet.currency === "USD" ? 1 : await getRate(senderWallet.currency, "USD");
  const amountUSD = amount * (usdRate || 1);
  const kycLevel = await getKycLevel(input.senderUserId);
  const limitCheck = await checkDailyLimit(input.senderUserId, kycLevel, amountUSD);
  if (!limitCheck.allowed) {
    return { ok: false, status: 403, message: limitCheck.message || "Daily limit exceeded", code: limitCheck.code };
  }

  // 3b. Sanctions screening at the switch — every payment, every time
  const ofac = screenAgainstOFAC(resolved.holderName);
  if (!ofac.clear && ofac.riskScore >= 80) {
    return { ok: false, status: 403, message: "Payment flagged for compliance review. Contact support.", code: "SANCTIONS_FLAG" };
  }

  // 4. Cross-currency conversion at scheme FX rates
  const recipientCurrency = resolved.alias.currency;
  let fxRate: number | null = 1;
  let recipientAmount = amount;
  if (recipientCurrency !== senderWallet.currency) {
    fxRate = await getRate(senderWallet.currency, recipientCurrency);
    if (!fxRate) {
      return { ok: false, status: 400, message: `Exchange rate unavailable for ${senderWallet.currency} → ${recipientCurrency}` };
    }
    recipientAmount = amount * fxRate;
  }

  const home = await getHomeParticipant();
  const senderParticipantId = home?.id ?? resolved.participant.id;
  const ref = generateSchemeRef();
  const endToEndId = generateEndToEndId(home?.code || "COBOPANA");
  const batchId = await currentOpenBatch();

  // 5. Clearing — instant debit/credit, 24/7 (settlement between institutions is
  // deferred). Runs as one database transaction: the sender wallet row is locked
  // (SELECT ... FOR UPDATE) so concurrent payments can't double-spend, and either
  // every leg commits (debit, credit, transfer + ledger rows) or none do.
  const total = amount + SCHEME_FEE;
  let transfer: SchemeTransfer;
  try {
    transfer = await db.transaction(async (tx) => {
      const [lockedSender] = await tx
        .select()
        .from(walletsTable)
        .where(eq(walletsTable.id, senderWallet.id))
        .for("update");
      if (!lockedSender || Number(lockedSender.balance) < total) {
        throw new Error("INSUFFICIENT_FUNDS");
      }

      await tx
        .update(walletsTable)
        .set({ balance: sql`${walletsTable.balance} - ${String(total)}` })
        .where(eq(walletsTable.id, lockedSender.id));

      let [recipientWallet] = await tx
        .select()
        .from(walletsTable)
        .where(and(eq(walletsTable.userId, resolved.holderUserId), eq(walletsTable.currency, recipientCurrency)))
        .for("update");
      if (!recipientWallet) {
        [recipientWallet] = await tx
          .insert(walletsTable)
          .values({ userId: resolved.holderUserId, currency: recipientCurrency })
          .returning();
      }
      await tx
        .update(walletsTable)
        .set({ balance: sql`${walletsTable.balance} + ${String(recipientAmount)}` })
        .where(eq(walletsTable.id, recipientWallet.id));

      const [row] = await tx
        .insert(schemeTransfersTable)
        .values({
          reference: ref,
          endToEndId,
          senderUserId: input.senderUserId,
          senderParticipantId,
          recipientAlias: resolved.alias.aliasValue,
          recipientUserId: resolved.holderUserId,
          recipientParticipantId: resolved.participant.id,
          amount: String(amount),
          currency: senderWallet.currency,
          recipientAmount: String(recipientAmount),
          recipientCurrency,
          fxRate: fxRate ? String(fxRate) : null,
          fee: String(SCHEME_FEE),
          status: "cleared",
          clearedAt: new Date(),
          qrRef: input.qrRef || null,
          settlementBatchId: batchId,
          metadata: { description: input.description || null, aliasType: resolved.alias.aliasType },
        })
        .returning();

      const desc = input.description || `Afrix instant payment to ${resolved.holderName}`;
      await tx.insert(transactionsTable).values({
        reference: ref,
        amount: String(amount),
        currency: senderWallet.currency,
        status: "completed",
        type: "send",
        customerId: input.senderUserId,
        description: desc,
        paymentMethod: "afrix",
      });
      await tx.insert(transactionsTable).values({
        reference: `${ref}-R`,
        amount: String(recipientAmount),
        currency: recipientCurrency,
        status: "completed",
        type: "deposit",
        customerId: resolved.holderUserId,
        description: `Afrix instant payment received (key: ${resolved.alias.aliasType})`,
        paymentMethod: "afrix",
      });

      return row;
    });
  } catch (err) {
    if (err instanceof Error && err.message === "INSUFFICIENT_FUNDS") {
      return { ok: false, status: 400, message: "Insufficient funds" };
    }
    throw err;
  }

  await checkAndCreateCTR(input.senderUserId, ref, amount, senderWallet.currency, "afrix");

  await db.insert(notificationsTable).values({
    userId: resolved.holderUserId,
    title: "Afrix Payment Received!",
    message: `${recipientCurrency} ${recipientAmount.toLocaleString(undefined, { maximumFractionDigits: 2 })} received instantly via Afrix`,
    type: "success",
  });
  await db.insert(auditLogsTable).values({
    userId: input.senderUserId,
    action: "afrix_instant_payment",
    ip: "scheme-switch",
    meta: { ref, endToEndId, amount, currency: senderWallet.currency, recipientCurrency, fxRate, recipientAmount, alias: resolved.alias.aliasValue },
  });

  emitPaymentUpdate(resolved.holderUserId, {
    reference: ref,
    status: "completed",
    amount: recipientAmount,
    currency: recipientCurrency,
    provider: "afrix",
    message: `Afrix payment received from ${input.senderEmail}`,
  });

  const [senderUser] = await db.select().from(usersTable).where(eq(usersTable.id, input.senderUserId));
  const [recipientUser] = await db.select().from(usersTable).where(eq(usersTable.id, resolved.holderUserId));
  if (senderUser) {
    emailService.sendTransferSentEmail(senderUser, { amount, currency: senderWallet.currency, recipient: resolved.holderName, reference: ref, fee: SCHEME_FEE }).catch(() => {});
  }
  if (recipientUser) {
    emailService.sendTransferReceivedEmail(recipientUser, { amount: recipientAmount, currency: recipientCurrency, sender: senderUser ? `${senderUser.firstName} ${senderUser.lastName}` : "Afrix user", reference: ref }).catch(() => {});
  }

  return {
    ok: true,
    status: 200,
    message: "Payment cleared instantly",
    transfer,
    recipientName: resolved.holderName,
    fxRate,
    recipientAmount,
    recipientCurrency,
  };
}
