// IAPAY Switch — the scheme's instant payment engine (equivalent of Pix's SPI or
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
  type SchemeTransfer,
} from "@workspace/db";
import { getRate, getAllRates, ratesAreFresh } from "../fxRates.js";
import { loadSchemeConfig } from "./config.js";
import { checkAndCreateCTR } from "../../lib/ctr.js";
import { generateRef } from "../../lib/refgen.js";
import { checkDailyLimit, getKycLevel } from "../../lib/limits.js";
import { emitPaymentUpdate } from "../socketio.js";
import { emailService } from "../email.js";
import { resolveAlias, getHomeParticipant, HOME_PARTICIPANT_CODE, type ResolvedAlias } from "./directory.js";
import { currentOpenBatch } from "./batches.js";
import {
  adapterFor,
  createPendingTransfer,
  dispatchAndFinalize,
  screenNames,
  toIso,
  InsufficientFundsError,
} from "./externalSwitch.js";

// Scheme pricing: free for individuals (like Pix), small merchant discount rate applied upstream
const SCHEME_FEE = 0;

export function generateSchemeRef(): string {
  return generateRef("IAP");
}

// ISO 20022-flavoured end-to-end id, unique across the whole network
export function generateEndToEndId(participantCode: string): string {
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  return `E${participantCode}${date}${randomUUID().replace(/-/g, "").slice(0, 11).toUpperCase()}`;
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
  // Money amounts are exact cents: wallets are numeric(15,2), so a sub-cent amount would debit
  // nothing (the database rounds it away) while its converted credit could still be real.
  if (!Number.isFinite(amount) || amount < 0.01 || Math.round(amount * 100) / 100 !== amount) {
    return { ok: false, status: 400, message: "Amount must be at least 0.01 with at most 2 decimal places" };
  }

  // 1. Directory lookup
  const resolved: ResolvedAlias | null = await resolveAlias(input.alias);
  if (!resolved) return { ok: false, status: 404, message: "IAPAY key not found in the network directory", code: "KEY_NOT_FOUND" };
  if (resolved.holderUserId === input.senderUserId) {
    return { ok: false, status: 400, message: "Cannot send to your own IAPAY key" };
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

  // 3b. Sanctions screening at the switch — every payment, every time. Screens the real
  // (unmasked) names of both parties; the masked display name can never match a list.
  const [screenedSender] = await db.select().from(usersTable).where(eq(usersTable.id, input.senderUserId));
  const senderScreenNames = screenedSender
    ? [screenedSender.businessName, [screenedSender.firstName, screenedSender.lastName].filter(Boolean).join(" "), screenedSender.name].filter(
        (n): n is string => !!n
      )
    : [];
  const screening = await screenNames([...resolved.holderScreenNames, ...senderScreenNames]);
  if (screening === "hit") {
    return { ok: false, status: 403, message: "Payment flagged for compliance review. Contact support.", code: "SANCTIONS_FLAG" };
  }
  if (screening === "unavailable") {
    // Fail closed: never send a payment that could not be screened.
    return { ok: false, status: 503, message: "Sanctions screening is temporarily unavailable. Please try again shortly.", code: "SCREENING_UNAVAILABLE" };
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
    // Round once, here, so the debit, the credit, the stored row and any bank message all
    // carry the same cents. A conversion that rounds to nothing is refused outright.
    recipientAmount = Math.round(amount * fxRate * 100) / 100;
    if (recipientAmount < 0.01) {
      return { ok: false, status: 400, message: "Amount is too small to convert into the recipient's currency" };
    }
  }

  const home = await getHomeParticipant();

  // 4b. Recipient held at an external institution (a bank): route through its adapter.
  // Participants with no reachable adapter keep the legacy wallet-credit behaviour only
  // when the key belongs to a platform user (demo members); a bank-held key we cannot
  // reach is refused rather than guessed at.
  const externalAdapter = resolved.participant.code !== HOME_PARTICIPANT_CODE ? adapterFor(resolved.participant) : null;
  if (resolved.holderUserId === null || externalAdapter) {
    if (!externalAdapter || !home) {
      return { ok: false, status: 503, message: "The recipient's institution is not reachable right now. Nothing was charged.", code: "PARTICIPANT_UNAVAILABLE" };
    }
    if (loadSchemeConfig().gatewayRequireLiveRates && !ratesAreFresh()) {
      return { ok: false, status: 503, message: "Payments to other institutions are paused while exchange rates are unavailable. Nothing was charged.", code: "RATES_UNAVAILABLE" };
    }
    const roundedRecipientAmount = Math.round(recipientAmount * 100) / 100;
    const extRef = generateSchemeRef();
    let pending: SchemeTransfer;
    try {
      pending = await createPendingTransfer({
        reference: extRef,
        endToEndId: generateEndToEndId(home.code),
        amount,
        currency: senderWallet.currency,
        recipientAmount: roundedRecipientAmount,
        recipientCurrency,
        fxRate,
        fee: SCHEME_FEE,
        senderParticipant: home,
        recipient: resolved,
        description: input.description,
        qrRef: input.qrRef,
        senderUserId: input.senderUserId,
        debitWalletId: senderWallet.id,
        rates: await getAllRates(),
      });
    } catch (err) {
      if (err instanceof InsufficientFundsError) return { ok: false, status: 400, message: "Insufficient funds" };
      throw err;
    }

    const senderName = screenedSender
      ? screenedSender.businessName || [screenedSender.firstName, screenedSender.lastName].filter(Boolean).join(" ") || screenedSender.name
      : "IAPAY customer";
    const outcome = await dispatchAndFinalize(
      pending,
      toIso(pending, { name: senderName, participant: home }, { name: resolved.holderName, participant: resolved.participant }, input.description),
      externalAdapter
    );

    if (outcome.kind === "rejected") {
      return {
        ok: false,
        status: 422,
        message: "The recipient's institution declined the payment. You have not been charged.",
        code: "PARTICIPANT_REJECTED",
        transfer: outcome.transfer,
      };
    }
    if (outcome.kind === "unresolved") {
      return {
        ok: false,
        status: 202,
        message: "Your payment is being confirmed with the recipient's institution. The funds are held and will be released or refunded once it is confirmed.",
        code: "PAYMENT_PENDING",
        transfer: outcome.transfer,
      };
    }

    await checkAndCreateCTR(input.senderUserId, extRef, amount, senderWallet.currency, "iapay");
    await db.insert(auditLogsTable).values({
      userId: input.senderUserId,
      action: "iapay_instant_payment",
      ip: "scheme-switch",
      meta: { ref: extRef, endToEndId: pending.endToEndId, amount, currency: senderWallet.currency, recipientCurrency, fxRate, recipientAmount: roundedRecipientAmount, participant: resolved.participant.code },
    });
    if (screenedSender) {
      emailService
        .sendTransferSentEmail(screenedSender, { amount, currency: senderWallet.currency, recipient: resolved.holderName, reference: extRef, fee: SCHEME_FEE })
        .catch(() => {});
    }
    return {
      ok: true,
      status: 200,
      message: "Payment cleared instantly",
      transfer: outcome.transfer,
      recipientName: resolved.holderName,
      fxRate,
      recipientAmount: roundedRecipientAmount,
      recipientCurrency,
    };
  }
  const recipientUserId: number = resolved.holderUserId;

  const senderParticipantId = home?.id ?? resolved.participant.id;
  const ref = generateSchemeRef();
  const endToEndId = generateEndToEndId(home?.code || "IAPAYPAN");
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

      // Serialise first-time wallet creation per user: SELECT ... FOR UPDATE locks nothing when
      // the row does not exist yet, so two concurrent first credits would create two wallets.
      await tx.execute(sql`select pg_advisory_xact_lock(1002, ${recipientUserId})`);
      let [recipientWallet] = await tx
        .select()
        .from(walletsTable)
        .where(and(eq(walletsTable.userId, recipientUserId), eq(walletsTable.currency, recipientCurrency)))
        .for("update");
      if (!recipientWallet) {
        [recipientWallet] = await tx
          .insert(walletsTable)
          .values({ userId: recipientUserId, currency: recipientCurrency })
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
          recipientUserId: recipientUserId,
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

      const desc = input.description || `IAPAY instant payment to ${resolved.holderName}`;
      await tx.insert(transactionsTable).values({
        reference: ref,
        amount: String(amount),
        currency: senderWallet.currency,
        status: "completed",
        type: "send",
        customerId: input.senderUserId,
        description: desc,
        paymentMethod: "iapay",
      });
      await tx.insert(transactionsTable).values({
        reference: `${ref}-R`,
        amount: String(recipientAmount),
        currency: recipientCurrency,
        status: "completed",
        type: "deposit",
        customerId: recipientUserId,
        description: `IAPAY instant payment received (key: ${resolved.alias.aliasType})`,
        paymentMethod: "iapay",
      });

      return row;
    });
  } catch (err) {
    if (err instanceof Error && err.message === "INSUFFICIENT_FUNDS") {
      return { ok: false, status: 400, message: "Insufficient funds" };
    }
    throw err;
  }

  await checkAndCreateCTR(input.senderUserId, ref, amount, senderWallet.currency, "iapay");

  await db.insert(notificationsTable).values({
    userId: recipientUserId,
    title: "IAPAY Payment Received!",
    message: `${recipientCurrency} ${recipientAmount.toLocaleString(undefined, { maximumFractionDigits: 2 })} received instantly via IAPAY`,
    type: "success",
  });
  await db.insert(auditLogsTable).values({
    userId: input.senderUserId,
    action: "iapay_instant_payment",
    ip: "scheme-switch",
    meta: { ref, endToEndId, amount, currency: senderWallet.currency, recipientCurrency, fxRate, recipientAmount, alias: resolved.alias.aliasValue },
  });

  emitPaymentUpdate(recipientUserId, {
    reference: ref,
    status: "completed",
    amount: recipientAmount,
    currency: recipientCurrency,
    provider: "iapay",
    message: `IAPAY payment received from ${input.senderEmail}`,
  });

  const [senderUser] = await db.select().from(usersTable).where(eq(usersTable.id, input.senderUserId));
  const [recipientUser] = await db.select().from(usersTable).where(eq(usersTable.id, recipientUserId));
  if (senderUser) {
    emailService.sendTransferSentEmail(senderUser, { amount, currency: senderWallet.currency, recipient: resolved.holderName, reference: ref, fee: SCHEME_FEE }).catch(() => {});
  }
  if (recipientUser) {
    emailService.sendTransferReceivedEmail(recipientUser, { amount: recipientAmount, currency: recipientCurrency, sender: senderUser ? `${senderUser.firstName} ${senderUser.lastName}` : "IAPAY user", reference: ref }).catch(() => {});
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
