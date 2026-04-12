import { Router, type IRouter } from "express";
import { eq, and, count, sum, sql, desc } from "drizzle-orm";
import { db, usersTable, walletsTable, transactionsTable, notificationsTable, kycDocumentsTable } from "@workspace/db";
import { LoginBody } from "@workspace/api-zod";
import { hashPassword, comparePassword, signToken } from "../lib/auth";
import { requireAuth, type AuthenticatedRequest } from "../middlewares/requireAuth";

const router: IRouter = Router();

function safeUser(user: any) {
  return {
    id: user.id, email: user.email, name: user.name,
    first_name: user.firstName, last_name: user.lastName,
    role: user.role, status: user.status, phone: user.phone, country: user.country,
    business_name: user.businessName, business_type: user.businessType,
    kyc_status: user.kycStatus, kyc_level: Number(user.kycLevel || 0),
    is_active: user.isActive === "true",
    createdAt: user.createdAt, updatedAt: user.updatedAt,
  };
}

router.post("/auth/register", async (req, res): Promise<void> => {
  const { email, password, first_name, last_name, country, business_name, phone, id_type, id_number, date_of_birth } = req.body;
  if (!email || !password || !first_name || !last_name) {
    res.status(400).json({ success: false, message: "Missing required fields" });
    return;
  }
  const [existing] = await db.select().from(usersTable).where(eq(usersTable.email, email));
  if (existing) { res.status(409).json({ success: false, message: "Email already registered" }); return; }
  const passwordHash = hashPassword(password);
  const name = `${first_name} ${last_name}`;
  const DEFAULT_CURRENCIES: Record<string, string> = {
    NG:"NGN",GH:"GHS",SN:"XOF",TG:"XOF",CI:"XOF",BJ:"XOF",BF:"XOF",NE:"XOF",ML:"XOF",GW:"XOF",
    CM:"XAF",GA:"XAF",TD:"XAF",CG:"XAF",CF:"XAF",GQ:"XAF",
    KE:"KES",ZA:"ZAR",EG:"EGP",MA:"MAD",TZ:"TZS",UG:"UGX",ET:"ETB",RW:"RWF",
    CD:"CDF",AO:"AOA",MZ:"MZN",BW:"BWP",MW:"MWK",ZM:"ZMW",
    SD:"SDG",TN:"TND",DZ:"DZD",LY:"LYD",
    GM:"GMD",SL:"SLL",GN:"GNF",CV:"CVE",ST:"STN",
    SC:"SCR",MU:"MUR",MG:"MGA",KM:"KMF",DJ:"DJF",
    ER:"ERN",SO:"SOS",SS:"SSP",BI:"BIF",LS:"LSL",SZ:"SZL",NA:"NAD",
    LR:"LRD",MR:"MRU",
    US:"USD",GB:"GBP",FR:"EUR",
  };
  const [user] = await db.insert(usersTable).values({ email, name, firstName: first_name, lastName: last_name, passwordHash, country: country || "US", phone, businessName: business_name }).returning();
  const primaryCur = DEFAULT_CURRENCIES[country || "US"] || "USD";
  const currencies = [...new Set([primaryCur, "USD"])];
  for (let i = 0; i < currencies.length; i++) {
    await db.insert(walletsTable).values({ userId: user.id, currency: currencies[i], isDefault: i === 0 });
  }
  if (id_type && id_number) {
    await db.insert(kycDocumentsTable).values({ userId: user.id, docType: id_type, docUrl: id_number });
    await db.update(usersTable).set({ kycStatus: "submitted" }).where(eq(usersTable.id, user.id));
    await db.insert(notificationsTable).values({ userId: user.id, title: "Welcome to COBO! 🌍", message: "Your account is ready. Your ID verification is being reviewed by our compliance team.", type: "success" });
  } else {
    await db.insert(notificationsTable).values({ userId: user.id, title: "Welcome to COBO! 🌍", message: "Your account is ready. Please verify your identity to unlock full features.", type: "success" });
  }
  const wallets = await db.select().from(walletsTable).where(eq(walletsTable.userId, user.id));
  const token = signToken({ id: user.id, email: user.email, role: user.role });
  res.status(201).json({ success: true, token, user: safeUser(user), wallets: wallets.map(w => ({ ...w, balance: Number(w.balance), lockedBalance: Number(w.lockedBalance) })) });
});

