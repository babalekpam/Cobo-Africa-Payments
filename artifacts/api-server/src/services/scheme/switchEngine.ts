// AfriPay Switch — the scheme's instant payment engine (equivalent of Pix's SPI or
// a card network's authorization switch). Resolves the recipient key through the
// directory, screens for sanctions, converts currency at scheme FX rates, clears the
// payment instantly (24/7), and queues it for deferred net settlement between the
// sender's and recipient's institutions.

import { randomUUID } from "crypto";
import { eq, and } from "drizzle-orm";
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
import { emitPaymentUpdate } from "../socketio.js";
import { emailService } from "../email.js";
import { resolveAlias, getHomeParticipant, type ResolvedAlias } from "./directory.js";

// Scheme pricing: free for individuals (like Pix), small merchant discount rate applied upstream
const SCHEME_FEE = 0;

export function generateSchemeRef(): string {
  return generateRef("AFP");
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
  if (!resolved) return { ok: false, status: 404, message: "AfriPay key not found in the network directory", code: "KEY_NOT_FOUND" };
  if (resolved.holderUserId === input.senderUserId) {
    return { ok: false, status: 400, message: "Cannot send to your own AfriPay key" };
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

  // 3. Sanctions screening at the switch — every payment, every time
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

  // 5. Clearing — instant debit/credit, 24/7 (settlement between institutions is deferred)
  await db
    .update(walletsTable)
    .set({ balance: String(Number(senderWallet.balance) - amount - SCHEME_FEE) })
    .where(eq(walletsTable.id, senderWallet.id));

  let [recipientWallet] = await db
    .select()
    .from(walletsTable)
    .where(and(eq(walletsTable.userId, resolved.holderUserId), eq(walletsTable.currency, recipientCurrency)));
  if (!recipientWallet) {
    [recipientWallet] = await db
      .insert(walletsTable)
      .values({ userId: resolved.holderUserId, currency: recipientCurrency })
      .returning();
  }
  await db
    .update(walletsTable)
    .set({ balance: String(Number(recipientWallet.balance) + recipientAmount) })
    .where(eq(walletsTable.id, recipientWallet.id));

  const [transfer] = await db
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

  const desc = input.description || `AfriPay instant payment to ${resolved.holderName}`;
  await db.insert(transactionsTable).values({
    reference: ref,
    amount: String(amount),
    currency: senderWallet.currency,
    status: "completed",
    type: "send",
    customerId: input.senderUserId,
    description: desc,
    paymentMethod: "afripay",
  });
  await db.insert(transactionsTable).values({
    reference: `${ref}-R`,
    amount: String(recipientAmount),
    currency: recipientCurrency,
    status: "completed",
    type: "deposit",
    customerId: resolved.holderUserId,
    description: `AfriPay instant payment received (key: ${resolved.alias.aliasType})`,
    paymentMethod: "afripay",
  });

  await checkAndCreateCTR(input.senderUserId, ref, amount, senderWallet.currency, "afripay");

  await db.insert(notificationsTable).values({
    userId: resolved.holderUserId,
    title: "AfriPay Payment Received!",
    message: `${recipientCurrency} ${recipientAmount.toLocaleString(undefined, { maximumFractionDigits: 2 })} received instantly via AfriPay`,
    type: "success",
  });
  await db.insert(auditLogsTable).values({
    userId: input.senderUserId,
    action: "afripay_instant_payment",
    ip: "scheme-switch",
    meta: { ref, endToEndId, amount, currency: senderWallet.currency, recipientCurrency, fxRate, recipientAmount, alias: resolved.alias.aliasValue },
  });

  emitPaymentUpdate(resolved.holderUserId, {
    reference: ref,
    status: "completed",
    amount: recipientAmount,
    currency: recipientCurrency,
    provider: "afripay",
    message: `AfriPay payment received from ${input.senderEmail}`,
  });

  const [senderUser] = await db.select().from(usersTable).where(eq(usersTable.id, input.senderUserId));
  const [recipientUser] = await db.select().from(usersTable).where(eq(usersTable.id, resolved.holderUserId));
  if (senderUser) {
    emailService.sendTransferSentEmail(senderUser, { amount, currency: senderWallet.currency, recipient: resolved.holderName, reference: ref, fee: SCHEME_FEE }).catch(() => {});
  }
  if (recipientUser) {
    emailService.sendTransferReceivedEmail(recipientUser, { amount: recipientAmount, currency: recipientCurrency, sender: senderUser ? `${senderUser.firstName} ${senderUser.lastName}` : "AfriPay user", reference: ref }).catch(() => {});
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
