// Ownership helpers for record-level access control. A record belongs to a user directly
// (a transaction's customer, a merchant's owner) or through a merchant they own.

import { eq } from "drizzle-orm";
import { db, merchantsTable } from "@workspace/db";

/** Ids of the merchants a user owns. */
export async function ownedMerchantIds(userId: number): Promise<number[]> {
  const rows = await db.select({ id: merchantsTable.id }).from(merchantsTable).where(eq(merchantsTable.ownerUserId, userId));
  return rows.map((r) => r.id);
}

/** May `user` see this transaction? Owner (customer), owner of its merchant, or an administrator. */
export function canSeeTransaction(
  user: { id: number; role: string },
  tx: { customerId: number | null; merchantId: number | null },
  ownedMerchants: number[]
): boolean {
  if (user.role === "admin") return true;
  if (tx.customerId === user.id) return true;
  return tx.merchantId !== null && ownedMerchants.includes(tx.merchantId);
}
