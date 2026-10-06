import { pgTable, text, serial, timestamp, integer } from "drizzle-orm/pg-core";

// Who owns each uploaded private file (KYC documents etc.). The storage backends hold the bytes;
// this table is the authority on who may read them: the owner, or an administrator.
export const storedObjectsTable = pgTable("stored_objects", {
  id: serial("id").primaryKey(),
  objectPath: text("object_path").notNull().unique(), // e.g. /objects/uploads/<uuid>
  ownerUserId: integer("owner_user_id").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type StoredObject = typeof storedObjectsTable.$inferSelect;
