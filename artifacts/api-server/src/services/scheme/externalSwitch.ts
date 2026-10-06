// Multi-participant payment routing for the IAPAY switch.
//
// Four routes, one safety discipline:
//   home → home      (existing wallet-to-wallet path in switchEngine.ts)
//   home → external  createPendingTransfer + dispatchAndFinalize (operator user pays a bank-held key)
//   external → home  handleInboundMessage → creditHome            (bank pays an operator-held key)
//   external → ext.  handleInboundMessage → forward               (bank pays a key held at another bank)
//
// Safety rules enforced here:
//  1. Never call a bank inside a DB transaction (no locks held across the network).
//  2. Debit/reserve first, commit, THEN call the bank, then finalize in a second transaction.
//  3. A bank outcome is ACSC (credited), RJCT (definitely not) or UNKNOWN. UNKNOWN is never
//     assumed either way: funds stay held and the transfer is `unresolved` until an operator
//     (or the bank's status reply) settles it. Auto-refunding an unknown outcome would
//     double-pay if the bank did credit.
//  4. State transitions are conditional UPDATEs (`WHERE status IN (...) RETURNING`), so only
//     one finalizer can win — a refund or a clearing can happen at most once.
//  5. Inbound messages are idempotent through the gateway_messages ledger; the credit and the
//     ledger update commit in the same transaction.
//  6. Banks cannot originate beyond their net-debit cap (checked under a per-participant
//     advisory lock; cap defaults to 0 = fail closed), nor above the single-payment ceiling.

import { and, eq, inArray, lt, or, sql } from "drizzle-orm";
import {
  db,
  walletsTable,
  transactionsTable,
  notificationsTable,
  auditLogsTable,
  schemeTransfersTable,
  schemeParticipantsTable,
  gatewayMessagesTable,
  type SchemeTransfer,
  type SchemeParticipant,
} from "@workspace/db";
import { getAllRates } from "../fxRates.js";
import { screenAgainstOFAC } from "../../lib/ofac.js";
import { generateRef } from "../../lib/refgen.js";
import { isSafeOutboundUrl } from "../../lib/urlSafety.js";
import { isProduction } from "../../lib/security.js";
import { logger } from "../../lib/logger.js";
import { emitPaymentUpdate } from "../socketio.js";
import { loadParticipantSecrets, loadSchemeConfig } from "./config.js";
import { HttpBankAdapter, type CreditResult, type ParticipantAdapter } from "./adapters.js";
import { buildPacs002, type Iso20022Transfer } from "./iso20022.js";
import type { ParsedPacs008 } from "./iso20022Parse.js";
import { currentOpenBatch } from "./batches.js";
import { exposureUsd, toUsd, withinNetDebitCap, MissingRateError, EXPOSURE_STATUSES, type ExposureRow } from "./exposure.js";
import { HOME_PARTICIPANT_CODE, resolveAlias, type ResolvedAlias } from "./directory.js";

// ---------- errors & small helpers ----------

export class CapExceededError extends Error {
  constructor(readonly exposureUsd: number, readonly capUsd: number) {
    super("NET_DEBIT_CAP_EXCEEDED");
  }
}
export class InsufficientFundsError extends Error {
  constructor() {
    super("INSUFFICIENT_FUNDS");
  }
}

export interface GatewayReply {
  status: number;
  xml: string;
}

const nameTokens = (s: string): string[] => s.toUpperCase().replace(/[^A-Z0-9]+/g, " ").split(" ").filter(Boolean);

/**
 * Auto-block decision for the scheme rails. The shared OFAC matcher is deliberately broad
 * (substring + fuzzy) and flags ordinary names — "Ahmed" scores 100, "Mohamed Ali" 90 —
 * so using its raw score to block would refuse legitimate customers. Here a payment is
 * blocked only on a full-name token match against a listed entry or a near-exact fuzzy
 * match (>= 95), for names of at least two parts. Weaker matches (>= 80) are logged for
 * manual review, not blocked; single-word names are too ambiguous to auto-decide.
 * This is a stopgap: production should screen through a licensed sanctions-list provider.
 */
