// Ownership registry for private uploaded files. Access rule: the owner or an administrator;
// a file with no recorded owner is administrator-only (fail closed). An unguessable path is a
// convenience, never the access control.

import { eq, like } from "drizzle-orm";
import { db, storedObjectsTable, kycDocumentsTable } from "@workspace/db";
import { logger } from "./logger.js";

const OBJECT_PATH = /^\/objects\/uploads\/[A-Za-z0-9-]{8,64}$/;

export function isValidObjectPath(p: unknown): p is string {
  return typeof p === "string" && OBJECT_PATH.test(p);
}

export async function registerObject(objectPath: string, ownerUserId: number): Promise<void> {
  if (!isValidObjectPath(objectPath)) throw new Error("Invalid object path");
  await db.insert(storedObjectsTable).values({ objectPath, ownerUserId }).onConflictDoNothing();
}

export async function objectOwner(objectPath: string): Promise<number | null> {
  const [row] = await db.select().from(storedObjectsTable).where(eq(storedObjectsTable.objectPath, objectPath));
  return row?.ownerUserId ?? null;
}

export async function userOwnsObject(objectPath: string, userId: number): Promise<boolean> {
  return isValidObjectPath(objectPath) && (await objectOwner(objectPath)) === userId;
}

export async function canReadObject(objectPath: string, user: { id: number; role: string }): Promise<boolean> {
  if (!isValidObjectPath(objectPath)) return false;
  if (user.role === "admin") return true;
  return (await objectOwner(objectPath)) === user.id;
}

/**
 * Files uploaded before ownership was tracked are referenced by KYC records
 * ("file:<path>|<number>"): record the document's user as owner. Idempotent; safe at every start.
 */
export async function backfillStoredObjects(): Promise<number> {
  const docs = await db.select().from(kycDocumentsTable).where(like(kycDocumentsTable.docUrl, "file:/objects/%"));
  let added = 0;
  for (const d of docs) {
    const path = /^file:([^|]+)/.exec(d.docUrl ?? "")?.[1];
    if (!path || !isValidObjectPath(path)) continue;
    const inserted = await db.insert(storedObjectsTable).values({ objectPath: path, ownerUserId: d.userId }).onConflictDoNothing().returning({ id: storedObjectsTable.id });
    added += inserted.length;
  }
  if (added) logger.info({ added }, "Backfilled stored-object owners from KYC records");
  return added;
}
