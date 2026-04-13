import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import { db, kycDocumentsTable, usersTable, notificationsTable } from "@workspace/db";
import { requireAuth, type AuthenticatedRequest } from "../middlewares/requireAuth";
import { ObjectStorageService } from "../lib/objectStorage";

const router: IRouter = Router();

let storageService: ObjectStorageService | null = null;
try { storageService = new ObjectStorageService(); } catch {}

router.get("/kyc/status", requireAuth, async (req: AuthenticatedRequest, res): Promise<void> => {
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, req.user!.id));
  const docs = await db.select().from(kycDocumentsTable).where(eq(kycDocumentsTable.userId, req.user!.id));
  res.json({ success: true, kyc_status: user?.kycStatus, kyc_level: Number(user?.kycLevel || 0), documents: docs.map(d => ({ ...d, documentType: d.docType, documentNumber: d.docUrl })) });
});

router.get("/kyc/documents", requireAuth, async (req: AuthenticatedRequest, res): Promise<void> => {
  const docs = await db.select().from(kycDocumentsTable).where(eq(kycDocumentsTable.userId, req.user!.id));
  res.json({ success: true, documents: docs.map(d => ({ ...d, documentType: d.docType, documentNumber: d.docUrl })) });
});

router.post("/kyc/upload-url", requireAuth, async (req: AuthenticatedRequest, res): Promise<void> => {
  if (!storageService) {
    res.status(503).json({ success: false, message: "File storage not available" });
    return;
  }
  try {
    const uploadURL = await storageService.getObjectEntityUploadURL();
    const objectPath = storageService.normalizeObjectEntityPath(uploadURL);
    res.json({ success: true, uploadURL, objectPath });
  } catch (err: any) {
    console.error("[KYC] Upload URL error:", err.message);
    res.status(500).json({ success: false, message: "Failed to generate upload URL" });
  }
});

router.post("/kyc/submit", requireAuth, async (req: AuthenticatedRequest, res): Promise<void> => {
  const { document_type, document_number, doc_type, doc_url, file_path } = req.body;
  const docType = document_type || doc_type;
  const docValue = document_number || doc_url;
  if (!docType) { res.status(400).json({ success: false, message: "Document type required" }); return; }
  if (!docValue && !file_path) { res.status(400).json({ success: false, message: "Document number or file upload required" }); return; }

  if (file_path && (typeof file_path !== "string" || !file_path.startsWith("/objects/"))) {
    res.status(400).json({ success: false, message: "Invalid file path" });
    return;
  }

  const docRef = file_path ? `file:${file_path}|${docValue || "uploaded"}` : docValue;

  const existing = await db.select().from(kycDocumentsTable).where(and(eq(kycDocumentsTable.userId, req.user!.id), eq(kycDocumentsTable.docType, docType)));
  if (existing.length > 0) {
    await db.update(kycDocumentsTable).set({ docUrl: docRef, status: "pending" }).where(eq(kycDocumentsTable.id, existing[0].id));
  } else {
    await db.insert(kycDocumentsTable).values({ userId: req.user!.id, docType, docUrl: docRef });
  }
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, req.user!.id));
  if (user?.kycStatus === "pending" || user?.kycStatus === "unverified") {
    await db.update(usersTable).set({ kycStatus: "submitted" }).where(eq(usersTable.id, req.user!.id));
  }

  await db.insert(notificationsTable).values({
    userId: req.user!.id,
    title: "KYC Document Submitted",
    message: `Your ${docType.replace(/_/g, " ")} document has been submitted for review.`,
    type: "info",
  });

  res.json({ success: true, message: "Document submitted for review" });
});

export default router;
