import { pgTable, text, serial, timestamp, numeric, integer, jsonb } from "drizzle-orm/pg-core";

export const checkoutSessionsTable = pgTable("checkout_sessions", {
  id: serial("id").primaryKey(),
  sessionId: text("session_id").notNull().unique(),
  merchantUserId: integer("merchant_user_id").notNull(),
  apiKeyId: integer("api_key_id").notNull(),
  amount: numeric("amount", { precision: 15, scale: 2 }).notNull(),
  currency: text("currency").notNull().default("USD"),
  description: text("description"),
  reference: text("reference"),
  customerEmail: text("customer_email"),
  successUrl: text("success_url"),
  cancelUrl: text("cancel_url"),
  webhookUrl: text("webhook_url"),
  status: text("status").notNull().default("pending"),
  metadata: jsonb("metadata"),
  paidAt: timestamp("paid_at", { withTimezone: true }),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const webhookEventsTable = pgTable("webhook_events", {
  id: serial("id").primaryKey(),
  checkoutSessionId: integer("checkout_session_id").notNull(),
  merchantUserId: integer("merchant_user_id").notNull(),
  eventType: text("event_type").notNull(),
  webhookUrl: text("webhook_url").notNull(),
  payload: jsonb("payload"),
  status: text("status").notNull().default("pending"),
  attempts: integer("attempts").default(0),
  lastAttemptAt: timestamp("last_attempt_at", { withTimezone: true }),
  responseCode: integer("response_code"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