export function sanctionsHit(names: string[]): boolean {
  let hit = false;
  for (const name of names) {
    const tokens = nameTokens(name);
    if (tokens.length < 2) continue;
    for (const m of screenAgainstOFAC(name).matches) {
      const entry = nameTokens(m.entry);
      const sameName = entry.length === tokens.length && entry.every((t) => tokens.includes(t));
      if (sameName || (m.matchType === "fuzzy" && m.score >= 95)) hit = true;
      else if (m.score >= 80) logger.warn({ listedEntry: m.entry, score: m.score }, "Possible sanctions match — manual review");
    }
  }
  return hit;
}

function pgCode(err: unknown): string | undefined {
  const e = err as { code?: string; cause?: { code?: string } };
  return e?.code ?? e?.cause?.code;
}

export function capFor(p: SchemeParticipant, defaultCapUsd = loadSchemeConfig().defaultNetDebitCapUsd): number {
  if (p.netDebitCapUsd === null || p.netDebitCapUsd === undefined) return defaultCapUsd;
  const own = Number(p.netDebitCapUsd);
  return Number.isFinite(own) && own >= 0 ? own : 0;
}

/** Bank-supplied reason codes are untrusted text: keep only a short, plain code. */
function safeReason(reason: string | undefined, fallback: string): string {
  return reason && /^[A-Za-z0-9_.-]{1,35}$/.test(reason) ? reason : fallback;
}

// ---------- adapters ----------

let adapterOverride: ((p: SchemeParticipant) => ParticipantAdapter | null) | null = null;
/** Test hook: inject deterministic adapters. Never used in production code paths. */
export function setAdapterOverrideForTests(fn: typeof adapterOverride): void {
  adapterOverride = fn;
}

/**
 * The adapter for a participant, or null when the switch cannot reach it safely:
 * no apiUrl, no shared secret (cannot sign), or an unsafe/non-https URL in production.
 */
export function adapterFor(p: SchemeParticipant): ParticipantAdapter | null {
  if (adapterOverride) {
    const a = adapterOverride(p);
    if (a) return a;
  }
  if (!p.apiUrl) return null;
  const secret = loadParticipantSecrets()[p.code];
  if (!secret) return null;
  if (!isSafeOutboundUrl(p.apiUrl, { requireHttps: isProduction() })) {
    logger.warn({ participant: p.code }, "Participant apiUrl rejected by outbound URL policy");
    return null;
  }
  return new HttpBankAdapter({
    operatorCode: HOME_PARTICIPANT_CODE,
    participantCode: p.code,
    url: p.apiUrl,
    secret,
    timeoutMs: loadSchemeConfig().gatewayTimeoutMs,
  });
}

// ---------- exposure ----------

async function loadExposure(exec: Pick<typeof db, "select">, participantId: number, rates: Record<string, number>): Promise<number> {
  const rows = await exec
    .select()
    .from(schemeTransfersTable)
    .where(
      and(
        or(eq(schemeTransfersTable.senderParticipantId, participantId), eq(schemeTransfersTable.recipientParticipantId, participantId)),
        inArray(schemeTransfersTable.status, [...EXPOSURE_STATUSES])
      )
    );
  const mapped: ExposureRow[] = rows.map((r) => ({
    senderParticipantId: r.senderParticipantId,
    recipientParticipantId: r.recipientParticipantId,
    currency: r.currency,
    recipientCurrency: r.recipientCurrency,
    amount: Number(r.amount),
    recipientAmount: Number(r.recipientAmount),
    status: r.status,
  }));
  return exposureUsd(participantId, mapped, rates);
}

/** Serialises cap checks per participant for the life of the surrounding transaction. */
async function reserveExposure(
  tx: Pick<typeof db, "select" | "execute">,
  participant: SchemeParticipant,
  amount: number,
  currency: string,
  rates: Record<string, number>
): Promise<void> {
  await tx.execute(sql`select pg_advisory_xact_lock(1001, ${participant.id})`);
  const current = await loadExposure(tx, participant.id, rates);
  const cap = capFor(participant);
  if (!withinNetDebitCap(current, toUsd(amount, currency, rates), cap)) throw new CapExceededError(current, cap);
}

// ---------- pending transfer (debit/reserve phase) ----------

