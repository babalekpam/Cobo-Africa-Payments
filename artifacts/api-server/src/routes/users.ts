import { Router, type IRouter } from "express";
import { eq, ilike, and, SQL, count } from "drizzle-orm";
import { db, usersTable } from "@workspace/db";
import {
  ListUsersQueryParams,
  CreateUserBody,
  GetUserParams,
  UpdateUserParams,
  UpdateUserBody,
  DeleteUserParams,
} from "@workspace/api-zod";
import { requireAuth, type AuthenticatedRequest } from "../middlewares/requireAuth";
import { hashPassword } from "../lib/auth";

const router: IRouter = Router();

function toUserResponse(user: typeof usersTable.$inferSelect) {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    status: user.status,
    phone: user.phone,
    country: user.country,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}

router.get("/users", requireAuth, async (req: AuthenticatedRequest, res): Promise<void> => {
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

router.post("/users", requireAuth, async (req: AuthenticatedRequest, res): Promise<void> => {
  const parsed = CreateUserBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request", message: parsed.error.message });
    return;
  }

  const { email, name, password, role, phone, country } = parsed.data;

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

router.get("/users/:id", requireAuth, async (req: AuthenticatedRequest, res): Promise<void> => {
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

router.put("/users/:id", requireAuth, async (req: AuthenticatedRequest, res): Promise<void> => {
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

  const [user] = await db
    .update(usersTable)
    .set(parsed.data)
    .where(eq(usersTable.id, params.data.id))
    .returning();

  if (!user) {
    res.status(404).json({ error: "Not found", message: "User not found" });
    return;
  }

  res.json(toUserResponse(user));
});

router.delete("/users/:id", requireAuth, async (req: AuthenticatedRequest, res): Promise<void> => {
  const params = DeleteUserParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: "Invalid params", message: params.error.message });
    return;
  }

  const [user] = await db.delete(usersTable).where(eq(usersTable.id, params.data.id)).returning();
  if (!user) {
    res.status(404).json({ error: "Not found", message: "User not found" });
    return;
  }

  res.json({ success: true, message: "User deleted" });
});

export default router;
