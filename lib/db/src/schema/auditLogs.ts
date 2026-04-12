import { pgTable, text, serial, timestamp, json } from "drizzle-orm/pg-core";
import { integer } from "drizzle-orm/pg-core";

export const auditLogsTable = pgTable("audit_logs", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  action: text("action").notNull(),
  ip: text("ip"),
  meta: json("meta").$type<Record<string, any>>().default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