export interface PendingTransferInput {
  reference: string;
  endToEndId: string;
  amount: number;
  currency: string;
  recipientAmount: number;
  recipientCurrency: string;
  fxRate: number | null;
  fee: number;
  senderParticipant: SchemeParticipant;
  recipient: ResolvedAlias;
  description?: string | null;
  qrRef?: string | null;
  /** Home sender: the wallet to debit (balance is locked and checked). */
  senderUserId?: number;
  debitWalletId?: number;
  /** External sender: link the gateway ledger row (the net-debit cap is enforced). */
  ledger?: { participantCode: string; msgId: string };
  rates: Record<string, number>;
}

export async function createPendingTransfer(p: PendingTransferInput): Promise<SchemeTransfer> {
  const total = p.amount + p.fee;
  return db.transaction(async (tx) => {
    if (p.debitWalletId !== undefined) {
      const [locked] = await tx.select().from(walletsTable).where(eq(walletsTable.id, p.debitWalletId)).for("update");
      if (!locked || Number(locked.balance) < total) throw new InsufficientFundsError();
      await tx
        .update(walletsTable)
        .set({ balance: sql`${walletsTable.balance} - ${String(total)}` })
        .where(eq(walletsTable.id, locked.id));
    } else {
      await reserveExposure(tx, p.senderParticipant, p.amount, p.currency, p.rates);
    }

    const [row] = await tx
      .insert(schemeTransfersTable)
      .values({
        reference: p.reference,
        endToEndId: p.endToEndId,
        senderUserId: p.senderUserId ?? null,
        senderParticipantId: p.senderParticipant.id,
        recipientAlias: p.recipient.alias.aliasValue,
        recipientUserId: p.recipient.holderUserId,
        recipientParticipantId: p.recipient.participant.id,
        amount: String(p.amount),
        currency: p.currency,
        recipientAmount: String(p.recipientAmount),
        recipientCurrency: p.recipientCurrency,
        fxRate: p.fxRate ? String(p.fxRate) : null,
        fee: String(p.fee),
        status: "pending",
        qrRef: p.qrRef ?? null,
        metadata: {
          description: p.description ?? null,
          aliasType: p.recipient.alias.aliasType,
          external: true,
          // Everything needed to refund correctly later, without trusting any caller:
          debitWalletId: p.debitWalletId ?? null,
          debitTotal: p.debitWalletId !== undefined ? total : null,
        },
      })
      .returning();

    if (p.senderUserId !== undefined) {
      await tx.insert(transactionsTable).values({
        reference: p.reference,
        amount: String(p.amount),
        currency: p.currency,
        status: "pending",
        type: "send",
        customerId: p.senderUserId,
        description: p.description || `IAPAY instant payment to ${p.recipient.holderName}`,
        paymentMethod: "iapay",
      });
    }

    if (p.ledger) {
      await tx
        .update(gatewayMessagesTable)
        .set({ status: "pending", transferReference: p.reference })
        .where(and(eq(gatewayMessagesTable.participantCode, p.ledger.participantCode), eq(gatewayMessagesTable.msgId, p.ledger.msgId)));
    }
    return row;
  });
}

// ---------- state transitions (single-winner) ----------

async function markCleared(reference: string, from: string[]): Promise<SchemeTransfer | null> {
  return db.transaction(async (tx) => {
    const batchId = await currentOpenBatch(tx);
    const [row] = await tx
      .update(schemeTransfersTable)
      .set({ status: "cleared", clearedAt: new Date(), settlementBatchId: batchId, statusReason: null })
      .where(and(eq(schemeTransfersTable.reference, reference), inArray(schemeTransfersTable.status, from)))
      .returning();
    if (!row) return null;
    await tx.update(transactionsTable).set({ status: "completed" }).where(eq(transactionsTable.reference, reference));
    return row;
  });
}

async function markRejected(reference: string, reason: string, from: string[]): Promise<SchemeTransfer | null> {
  return db.transaction(async (tx) => {
    const [row] = await tx
      .update(schemeTransfersTable)
      .set({ status: "rejected", statusReason: reason })
      .where(and(eq(schemeTransfersTable.reference, reference), inArray(schemeTransfersTable.status, from)))
      .returning();
    if (!row) return null; // someone else already finalized — never refund twice
    const meta = (row.metadata ?? {}) as { debitWalletId?: number | null; debitTotal?: number | null };
    if (meta.debitWalletId && meta.debitTotal && meta.debitTotal > 0) {
      await tx
        .update(walletsTable)
        .set({ balance: sql`${walletsTable.balance} + ${String(meta.debitTotal)}` })
        .where(eq(walletsTable.id, meta.debitWalletId));
    }
    await tx.update(transactionsTable).set({ status: "failed" }).where(eq(transactionsTable.reference, reference));
    return row;
  });
}

