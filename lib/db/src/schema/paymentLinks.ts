import { pgTable, text, serial, timestamp, numeric, integer, boolean } from "drizzle-orm/pg-core";

export const paymentLinksTable = pgTable("payment_links", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  title: text("title").notNull(),
  slug: text("slug").notNull().unique(),
  description: text("description"),
  currency: text("currency").notNull().default("USD"),
  amount: numeric("amount", { precision: 15, scale: 2 }),
  isFixedAmount: boolean("is_fixed_amount").default(true),
  isActive: boolean("is_active").default(true),
  redirectUrl: text("redirect_url"),
  totalCollected: numeric("total_collected", { precision: 15, scale: 2 }).default("0"),
  paymentCount: integer("payment_count").default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
