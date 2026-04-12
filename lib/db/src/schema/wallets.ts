import { pgTable, text, serial, timestamp, numeric, integer, boolean } from "drizzle-orm/pg-core";

export const walletsTable = pgTable("wallets", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  currency: text("currency").notNull(),
  balance: numeric("balance", { precision: 15, scale: 2 }).notNull().default("0"),
  lockedBalance: numeric("locked_balance", { precision: 15, scale: 2 }).notNull().default("0"),
  isDefault: boolean("is_default").default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