async function markUnresolved(reference: string, reason: string): Promise<SchemeTransfer | null> {
  const [row] = await db
    .update(schemeTransfersTable)
    .set({ status: "unresolved", statusReason: reason })
    .where(and(eq(schemeTransfersTable.reference, reference), eq(schemeTransfersTable.status, "pending")))
    .returning();
  return row ?? null;
}

async function loadTransfer(reference: string): Promise<SchemeTransfer | null> {
  const [row] = await db.select().from(schemeTransfersTable).where(eq(schemeTransfersTable.reference, reference));
  return row ?? null;
}

export type OutcomeKind = "cleared" | "rejected" | "unresolved";
export interface Outcome {
  kind: OutcomeKind;
  transfer: SchemeTransfer;
  /** ISO status reason from the bank (RJCT) or a diagnostic (unresolved). */
  reason?: string;
}

function kindOf(status: string): OutcomeKind {
  if (status === "cleared" || status === "settled") return "cleared";
  if (status === "rejected") return "rejected";
  return "unresolved";
}

/** Phase 2+3: hand the payment to the bank (outside any transaction) and record the outcome. */
export async function dispatchAndFinalize(transfer: SchemeTransfer, iso: Iso20022Transfer, adapter: ParticipantAdapter): Promise<Outcome> {
  let result: CreditResult;
  try {
    result = await adapter.sendCreditTransfer(iso);
  } catch (err) {
    logger.error({ err, reference: transfer.reference }, "Participant adapter threw — outcome unknown");
    result = { status: "UNKNOWN", reason: "adapter_error" };
  }

  let reason: string | undefined;
  if (result.status === "ACSC") {
    await markCleared(transfer.reference, ["pending", "unresolved"]);
  } else if (result.status === "RJCT") {
    reason = safeReason(result.reason, "NARR");
    await markRejected(transfer.reference, `participant_rejected:${reason}`, ["pending", "unresolved"]);
  } else {
    reason = safeReason(result.reason, "unknown");
    await markUnresolved(transfer.reference, `participant_outcome_unknown:${reason}`);
  }

  const current = (await loadTransfer(transfer.reference)) ?? transfer;
  return { kind: kindOf(current.status), transfer: current, reason };
}

// ---------- operator reconciliation ----------

export async function resolveUnresolvedTransfer(
  reference: string,
  outcome: "credited" | "not_credited",
  adminUserId: number,
  note: string
): Promise<{ ok: boolean; status: number; message: string; transfer?: SchemeTransfer }> {
  const transfer =
    outcome === "credited"
      ? await markCleared(reference, ["unresolved"])
      : await markRejected(reference, "operator_resolved_not_credited", ["unresolved"]);
  if (!transfer) return { ok: false, status: 409, message: "Transfer is not in the unresolved state" };
  await db.insert(auditLogsTable).values({
    userId: adminUserId,
    action: "iapay_resolve_unresolved_transfer",
    ip: "admin",
    meta: { reference, outcome, note: note.slice(0, 500) },
  });
  return { ok: true, status: 200, message: outcome === "credited" ? "Transfer cleared" : "Transfer rejected and sender refunded", transfer };
}

/** Pending rows older than the cutoff were interrupted mid-flight; park them for review (never auto-refund). */
export async function sweepStalePending(maxAgeMs: number): Promise<number> {
  const cutoff = new Date(Date.now() - maxAgeMs);
  const rows = await db
    .update(schemeTransfersTable)
    .set({ status: "unresolved", statusReason: "interrupted_before_participant_outcome" })
    .where(and(eq(schemeTransfersTable.status, "pending"), lt(schemeTransfersTable.initiatedAt, cutoff)))
    .returning({ reference: schemeTransfersTable.reference });
  if (rows.length) logger.warn({ count: rows.length }, "Stale pending transfers parked as unresolved");
  return rows.length;
}

