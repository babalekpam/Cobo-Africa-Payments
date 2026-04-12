import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import { db, beneficiariesTable } from "@workspace/db";
import { requireAuth, type AuthenticatedRequest } from "../middlewares/requireAuth";

const router: IRouter = Router();

router.get("/beneficiaries", requireAuth, async (req: AuthenticatedRequest, res): Promise<void> => {
  const bens = await db.select().from(beneficiariesTable).where(eq(beneficiariesTable.userId, req.user!.id));
  res.json({ success: true, beneficiaries: bens });
});

router.post("/beneficiaries", requireAuth, async (req: AuthenticatedRequest, res): Promise<void> => {
  const { name, country, currency, type, account_number, bank_name, phone, provider } = req.body;
  if (!name) { res.status(400).json({ success: false, message: "Name required" }); return; }
  const [ben] = await db.insert(beneficiariesTable).values({
    userId: req.user!.id, name, country: country || "", currency: currency || "USD",
    type: type || "bank", accountNumber: account_number, bankName: bank_name, phone, provider,
  }).returning();
  res.status(201).json({ success: true, beneficiary: ben });
});

router.delete("/beneficiaries/:id", requireAuth, async (req: AuthenticatedRequest, res): Promise<void> => {
  const id = parseInt(req.params.id);
  await db.delete(beneficiariesTable).where(and(eq(beneficiariesTable.id, id), eq(beneficiariesTable.userId, req.user!.id)));
  res.json({ success: true, message: "Removed" });
});

export default router;
