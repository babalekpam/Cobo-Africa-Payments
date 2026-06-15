import type { Request, Response, NextFunction } from "express";

const cache = new Map<string, { statusCode: number; body: unknown; timestamp: number }>();
const CACHE_TTL = 24 * 60 * 60 * 1000;

export function idempotencyMiddleware(req: Request, res: Response, next: NextFunction): void {
  const key = req.headers["idempotency-key"] as string;
  if (!key || req.method !== "POST") { next(); return; }

  const cached = cache.get(key);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    res.status(cached.statusCode).json(cached.body);
    return;
  }

  const originalJson = res.json.bind(res);
  res.json = (body: unknown) => {
    cache.set(key, { statusCode: res.statusCode, body, timestamp: Date.now() });
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