// ---------- ISO message construction ----------

export function toIso(
  t: SchemeTransfer,
  debtor: { name: string; participant: SchemeParticipant },
  creditor: { name: string; participant: SchemeParticipant },
  description?: string | null
): Iso20022Transfer {
  return {
    reference: t.reference,
    endToEndId: t.endToEndId,
    amount: Number(t.amount),
    currency: t.currency,
    recipientAmount: Number(t.recipientAmount),
    recipientCurrency: t.recipientCurrency,
    fxRate: t.fxRate ? Number(t.fxRate) : null,
    initiatedAt: t.initiatedAt,
    clearedAt: t.clearedAt,
    description: description ?? null,
    creditorAlias: t.recipientAlias,
    debtor: { name: debtor.name, agentName: debtor.participant.name, participantCode: debtor.participant.code, country: debtor.participant.country },
    creditor: { name: creditor.name, agentName: creditor.participant.name, participantCode: creditor.participant.code, country: creditor.participant.country },
  };
}

// ---------- inbound (a bank sends us a pacs.008) ----------

const ID_PATTERN = /^[A-Za-z0-9._\-]{1,35}$/;

function isoReason(statusReason: string | null): string {
  const m = /^participant_rejected:([A-Z0-9]{2,4})$/.exec(statusReason ?? "");
  return m ? m[1] : "NARR";
}

/** The reply for a transfer as it stands *now* — used for replays and status queries. */
export function replyForTransfer(t: SchemeTransfer): GatewayReply {
  const kind = kindOf(t.status);
  if (kind === "cleared") return { status: 200, xml: buildPacs002(t, "ACSC") };
  if (kind === "rejected") return { status: 422, xml: buildPacs002(t, "RJCT", isoReason(t.statusReason)) };
  return { status: 202, xml: buildPacs002(t, "PDNG") };
}

async function patchLedger(
  participantCode: string,
  msgId: string,
  patch: Partial<{ status: string; responseStatus: number; responseXml: string; transferReference: string }>
): Promise<void> {
  await db
    .update(gatewayMessagesTable)
    .set(patch)
    .where(and(eq(gatewayMessagesTable.participantCode, participantCode), eq(gatewayMessagesTable.msgId, msgId)));
}

type Reject = (reason: string, status?: number) => Promise<GatewayReply>;

