import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import { db, paymentLinksTable } from "@workspace/db";
import { requireAuth, type AuthenticatedRequest } from "../middlewares/requireAuth";

const router: IRouter = Router();

router.get("/payment-links", requireAuth, async (req: AuthenticatedRequest, res): Promise<void> => {
  const links = await db.select().from(paymentLinksTable).where(eq(paymentLinksTable.userId, req.user!.id));
  res.json({ success: true, payment_links: links.map(l => ({ ...l, amount: l.amount ? Number(l.amount) : null, totalCollected: Number(l.totalCollected) })) });
});

router.post("/payment-links", requireAuth, async (req: AuthenticatedRequest, res): Promise<void> => {
  const { title, description, currency, amount, is_fixed_amount, redirect_url } = req.body;
  if (!title) { res.status(400).json({ success: false, message: "Title required" }); return; }
  const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") + "-" + Math.random().toString(36).slice(2, 7);
  const [link] = await db.insert(paymentLinksTable).values({
    userId: req.user!.id, title, slug, description, currency: currency || "USD",
    amount: amount ? String(amount) : null, isFixedAmount: is_fixed_amount ?? true,
    redirectUrl: redirect_url,
  }).returning();
  res.status(201).json({ success: true, payment_link: { ...link, amount: link.amount ? Number(link.amount) : null, totalCollected: Number(link.totalCollected) } });
});

router.delete("/payment-links/:id", requireAuth, async (req: AuthenticatedRequest, res): Promise<void> => {
  const id = parseInt(req.params.id);
  await db.delete(paymentLinksTable).where(and(eq(paymentLinksTable.id, id), eq(paymentLinksTable.userId, req.user!.id)));
  res.json({ success: true, message: "Deleted" });
});

router.patch("/payment-links/:id/toggle", requireAuth, async (req: AuthenticatedRequest, res): Promise<void> => {
  const id = parseInt(req.params.id);
  const [link] = await db.select().from(paymentLinksTable).where(and(eq(paymentLinksTable.id, id), eq(paymentLinksTable.userId, req.user!.id)));
  if (!link) { res.status(404).json({ success: false, message: "Not found" }); return; }
  await db.update(paymentLinksTable).set({ isActive: !link.isActive }).where(eq(paymentLinksTable.id, id));
  res.json({ success: true, message: link.isActive ? "Deactivated" : "Activated" });
});

export default router;
