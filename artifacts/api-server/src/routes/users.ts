import { Router, type IRouter } from "express";
import { eq, ne, ilike, and, SQL, count, sql } from "drizzle-orm";
import { db, usersTable, walletsTable, transactionsTable } from "@workspace/db";
import {
  ListUsersQueryParams,
  CreateUserBody,
  GetUserParams,
  UpdateUserParams,
  UpdateUserBody,
  DeleteUserParams,
} from "@workspace/api-zod";
import { requireAuth, requireAdmin, type AuthenticatedRequest } from "../middlewares/requireAuth";
import { hashPassword } from "../lib/auth";
import { validatePassword } from "../lib/security.js";

const router: IRouter = Router();

// Account management is an administrator function. These routes can mint administrators, suspend
// accounts and delete records, so EVERY one of them requires the administrator role (re-read from
// the database on each request by requireAuth) — a logged-in user is never enough.

function toUserResponse(user: typeof usersTable.$inferSelect) {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    status: user.status,
    phone: user.phone,
    country: user.country,
    kycStatus: (user as any).kycStatus || "unverified",
    kycLevel: Number((user as any).kycLevel || 0),
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}

router.get("/users", requireAuth, requireAdmin, async (req: AuthenticatedRequest, res): Promise<void> => {
  const parsed = ListUsersQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid query params", message: parsed.error.message });
    return;
  }

  const { page = 1, limit = 20, search, role, status } = parsed.data;
  const offset = (page - 1) * limit;

  const conditions: SQL[] = [];
  if (search) conditions.push(ilike(usersTable.name, `%${search}%`));
  if (role) conditions.push(eq(usersTable.role, role));
  if (status) conditions.push(eq(usersTable.status, status));

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  const [users, [{ value: totalCount }]] = await Promise.all([
    db.select().from(usersTable).where(whereClause).limit(limit).offset(offset).orderBy(usersTable.createdAt),
    db.select({ value: count() }).from(usersTable).where(whereClause),
  ]);

  const total = Number(totalCount);
  res.json({
    data: users.map(toUserResponse),
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  });
});

router.post("/users", requireAuth, requireAdmin, async (req: AuthenticatedRequest, res): Promise<void> => {
  const parsed = CreateUserBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request", message: parsed.error.message });
    return;
  }

  const { email, name, password, role, phone, country } = parsed.data;

  const weak = validatePassword(password);
  if (weak) {
    res.status(400).json({ error: "Invalid request", message: weak });
    return;
  }

  const [existing] = await db.select({ id: usersTable.id }).from(usersTable).where(eq(usersTable.email, email));
  if (existing) {
    res.status(409).json({ error: "Conflict", message: "Email already in use" });
    return;
  }

  const passwordHash = hashPassword(password);
  const [user] = await db
    .insert(usersTable)
    .values({ email, name, passwordHash, role, phone, country })
    .returning();

  res.status(201).json(toUserResponse(user));
});

router.get("/users/:id", requireAuth, requireAdmin, async (req: AuthenticatedRequest, res): Promise<void> => {
  const params = GetUserParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: "Invalid params", message: params.error.message });
    return;
  }

  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, params.data.id));
  if (!user) {
    res.status(404).json({ error: "Not found", message: "User not found" });
    return;
  }

  res.json(toUserResponse(user));
});

router.put("/users/:id", requireAuth, requireAdmin, async (req: AuthenticatedRequest, res): Promise<void> => {
  const params = UpdateUserParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: "Invalid params", message: params.error.message });
    return;
  }

  const parsed = UpdateUserBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request", message: parsed.error.message });
    return;
  }

  const [target] = await db.select().from(usersTable).where(eq(usersTable.id, params.data.id));
  if (!target) {
    res.status(404).json({ error: "Not found", message: "User not found" });
    return;
  }

  const changesRole = parsed.data.role !== undefined && parsed.data.role !== target.role;
  const changesStatus = parsed.data.status !== undefined && parsed.data.status !== target.status;

  // Lockout guard rails: an administrator cannot demote or suspend themselves, and the last
  // active administrator can never be demoted or suspended.
  if (target.id === req.user!.id && (changesRole || changesStatus)) {
    res.status(400).json({ error: "Bad request", message: "You cannot change your own role or status" });
    return;
  }
  const removesAdmin = target.role === "admin" && ((changesRole && parsed.data.role !== "admin") || (changesStatus && parsed.data.status !== "active"));
  if (removesAdmin) {
    const [{ n }] = await db
      .select({ n: count() })
      .from(usersTable)
      .where(and(eq(usersTable.role, "admin"), eq(usersTable.status, "active"), ne(usersTable.id, target.id)));
    if (Number(n) === 0) {
      res.status(400).json({ error: "Bad request", message: "This is the last active administrator" });
      return;
    }
  }

  const [user] = await db
    .update(usersTable)
    .set(parsed.data)
    .where(eq(usersTable.id, params.data.id))
    .returning();

  res.json(toUserResponse(user));
});

router.delete("/users/:id", requireAuth, requireAdmin, async (req: AuthenticatedRequest, res): Promise<void> => {
  const params = DeleteUserParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: "Invalid params", message: params.error.message });
    return;
  }
  const id = params.data.id;

  if (id === req.user!.id) {
    res.status(400).json({ error: "Bad request", message: "You cannot delete your own account" });
    return;
  }

  // Never orphan money or history: an account that holds funds or has any transactions must be
  // suspended instead of deleted.
  const [{ funds }] = await db
    .select({ funds: sql<number>`COUNT(*) FILTER (WHERE ${walletsTable.balance} <> 0 OR ${walletsTable.lockedBalance} <> 0)` })
    .from(walletsTable)
    .where(eq(walletsTable.userId, id));
  const [{ txs }] = await db.select({ txs: count() }).from(transactionsTable).where(eq(transactionsTable.customerId, id));
  if (Number(funds) > 0 || Number(txs) > 0) {
    res.status(409).json({ error: "Conflict", message: "This account holds funds or has transaction history; suspend it instead of deleting it" });
    return;
  }

  const [user] = await db.delete(usersTable).where(eq(usersTable.id, id)).returning();
  if (!user) {
    res.status(404).json({ error: "Not found", message: "User not found" });
    return;
  }
  await db.delete(walletsTable).where(eq(walletsTable.userId, id)); // empty wallets only (checked above)

  res.json({ success: true, message: "User deleted" });
});

export default router;
