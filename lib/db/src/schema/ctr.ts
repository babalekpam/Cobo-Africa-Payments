import { pgTable, serial, integer, text, numeric, timestamp, boolean } from "drizzle-orm/pg-core";

export const ctrReportsTable = pgTable("ctr_reports", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  transactionRef: text("transaction_ref"),
  amount: numeric("amount", { precision: 15, scale: 2 }).notNull(),
  currency: text("currency").notNull(),
  amountUsd: numeric("amount_usd", { precision: 15, scale: 2 }).notNull(),
  transactionType: text("transaction_type").notNull(),
  triggerType: text("trigger_type").notNull().default("single"),
  aggregateTotal: numeric("aggregate_total", { precision: 15, scale: 2 }),
  customerName: text("customer_name"),
  customerEmail: text("customer_email"),
  customerCountry: text("customer_country"),
  customerIdType: text("customer_id_type"),
  customerIdNumber: text("customer_id_number"),
  filingStatus: text("filing_status").notNull().default("pending"),
  filedBy: integer("filed_by"),
  filedAt: timestamp("filed_at", { withTimezone: true }),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const eddReviewsTable = pgTable("edd_reviews", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  triggerReason: text("trigger_reason").notNull(),
  riskLevel: text("risk_level").notNull().default("high"),
  sourceOfFunds: text("source_of_funds"),
  expectedVolume: text("expected_volume"),
  businessPurpose: text("business_purpose"),
  pepStatus: text("pep_status").default("no"),
  reviewNotes: text("review_notes"),
  status: text("status").notNull().default("pending"),
  reviewedBy: integer("reviewed_by"),
  reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
