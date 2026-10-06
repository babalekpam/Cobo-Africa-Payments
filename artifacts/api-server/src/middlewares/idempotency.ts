import { createHash } from "node:crypto";
import type { Request, Response, NextFunction } from "express";
import { and, eq, lt, or, sql } from "drizzle-orm";
import { db, idempotencyRecordsTable } from "@workspace/db";

// Idempotency ledger in Postgres, shared by every API instance and surviving restarts.
const TTL_HOURS = 24;
// A "pending" claim older than this is treated as abandoned (the process died mid-request).
const PENDING_STALE_MINUTES = 5;

function hashBody(body: unknown): string {
  return createHash("sha256").update(JSON.stringify(body ?? null)).digest("hex");
}

// Route-scoped idempotency middleware. Must be mounted per-route (never globally)
// and always AFTER auth + a key-scoping middleware that namespaces the
// Idempotency-Key by the authenticated user (see scopeIdempotencyKey in
// routes/scheme.ts). The record is additionally keyed by method + path and
// stores a request-body hash: reusing a key with a different payload is
// rejected with 409 instead of replaying the stored response.
//
// The first request CLAIMS the key (an atomic insert) before the handler runs, so a duplicate that
// arrives while the first is still running is refused (409) rather than executed a second time.
// A 5xx response releases the claim so the client may retry; any other response is stored and
// replayed to retries for 24 hours.
export async function idempotencyMiddleware(req: Request, res: Response, next: NextFunction): Promise<void> {
  const key = req.headers["idempotency-key"] as string;
  if (!key || req.method !== "POST") { next(); return; }

  const recordKey = `${req.method}:${req.baseUrl}${req.path}:${key}`;
  const bodyHash = hashBody(req.body);

  let claimed = (
    await db.insert(idempotencyRecordsTable).values({ key: recordKey, bodyHash, state: "pending" }).onConflictDoNothing().returning({ key: idempotencyRecordsTable.key })
  ).length > 0;

  if (!claimed) {
    // Take over an expired record or an abandoned claim, atomically (only one retry can win).
    claimed = (
      await db
        .update(idempotencyRecordsTable)
        .set({ bodyHash, state: "pending", statusCode: null, response: null, createdAt: new Date() })
        .where(and(
          eq(idempotencyRecordsTable.key, recordKey),
          or(
            lt(idempotencyRecordsTable.createdAt, sql`now() - ${sql.raw(`interval '${TTL_HOURS} hours'`)}`),
            and(eq(idempotencyRecordsTable.state, "pending"), lt(idempotencyRecordsTable.createdAt, sql`now() - ${sql.raw(`interval '${PENDING_STALE_MINUTES} minutes'`)}`)),
          ),
        ))
        .returning({ key: idempotencyRecordsTable.key })
    ).length > 0;
  }

  if (!claimed) {
    const [rec] = await db.select().from(idempotencyRecordsTable).where(eq(idempotencyRecordsTable.key, recordKey));
    if (!rec) { res.status(409).json({ error: "Request with this Idempotency-Key is being processed; retry shortly" }); return; }
    if (rec.bodyHash !== bodyHash) {
      res.status(409).json({ error: "Idempotency-Key reused with a different request payload" });
      return;
    }
    if (rec.state !== "done") {
      res.status(409).json({ error: "Request with this Idempotency-Key is still being processed" });
      return;
    }
    res.status(rec.statusCode ?? 200).json(rec.response);
    return;
  }

  const originalJson = res.json.bind(res);
  res.json = (body: unknown) => {
    // Record the outcome BEFORE answering, so a retry sent the moment the client sees this response
    // finds it stored (never a lingering "pending").
    const persist = res.statusCode >= 500
      ? db.delete(idempotencyRecordsTable).where(eq(idempotencyRecordsTable.key, recordKey))
      : db.update(idempotencyRecordsTable).set({ state: "done", statusCode: res.statusCode, response: body as object }).where(eq(idempotencyRecordsTable.key, recordKey));
    void Promise.resolve(persist).catch(() => {}).finally(() => originalJson(body));
    if (Math.random() < 0.01) {
      void db.delete(idempotencyRecordsTable)
        .where(lt(idempotencyRecordsTable.createdAt, sql`now() - ${sql.raw(`interval '${TTL_HOURS} hours'`)}`))
        .catch(() => {});
    }
    return res;
  };

  next();
}
