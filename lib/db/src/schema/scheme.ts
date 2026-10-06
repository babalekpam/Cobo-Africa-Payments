import { pgTable, text, serial, timestamp, numeric, integer, jsonb, uniqueIndex, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

// IAPAY — Pan-African Instant Payment Scheme
// Participant institutions: banks, mobile money operators, fintechs that are members of the scheme
export const schemeParticipantsTable = pgTable("scheme_participants", {
  id: serial("id").primaryKey(),
  code: text("code").notNull().unique(), // BIC-like scheme code, e.g. IAPAYPAN, EQTYKENA
  name: text("name").notNull(),
  type: text("type").notNull().default("fintech"), // bank | mobile_money | fintech | central_bank
  country: text("country").notNull(), // ISO 3166-1 alpha-2
  currency: text("currency").notNull(), // primary settlement currency
  apiUrl: text("api_url"),
  status: text("status").notNull().default("active"), // active | suspended | pending
  settlementBalance: numeric("settlement_balance", { precision: 18, scale: 2 }).notNull().default("0"),
  // Maximum unsettled net debit (USD) this participant may run before the switch
  // rejects further payments it originates. NULL = fall back to the deployment default.
  netDebitCapUsd: numeric("net_debit_cap_usd", { precision: 18, scale: 2 }),
  // Gateway shared secret, AES-256-GCM encrypted (see lib/secretBox.ts); never returned by any API.
  gatewaySecretEnc: text("gateway_secret_enc"),
  secretRotatedAt: timestamp("secret_rotated_at", { withTimezone: true }),
  // Ed25519 public key (PEM). When set, this participant must sign with it; HMAC is refused.
  gatewayPublicKey: text("gateway_public_key"),
  joinedAt: timestamp("joined_at", { withTimezone: true }).notNull().defaultNow(),
});

// IAPAY Keys — alias directory (like Pix keys / DICT)
export const paymentAliasesTable = pgTable("payment_aliases", {
  id: serial("id").primaryKey(),
  aliasType: text("alias_type").notNull(), // phone | email | national_id | merchant_id | random
  aliasValue: text("alias_value").notNull().unique(),
  // Platform user who owns the key. NULL for keys held by an external participant
  // (a bank registers these for its own customers via the gateway).
  userId: integer("user_id"),
  // Display name supplied by the owning participant for external keys (masked on lookup).
  holderName: text("holder_name"),
  participantId: integer("participant_id").notNull(),
  accountRef: text("account_ref").notNull(), // wallet/account identifier at the participant
  currency: text("currency").notNull().default("USD"), // preferred receive currency
  status: text("status").notNull().default("active"), // active | pending_verification | inactive | portability_pending
  verificationCode: text("verification_code"), // sha256 of the OTP while pending
  verificationExpires: timestamp("verification_expires", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// Instant payments routed through the scheme switch
export const schemeTransfersTable = pgTable("scheme_transfers", {
  id: serial("id").primaryKey(),
  reference: text("reference").notNull().unique(),
  endToEndId: text("end_to_end_id").notNull().unique(), // ISO 20022-style E2E id
  senderUserId: integer("sender_user_id"),
  senderParticipantId: integer("sender_participant_id").notNull(),
  senderAlias: text("sender_alias"),
  recipientAlias: text("recipient_alias").notNull(),
  recipientUserId: integer("recipient_user_id"),
  recipientParticipantId: integer("recipient_participant_id").notNull(),
  amount: numeric("amount", { precision: 18, scale: 2 }).notNull(),
  currency: text("currency").notNull(),
  recipientAmount: numeric("recipient_amount", { precision: 18, scale: 2 }).notNull(),
  recipientCurrency: text("recipient_currency").notNull(),
  fxRate: numeric("fx_rate", { precision: 18, scale: 8 }),
  fee: numeric("fee", { precision: 18, scale: 2 }).notNull().default("0"),
  status: text("status").notNull().default("initiated"), // initiated | cleared | settled | rejected | returned
  statusReason: text("status_reason"),
  qrRef: text("qr_ref"),
  settlementBatchId: integer("settlement_batch_id"),
  metadata: jsonb("metadata"),
  initiatedAt: timestamp("initiated_at", { withTimezone: true }).notNull().defaultNow(),
  clearedAt: timestamp("cleared_at", { withTimezone: true }),
  settledAt: timestamp("settled_at", { withTimezone: true }),
}, (t) => [
  // Net-debit exposure is computed per participant over unsettled rows, under a lock.
  index("scheme_transfers_sender_participant_status_idx").on(t.senderParticipantId, t.status),
  index("scheme_transfers_recipient_participant_status_idx").on(t.recipientParticipantId, t.status),
]);

// Deferred net settlement cycles between participants
export const settlementBatchesTable = pgTable("settlement_batches", {
  id: serial("id").primaryKey(),
  batchRef: text("batch_ref").notNull().unique(),
  status: text("status").notNull().default("open"), // open | netting | awaiting_settlement | settled
  transferCount: integer("transfer_count").notNull().default(0),
  totalGrossUsd: numeric("total_gross_usd", { precision: 18, scale: 2 }).notNull().default("0"),
  openedAt: timestamp("opened_at", { withTimezone: true }).notNull().defaultNow(),
  closedAt: timestamp("closed_at", { withTimezone: true }),
  settledAt: timestamp("settled_at", { withTimezone: true }),
  // Proof the net positions were actually paid (e.g. the RTGS / settlement-bank reference) and who confirmed it.
  settlementReference: text("settlement_reference"),
  settledBy: integer("settled_by"),
});

// Multilateral net position of each participant within a settlement batch
export const settlementPositionsTable = pgTable("settlement_positions", {
  id: serial("id").primaryKey(),
  batchId: integer("batch_id").notNull(),
  participantId: integer("participant_id").notNull(),
  currency: text("currency").notNull(),
  totalDebit: numeric("total_debit", { precision: 18, scale: 2 }).notNull().default("0"),
  totalCredit: numeric("total_credit", { precision: 18, scale: 2 }).notNull().default("0"),
  netPosition: numeric("net_position", { precision: 18, scale: 2 }).notNull().default("0"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// Disputes over scheme payments (equivalent of Pix's MED special return mechanism):
// a sender claims fraud or error; the scheme operator reviews and either forces a
// refund back along the original path or denies the claim.
export const schemeDisputesTable = pgTable("scheme_disputes", {
  id: serial("id").primaryKey(),
  transferReference: text("transfer_reference").notNull(),
  openedByUserId: integer("opened_by_user_id").notNull(),
  reason: text("reason").notNull(), // fraud | error | duplicate | other
  description: text("description"),
  status: text("status").notNull().default("open"), // open | under_review | resolved_refund | resolved_denied
  resolutionNote: text("resolution_note"),
  resolvedByUserId: integer("resolved_by_user_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  resolvedAt: timestamp("resolved_at", { withTimezone: true }),
});

// Every signed message accepted from a participant, keyed by (participant, message id).
// This is the replay/idempotency ledger: a re-sent message is answered from the stored
// response and can never move money twice.
export const gatewayMessagesTable = pgTable(
  "gateway_messages",
  {
    id: serial("id").primaryKey(),
    participantCode: text("participant_code").notNull(),
    msgId: text("msg_id").notNull(),
    endToEndId: text("end_to_end_id"),
    status: text("status").notNull().default("received"), // received | credited | forwarded | rejected | pending
    responseStatus: integer("response_status"),
    responseXml: text("response_xml"),
    transferReference: text("transfer_reference"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("gateway_messages_participant_msg_uniq").on(t.participantCode, t.msgId)]
);
export type GatewayMessage = typeof gatewayMessagesTable.$inferSelect;

export const insertSchemeParticipantSchema = createInsertSchema(schemeParticipantsTable).omit({ id: true, joinedAt: true });
export type InsertSchemeParticipant = z.infer<typeof insertSchemeParticipantSchema>;
export type SchemeParticipant = typeof schemeParticipantsTable.$inferSelect;

export const insertPaymentAliasSchema = createInsertSchema(paymentAliasesTable).omit({ id: true, createdAt: true });
export type InsertPaymentAlias = z.infer<typeof insertPaymentAliasSchema>;
export type PaymentAlias = typeof paymentAliasesTable.$inferSelect;

export type SchemeTransfer = typeof schemeTransfersTable.$inferSelect;
export type SchemeDispute = typeof schemeDisputesTable.$inferSelect;
export type SettlementBatch = typeof settlementBatchesTable.$inferSelect;
export type SettlementPosition = typeof settlementPositionsTable.$inferSelect;
