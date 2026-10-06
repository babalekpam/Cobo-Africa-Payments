// Settlement batch helpers shared by the switch, the gateway and returns.

import { eq } from "drizzle-orm";
import { db, settlementBatchesTable } from "@workspace/db";
import { generateRef } from "../../lib/refgen.js";

/** Either the pool or a transaction handle. */
export type DbExecutor = Pick<typeof db, "select" | "insert" | "update" | "execute">;

/** Id of the open settlement batch, creating one if none is open. */
export async function currentOpenBatch(exec: DbExecutor = db): Promise<number> {
  const [open] = await exec.select().from(settlementBatchesTable).where(eq(settlementBatchesTable.status, "open"));
  if (open) return open.id;
  const [batch] = await exec.insert(settlementBatchesTable).values({ batchRef: generateRef("STL") }).returning();
  return batch.id;
}
