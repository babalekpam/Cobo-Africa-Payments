import { pgTable, text, serial, timestamp, numeric, integer, jsonb } from "drizzle-orm/pg-core";

export const paymentIntentsTable = pgTable("payment_intents", {
  id: serial("id").primaryKey(),
  reference: text("reference").notNull().unique(),
  transactionReference: text("transaction_reference"),
  userId: integer("user_id").notNull(),
  walletId: integer("wallet_id"),
  provider: text("provider").notNull(), // flutterwave | mpesa | mtn_momo | airtel | internal
  providerReference: text("provider_reference"),
  status: text("status").notNull().default("pending"), // pending | success | failed | cancelled
  amount: numeric("amount", { precision: 15, scale: 2 }).notNull(),
  currency: text("currency").notNull(),
  recipientPhone: text("recipient_phone"),
  recipientName: text("recipient_name"),
  recipientCountry: text("recipient_country"),
  recipientCurrency: text("recipient_currency"),
  fee: numeric("fee", { precision: 15, scale: 2 }).default("0"),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export type PaymentIntent = typeof paymentIntentsTable.$inferSelect;
