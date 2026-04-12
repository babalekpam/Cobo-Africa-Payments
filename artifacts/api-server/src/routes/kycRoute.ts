import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import { db, kycDocumentsTable, usersTable } from "@workspace/db";
import { requireAuth, type AuthenticatedRequest } from "../middlewares/requireAuth";

const router: IRouter = Router();

router.get("/kyc/status", requireAuth, async (req: AuthenticatedRequest, res): Promise<void> => {
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, req.user!.id));
  const docs = await db.select().from(kycDocumentsTable).where(eq(kycDocumentsTable.userId, req.user!.id));
  res.json({ success: true, kyc_status: user?.kycStatus, kyc_level: Number(user?.kycLevel || 0), documents: docs.map(d => ({ ...d, documentType: d.docType, documentNumber: d.docUrl })) });
});

router.get("/kyc/documents", requireAuth, async (req: AuthenticatedRequest, res): Promise<void> => {
  const docs = await db.select().from(kycDocumentsTable).where(eq(kycDocumentsTable.userId, req.user!.id));
  res.json({ success: true, documents: docs.map(d => ({ ...d, documentType: d.docType, documentNumber: d.docUrl })) });
});

router.post("/kyc/submit", requireAuth, async (req: AuthenticatedRequest, res): Promise<void> => {
  const { document_type, document_number, doc_type, doc_url } = req.body;
  const docType = document_type || doc_type;
  const docValue = document_number || doc_url;
  if (!docType || !docValue) { res.status(400).json({ success: false, message: "Document type and number required" }); return; }
  const existing = await db.select().from(kycDocumentsTable).where(and(eq(kycDocumentsTable.userId, req.user!.id), eq(kycDocumentsTable.docType, docType)));
  if (existing.length > 0) {
    await db.update(kycDocumentsTable).set({ docUrl: docValue, status: "pending" }).where(eq(kycDocumentsTable.id, existing[0].id));
  } else {
    await db.insert(kycDocumentsTable).values({ userId: req.user!.id, docType, docUrl: docValue });
  }
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, req.user!.id));
  if (user?.kycStatus === "pending" || user?.kycStatus === "unverified") {
    await db.update(usersTable).set({ kycStatus: "submitted" }).where(eq(usersTable.id, req.user!.id));
  }
  res.json({ success: true, message: "Document submitted for review" });
});

export default router;