export async function handleInboundMessage(sender: SchemeParticipant, parsed: ParsedPacs008): Promise<GatewayReply> {
  const cfg = loadSchemeConfig();
  const synthetic = { reference: parsed.instrId, endToEndId: parsed.endToEndId, clearedAt: null, initiatedAt: new Date() };
  const reject: Reject = async (reason, status = 422) => {
    const reply = { status, xml: buildPacs002(synthetic, "RJCT", reason) };
    await patchLedger(sender.code, parsed.msgId, { status: "rejected", responseStatus: reply.status, responseXml: reply.xml });
    return reply;
  };

  // 0. Structural limits on ids the bank controls
  if (![parsed.msgId, parsed.instrId, parsed.endToEndId].every((v) => ID_PATTERN.test(v))) {
    return { status: 400, xml: buildPacs002(synthetic, "RJCT", "FF01") };
  }

  // 1. Idempotency ledger — the replay gate. A repeated message never moves money twice.
  const inserted = await db
    .insert(gatewayMessagesTable)
    .values({ participantCode: sender.code, msgId: parsed.msgId, endToEndId: parsed.endToEndId })
    .onConflictDoNothing()
    .returning();
  if (inserted.length === 0) {
    const [prior] = await db
      .select()
      .from(gatewayMessagesTable)
      .where(and(eq(gatewayMessagesTable.participantCode, sender.code), eq(gatewayMessagesTable.msgId, parsed.msgId)));
    if (!prior || prior.endToEndId !== parsed.endToEndId) {
      // Same message id re-used for a different payment: refuse, reveal nothing about the original.
      return { status: 422, xml: buildPacs002(synthetic, "RJCT", "DUPL") };
    }
    if (prior.transferReference) {
      const t = await loadTransfer(prior.transferReference);
      if (t) return replyForTransfer(t);
    }
    if (prior.responseXml) return { status: prior.responseStatus ?? 422, xml: prior.responseXml };
    return { status: 409, xml: buildPacs002(synthetic, "PDNG") }; // first attempt still in flight
  }

  try {
    // 2. Identity & routing checks
    if (parsed.debtorAgentCode !== sender.code) return await reject("RC01");
    if (sender.status !== "active") return await reject("AG01"); // transaction forbidden

    if (Math.round(parsed.amount * 100) / 100 !== parsed.amount) return await reject("AM02"); // never silently round money

    const rates = await getAllRates();
    let amountUsd: number;
    try {
      amountUsd = toUsd(parsed.amount, parsed.currency, rates);
    } catch (err) {
      if (err instanceof MissingRateError) return await reject("AM03"); // currency not supported
      throw err;
    }
    if (amountUsd > cfg.gatewayMaxSingleAmountUsd) return await reject("AM02");

    if (sanctionsHit([parsed.debtorName])) return await reject("RR04"); // regulatory reason

    // 3. Resolve the key
    const resolved = await resolveAlias(parsed.creditorAlias);
    if (!resolved) return await reject("AC03"); // invalid creditor account
    if (parsed.creditorAgentCode !== resolved.participant.code) return await reject("RC01");
    if (resolved.alias.currency !== parsed.currency) return await reject("AM03"); // sending bank converts; we don't guess FX
    if (sanctionsHit(resolved.holderScreenNames)) return await reject("RR04");

    const isHome = resolved.participant.code === HOME_PARTICIPANT_CODE && resolved.holderUserId !== null;
    return await (isHome ? creditHome(sender, parsed, resolved, rates) : forward(sender, parsed, resolved, rates, reject));
  } catch (err) {
    if (err instanceof CapExceededError) {
      logger.warn({ participant: sender.code, exposure: err.exposureUsd, cap: err.capUsd }, "Net-debit cap exceeded");
      return reject("AM23"); // amount exceeds settlement limit
    }
    if (pgCode(err) === "23505") return reject("DUPL"); // end-to-end id already used in the network
    logger.error({ err, participant: sender.code, msgId: parsed.msgId }, "Inbound gateway processing failed");
    // Nothing committed if the ledger row is still `received`: free the message id so the bank can retry.
    // (A row already `pending` keeps its transfer link, so a retry gets the live status instead.)
    await db
      .delete(gatewayMessagesTable)
      .where(and(eq(gatewayMessagesTable.participantCode, sender.code), eq(gatewayMessagesTable.msgId, parsed.msgId), eq(gatewayMessagesTable.status, "received")));
    return { status: 500, xml: buildPacs002(synthetic, "PDNG") };
  }
}

