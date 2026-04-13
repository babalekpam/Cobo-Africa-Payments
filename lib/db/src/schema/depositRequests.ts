import { pgTable, serial, integer, text, numeric, timestamp } from "drizzle-orm/pg-core";

export const depositRequestsTable = pgTable("deposit_requests", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  currency: text("currency").notNull(),
  amount: numeric("amount", { precision: 15, scale: 2 }).notNull(),
  method: text("method").default("bank").notNull(),
  reference: text("reference").notNull(),
  bankName: text("bank_name"),
  senderName: text("sender_name"),
  senderAccount: text("sender_account"),
  proofUrl: text("proof_url"),
  notes: text("notes"),
  status: text("status").default("pending").notNull(),
  reviewedBy: integer("reviewed_by"),
  rejectionReason: text("rejection_reason"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
});
