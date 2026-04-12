import { Router, type IRouter } from "express";
import { eq, and, desc, count } from "drizzle-orm";
import { db, notificationsTable } from "@workspace/db";
import { requireAuth, type AuthenticatedRequest } from "../middlewares/requireAuth";

const router: IRouter = Router();

router.get("/notifications", requireAuth, async (req: AuthenticatedRequest, res): Promise<void> => {
  const notes = await db.select().from(notificationsTable).where(eq(notificationsTable.userId, req.user!.id)).orderBy(desc(notificationsTable.createdAt)).limit(50);
  const [unreadCount] = await db.select({ count: count() }).from(notificationsTable).where(and(eq(notificationsTable.userId, req.user!.id), eq(notificationsTable.isRead, false)));
  res.json({ success: true, notifications: notes, unread: Number(unreadCount?.count ?? 0) });
});

router.get("/notifications/unread-count", requireAuth, async (req: AuthenticatedRequest, res): Promise<void> => {
  const [unreadCount] = await db.select({ count: count() }).from(notificationsTable).where(and(eq(notificationsTable.userId, req.user!.id), eq(notificationsTable.isRead, false)));
  res.json({ success: true, count: Number(unreadCount?.count ?? 0) });
});

router.put("/notifications/:id/read", requireAuth, async (req: AuthenticatedRequest, res): Promise<void> => {
  const id = parseInt(req.params.id);
  await db.update(notificationsTable).set({ isRead: true }).where(and(eq(notificationsTable.id, id), eq(notificationsTable.userId, req.user!.id)));
  res.json({ success: true });
});

router.put("/notifications/read-all", requireAuth, async (req: AuthenticatedRequest, res): Promise<void> => {
  await db.update(notificationsTable).set({ isRead: true }).where(eq(notificationsTable.userId, req.user!.id));
  res.json({ success: true, message: "All marked as read" });
});

export default router;