async function creditHome(sender: SchemeParticipant, parsed: ParsedPacs008, resolved: ResolvedAlias, rates: Record<string, number>): Promise<GatewayReply> {
  const ref = generateRef("IAP");
  const holderId = resolved.holderUserId as number; // creditHome is only reached for platform-held keys
  const description = parsed.remittance ?? `IAPAY payment received from ${sender.name}`;

  const { row, reply } = await db.transaction(async (tx) => {
    await reserveExposure(tx, sender, parsed.amount, parsed.currency, rates);

    let [wallet] = await tx
      .select()
      .from(walletsTable)
      .where(and(eq(walletsTable.userId, holderId), eq(walletsTable.currency, parsed.currency)))
      .for("update");
    if (!wallet) [wallet] = await tx.insert(walletsTable).values({ userId: holderId, currency: parsed.currency }).returning();
    await tx
      .update(walletsTable)
      .set({ balance: sql`${walletsTable.balance} + ${String(parsed.amount)}` })
      .where(eq(walletsTable.id, wallet.id));

    const batchId = await currentOpenBatch(tx);
    const [transfer] = await tx
      .insert(schemeTransfersTable)
      .values({
        reference: ref,
        endToEndId: parsed.endToEndId,
        senderUserId: null,
        senderParticipantId: sender.id,
        recipientAlias: resolved.alias.aliasValue,
        recipientUserId: holderId,
        recipientParticipantId: resolved.participant.id,
        amount: String(parsed.amount),
        currency: parsed.currency,
        recipientAmount: String(parsed.amount),
        recipientCurrency: parsed.currency,
        fxRate: "1",
        fee: "0",
        status: "cleared",
        clearedAt: new Date(),
        settlementBatchId: batchId,
        metadata: { inbound: true, description, msgId: parsed.msgId, aliasType: resolved.alias.aliasType },
      })
      .returning();

    await tx.insert(transactionsTable).values({
      reference: `${ref}-R`,
      amount: String(parsed.amount),
      currency: parsed.currency,
      status: "completed",
      type: "deposit",
      customerId: holderId,
      description: `IAPAY payment received from ${sender.name}`,
      paymentMethod: "iapay",
    });

    const response = replyForTransfer(transfer);
    await tx
      .update(gatewayMessagesTable)
      .set({ status: "credited", responseStatus: response.status, responseXml: response.xml, transferReference: ref })
      .where(and(eq(gatewayMessagesTable.participantCode, sender.code), eq(gatewayMessagesTable.msgId, parsed.msgId)));
    return { row: transfer, reply: response };
  });

  // Best-effort side effects — money already committed; failures here must not alter the reply.
  try {
    await db.insert(notificationsTable).values({
      userId: holderId,
      title: "IAPAY Payment Received!",
      message: `${parsed.currency} ${parsed.amount.toLocaleString(undefined, { maximumFractionDigits: 2 })} received from ${sender.name}`,
      type: "success",
    });
    await db.insert(auditLogsTable).values({
      userId: holderId,
      action: "iapay_inbound_credit",
      ip: "gateway",
      meta: { ref, endToEndId: row.endToEndId, participant: sender.code, amount: parsed.amount, currency: parsed.currency },
    });
    emitPaymentUpdate(holderId, {
      reference: ref,
      status: "completed",
      amount: parsed.amount,
      currency: parsed.currency,
      provider: "iapay",
      message: `IAPAY payment received from ${sender.name}`,
    });
  } catch (err) {
    logger.warn({ err, ref }, "Post-credit notifications failed");
  }
  return reply;
}

async function forward(
  sender: SchemeParticipant,
  parsed: ParsedPacs008,
  resolved: ResolvedAlias,
  rates: Record<string, number>,
  reject: Reject
): Promise<GatewayReply> {
  const adapter = adapterFor(resolved.participant);
  if (!adapter) return reject("AC13"); // creditor agent not reachable — nothing was reserved or sent

  const transfer = await createPendingTransfer({
    reference: generateRef("IAP"),
    endToEndId: parsed.endToEndId,
    amount: parsed.amount,
    currency: parsed.currency,
    recipientAmount: parsed.amount,
    recipientCurrency: parsed.currency,
    fxRate: 1,
    fee: 0,
    senderParticipant: sender,
    recipient: resolved,
    description: parsed.remittance,
    ledger: { participantCode: sender.code, msgId: parsed.msgId },
    rates,
  });

  const iso = toIso(
    transfer,
    { name: parsed.debtorName, participant: sender },
    { name: resolved.holderName, participant: resolved.participant },
    parsed.remittance
  );
  const outcome = await dispatchAndFinalize(transfer, iso, adapter);
  const reply = replyForTransfer(outcome.transfer);
  if (outcome.kind !== "unresolved") {
    await patchLedger(sender.code, parsed.msgId, {
      status: outcome.kind === "cleared" ? "forwarded" : "rejected",
      responseStatus: reply.status,
      responseXml: reply.xml,
    });
  }
  return reply;
}

// ---------- status query (a bank asks what happened to its payment) ----------

export async function statusForParticipant(participant: SchemeParticipant, endToEndId: string): Promise<GatewayReply | null> {
  if (!ID_PATTERN.test(endToEndId)) return null;
  const [t] = await db
    .select()
    .from(schemeTransfersTable)
    .where(
      and(
        eq(schemeTransfersTable.endToEndId, endToEndId),
        or(eq(schemeTransfersTable.senderParticipantId, participant.id), eq(schemeTransfersTable.recipientParticipantId, participant.id))
      )
    );
  return t ? replyForTransfer(t) : null;
}

export async function getParticipantByCode(code: string): Promise<SchemeParticipant | null> {
  const [p] = await db.select().from(schemeParticipantsTable).where(eq(schemeParticipantsTable.code, code));
  return p ?? null;
}