router.post("/auth/login", async (req, res): Promise<void> => {
  const parsed = LoginBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Invalid request", message: parsed.error.message }); return; }
  const { email, password } = parsed.data;
  const [user] = await db.select().from(usersTable).where(eq(usersTable.email, email));
  if (!user || !comparePassword(password, user.passwordHash)) { res.status(401).json({ success: false, message: "Invalid credentials" }); return; }
  if (user.status !== "active" && user.isActive === "false") { res.status(401).json({ success: false, message: "Account is suspended" }); return; }
  const token = signToken({ id: user.id, email: user.email, role: user.role });
  const wallets = await db.select().from(walletsTable).where(eq(walletsTable.userId, user.id));
  res.json({ success: true, token, user: safeUser(user), wallets: wallets.map(w => ({ ...w, balance: Number(w.balance), lockedBalance: Number(w.lockedBalance) })) });
});

router.get("/auth/me", requireAuth, async (req: AuthenticatedRequest, res): Promise<void> => {
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, req.user!.id));
  if (!user) { res.status(404).json({ success: false, message: "User not found" }); return; }
  const wallets = await db.select().from(walletsTable).where(eq(walletsTable.userId, user.id));
  res.json({ success: true, user: safeUser(user), wallets: wallets.map(w => ({ ...w, balance: Number(w.balance), lockedBalance: Number(w.lockedBalance) })) });
});

router.put("/auth/profile", requireAuth, async (req: AuthenticatedRequest, res): Promise<void> => {
  const { first_name, last_name, phone, business_name, business_type } = req.body;
  const [current] = await db.select().from(usersTable).where(eq(usersTable.id, req.user!.id));
  const updates: any = {};
  if (first_name) { updates.firstName = first_name; updates.name = `${first_name} ${current?.lastName || ""}`; }
  if (last_name) { updates.lastName = last_name; updates.name = `${current?.firstName || ""} ${last_name}`; }
  if (first_name && last_name) updates.name = `${first_name} ${last_name}`;
  if (phone !== undefined) updates.phone = phone;
  if (business_name !== undefined) updates.businessName = business_name;
  if (business_type) updates.businessType = business_type;
  await db.update(usersTable).set(updates).where(eq(usersTable.id, req.user!.id));
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, req.user!.id));
  res.json({ success: true, message: "Profile updated", user: safeUser(user) });
});

router.post("/auth/change-password", requireAuth, async (req: AuthenticatedRequest, res): Promise<void> => {
  const { current_password, new_password } = req.body;
  if (!current_password || !new_password || new_password.length < 8) { res.status(400).json({ success: false, message: "Invalid password data" }); return; }
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, req.user!.id));
  if (!comparePassword(current_password, user.passwordHash)) { res.status(400).json({ success: false, message: "Current password incorrect" }); return; }
  await db.update(usersTable).set({ passwordHash: hashPassword(new_password) }).where(eq(usersTable.id, req.user!.id));
  res.json({ success: true, message: "Password changed successfully" });
});

router.get("/auth/dashboard", requireAuth, async (req: AuthenticatedRequest, res): Promise<void> => {
  const uid = req.user!.id;
  const wallets = await db.select().from(walletsTable).where(eq(walletsTable.userId, uid));
  const allTx = await db.select().from(transactionsTable).where(eq(transactionsTable.customerId, uid)).orderBy(desc(transactionsTable.createdAt));
  const successTx = allTx.filter(t => t.status === "completed" || t.status === "success");
  const recent = allTx.slice(0, 10);
  const [unreadCount] = await db.select({ count: count() }).from(notificationsTable).where(and(eq(notificationsTable.userId, uid), eq(notificationsTable.isRead, false)));
  const monthlyMap: Record<string, { month: string; volume: number; count: number }> = {};
  successTx.forEach(t => {
    const m = t.createdAt.toISOString().slice(0, 7);
    if (!monthlyMap[m]) monthlyMap[m] = { month: m, volume: 0, count: 0 };
    monthlyMap[m].volume += Number(t.amount);
    monthlyMap[m].count++;
  });
  const monthly_volume = Object.values(monthlyMap).sort((a, b) => b.month.localeCompare(a.month)).slice(0, 6);
  res.json({
    success: true,
    wallets: wallets.map(w => ({ ...w, balance: Number(w.balance), lockedBalance: Number(w.lockedBalance) })),
    stats: {
      total_transactions: allTx.length,
      total_volume: successTx.reduce((s, t) => s + Number(t.amount), 0),
      unread_notifications: Number(unreadCount?.count ?? 0),
    },
    recent_transactions: recent.map(t => ({ ...t, amount: Number(t.amount) })),
    monthly_volume,
  });
});

export default router;
