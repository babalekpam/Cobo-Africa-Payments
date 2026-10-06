import { pgTable, text, serial, timestamp, numeric, integer, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const merchantsTable = pgTable("merchants", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  phone: text("phone"),
  country: text("country").notNull(),
  status: text("status").notNull().default("active"),
  businessType: text("business_type"),
  // The platform user who owns this merchant record. NULL = platform-owned (visible to administrators
  // only). Ordinary users can only see and manage merchants they own.
  ownerUserId: integer("owner_user_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
}, (t) => [index("merchants_owner_idx").on(t.ownerUserId)]);

export const insertMerchantSchema = createInsertSchema(merchantsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertMerchant = z.infer<typeof insertMerchantSchema>;
export type Merchant = typeof merchantsTable.$inferSelect;
