import { pgTable, text, serial, timestamp, integer, boolean } from "drizzle-orm/pg-core";

export const sanctionsScreeningTable = pgTable("sanctions_screening", {
  id: serial("id").primaryKey(),
  userId: integer("user_id"),
  transactionRef: text("transaction_ref"),
  screenedName: text("screened_name").notNull(),
  screenType: text("screen_type").notNull().default("transfer"),
  result: text("result").notNull().default("clear"),
  matchDetails: text("match_details"),
  riskScore: integer("risk_score").default(0),
  reviewedBy: integer("reviewed_by"),
  reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const suspiciousActivityTable = pgTable("suspicious_activity_reports", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  transactionRef: text("transaction_ref"),
  reportType: text("report_type").notNull(),
  description: text("description").notNull(),
  riskLevel: text("risk_level").notNull().default("medium"),
  status: text("status").notNull().default("open"),
  filedBy: integer("filed_by"),
  resolvedBy: integer("resolved_by"),
  resolutionNotes: text("resolution_notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  resolvedAt: timestamp("resolved_at", { withTimezone: true }),
});
