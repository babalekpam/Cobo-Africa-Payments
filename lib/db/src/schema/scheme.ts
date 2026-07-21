import { pgTable, text, serial, timestamp, numeric, integer, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

// AfriPay — Pan-African Instant Payment Scheme
// Participant institutions: banks, mobile money operators, fintechs that are members of the scheme
export const schemeParticipantsTable = pgTable("scheme_participants", {
  id: serial("id").primaryKey(),
  code: text("code").notNull().unique(), // BIC-like scheme code, e.g. COBOPANA, EQTYKENA
  name: text("name").notNull(),
  type: text("type").notNull().default("fintech"), // bank | mobile_money | fintech | central_bank
  country: text("country").notNull(), // ISO 3166-1 alpha-2
  currency: text("currency").notNull(), // primary settlement currency
  apiUrl: text("api_url"),
  status: text("status").notNull().default("active"), // active | suspended | pending
  settlementBalance: numeric("settlement_balance", { precision: 18, scale: 2 }).notNull().default("0"),
  joinedAt: timestamp("joined_at", { withTimezone: true }).notNull().defaultNow(),
});

// AfriPay Keys — alias directory (like Pix keys / DICT)
export const paymentAliasesTable = pgTable("payment_aliases", {
  id: serial("id").primaryKey(),
  aliasType: text("alias_type").notNull(), // phone | email | national_id | merchant_id | random
  aliasValue: text("alias_value").notNull().unique(),
  userId: integer("user_id").notNull(),
  participantId: integer("participant_id").notNull(),
  accountRef: text("account_ref").notNull(), // wallet/account identifier at the participant
  currency: text("currency").notNull().default("USD"), // preferred receive currency
  status: text("status").notNull().default("active"), // active | inactive | portability_pending
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
});

// Deferred net settlement cycles between participants
export const settlementBatchesTable = pgTable("settlement_batches", {
  id: serial("id").primaryKey(),
  batchRef: text("batch_ref").notNull().unique(),
  status: text("status").notNull().default("open"), // open | netting | settled
  transferCount: integer("transfer_count").notNull().default(0),
  totalGrossUsd: numeric("total_gross_usd", { precision: 18, scale: 2 }).notNull().default("0"),
  openedAt: timestamp("opened_at", { withTimezone: true }).notNull().defaultNow(),
  closedAt: timestamp("closed_at", { withTimezone: true }),
  settledAt: timestamp("settled_at", { withTimezone: true }),
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

export const insertSchemeParticipantSchema = createInsertSchema(schemeParticipantsTable).omit({ id: true, joinedAt: true });
export type InsertSchemeParticipant = z.infer<typeof insertSchemeParticipantSchema>;
export type SchemeParticipant = typeof schemeParticipantsTable.$inferSelect;

export const insertPaymentAliasSchema = createInsertSchema(paymentAliasesTable).omit({ id: true, createdAt: true });
export type InsertPaymentAlias = z.infer<typeof insertPaymentAliasSchema>;
export type PaymentAlias = typeof paymentAliasesTable.$inferSelect;

export type SchemeTransfer = typeof schemeTransfersTable.$inferSelect;
export type SettlementBatch = typeof settlementBatchesTable.$inferSelect;
export type SettlementPosition = typeof settlementPositionsTable.$inferSelect;
