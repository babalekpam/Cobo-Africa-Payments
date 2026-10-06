import type { Request, Response, NextFunction } from "express";
import { eq } from "drizzle-orm";
import { db, usersTable } from "@workspace/db";
import { verifyToken } from "../lib/auth";
import { accountIsActive } from "../lib/accounts";

export interface AuthenticatedRequest extends Request {
  user?: { id: number; email: string; role: string };
}

/**
 * A valid token is not enough: the account is re-read on EVERY request, so suspending, deactivating
 * or deleting an account, or changing its role, takes effect on the very next call. The role used for
 * authorization is the database's, never the one baked into the token when it was issued.
 */
async function resolveSession(token: string): Promise<{ id: number; email: string; role: string } | null> {
  const payload = verifyToken(token);
  if (!payload) return null;
  const [user] = await db
    .select({ id: usersTable.id, email: usersTable.email, role: usersTable.role, status: usersTable.status, isActive: usersTable.isActive })
    .from(usersTable)
    .where(eq(usersTable.id, payload.id));
  if (!user || !accountIsActive(user)) return null;
  return { id: user.id, email: user.email, role: user.role };
}

export async function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    res.status(401).json({ error: "Unauthorized", message: "Missing or invalid authorization header" });
    return;
  }

  const session = await resolveSession(authHeader.slice(7));
  if (!session) {
    res.status(401).json({ error: "Unauthorized", message: "Invalid or expired token, or the account is not active" });
    return;
  }

  req.user = session;
  next();
}

/** Use AFTER requireAuth: platform administrators only. */
export function requireAdmin(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  if (req.user?.role === "admin") {
    next();
    return;
  }
  res.status(403).json({ error: "Forbidden", message: "Administrator access required" });
}

export async function requireAuthOrQueryToken(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  const authHeader = req.headers.authorization;
  let token: string | null = null;

  if (authHeader && authHeader.startsWith("Bearer ")) {
    token = authHeader.slice(7);
  } else if (req.query.token && typeof req.query.token === "string") {
    token = req.query.token;
  }

  if (!token) {
    res.status(401).json({ error: "Unauthorized", message: "Missing authorization" });
    return;
  }

  const session = await resolveSession(token);
  if (!session) {
    res.status(401).json({ error: "Unauthorized", message: "Invalid or expired token, or the account is not active" });
    return;
  }

  req.user = session;
  next();
}
