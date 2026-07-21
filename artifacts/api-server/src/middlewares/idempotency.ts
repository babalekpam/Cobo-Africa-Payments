import { createHash } from "node:crypto";
import type { Request, Response, NextFunction } from "express";

const cache = new Map<string, { statusCode: number; body: unknown; bodyHash: string; timestamp: number }>();
const CACHE_TTL = 24 * 60 * 60 * 1000;

function hashBody(body: unknown): string {
  return createHash("sha256").update(JSON.stringify(body ?? null)).digest("hex");
}

// Route-scoped idempotency middleware. Must be mounted per-route (never globally)
// and always AFTER auth + a key-scoping middleware that namespaces the
// Idempotency-Key by the authenticated user (see scopeIdempotencyKey in
// routes/scheme.ts). The cache entry is additionally keyed by method + path and
// stores a request-body hash: reusing a key with a different payload is
// rejected with 409 instead of replaying the cached response.
export function idempotencyMiddleware(req: Request, res: Response, next: NextFunction): void {
  const key = req.headers["idempotency-key"] as string;
  if (!key || req.method !== "POST") { next(); return; }

  const cacheKey = `${req.method}:${req.baseUrl}${req.path}:${key}`;
  const bodyHash = hashBody(req.body);

  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    if (cached.bodyHash !== bodyHash) {
      res.status(409).json({ error: "Idempotency-Key reused with a different request payload" });
      return;
    }
    res.status(cached.statusCode).json(cached.body);
    return;
  }

  const originalJson = res.json.bind(res);
  res.json = (body: unknown) => {
    cache.set(cacheKey, { statusCode: res.statusCode, body, bodyHash, timestamp: Date.now() });
    if (cache.size > 10000) {
      const now = Date.now();
      for (const [k, v] of cache.entries()) {
        if (now - v.timestamp > CACHE_TTL) cache.delete(k);
      }
    }
    return originalJson(body);
  };

  next();
}
