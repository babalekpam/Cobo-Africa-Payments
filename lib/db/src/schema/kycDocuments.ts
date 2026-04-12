import { pgTable, text, serial, timestamp, integer } from "drizzle-orm/pg-core";

export const kycDocumentsTable = pgTable("kyc_documents", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  docType: text("doc_type").notNull(),
  docUrl: text("doc_url").notNull(),
  status: text("status").notNull().default("pending"),
  rejectionReason: text("rejection_reason"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
