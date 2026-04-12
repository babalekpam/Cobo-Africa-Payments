import { pgTable, text, serial, timestamp, integer } from "drizzle-orm/pg-core";

export const beneficiariesTable = pgTable("beneficiaries", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  name: text("name").notNull(),
  country: text("country").notNull(),
  currency: text("currency").notNull(),
  type: text("type").notNull().default("bank"),
  accountNumber: text("account_number"),
  bankName: text("bank_name"),
  phone: text("phone"),
  provider: text("provider"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
