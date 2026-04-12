import { Router, type IRouter } from "express";
import { eq, desc, and, gte, sql, count } from "drizzle-orm";
import { db, usersTable, kycDocumentsTable, transactionsTable, auditLogsTable, sanctionsScreeningTable, suspiciousActivityTable } from "@workspace/db";
import { requireAuth, type AuthenticatedRequest } from "../middlewares/requireAuth";

const router: IRouter = Router();

const SANCTIONED_NAMES = [
  "OSAMA BIN LADEN", "AL QAEDA", "ISIS", "BOKO HARAM", "AL SHABAAB",
  "HEZBOLLAH", "HAMAS MILITARY", "TALIBAN", "ISLAMIC STATE",
  "DAESH", "JEMAAH ISLAMIYAH", "LASHKAR E TAIBA",
];

const HIGH_RISK_COUNTRIES = ["KP", "IR", "SY", "CU", "VE", "MM", "BY", "RU"];

function screenName(name: string): { clear: boolean; matches: string[]; riskScore: number } {
  const upper = (name || "").toUpperCase().trim();
  const matches: string[] = [];
  let riskScore = 0;

  for (const sanctioned of SANCTIONED_NAMES) {
    if (upper.includes(sanctioned) || sanctioned.includes(upper)) {
      matches.push(sanctioned);
      riskScore = 100;
    }
  }

  const words = upper.split(/\s+/);
  for (const sanctioned of SANCTIONED_NAMES) {
    const sWords = sanctioned.split(/\s+/);
    const overlap = words.filter(w => sWords.includes(w) && w.length > 2);
    if (overlap.length >= 2 && !matches.includes(sanctioned)) {
      matches.push(sanctioned + " (partial)");
      riskScore = Math.max(riskScore, 60);
    }
  }

  return { clear: matches.length === 0, matches, riskScore };
}

function assessCountryRisk(countryCode: string): number {
  if (HIGH_RISK_COUNTRIES.includes(countryCode?.toUpperCase())) return 80;
  return 0;
}

router.post("/compliance/screen", requireAuth, async (req: AuthenticatedRequest, res): Promise<void> => {
  const { name, country, transaction_ref, screen_type } = req.body;
  if (!name) { res.status(400).json({ success: false, message: "Name is required" }); return; }

  const nameResult = screenName(name);
  const countryRisk = assessCountryRisk(country || "");
  const combinedScore = Math.max(nameResult.riskScore, countryRisk);
  const result = combinedScore >= 80 ? "flagged" : combinedScore >= 40 ? "review" : "clear";

  await db.insert(sanctionsScreeningTable).values({
    userId: req.user!.id,
    transactionRef: transaction_ref || null,
    screenedName: name,
    screenType: screen_type || "transfer",
    result,
    matchDetails: nameResult.matches.length > 0 ? JSON.stringify(nameResult.matches) : null,
    riskScore: combinedScore,
  });

  if (result === "flagged") {
    await db.insert(suspiciousActivityTable).values({
      userId: req.user!.id,
      transactionRef: transaction_ref || null,
      reportType: "sanctions_match",
      description: `Sanctions screening flagged: ${name}. Matches: ${nameResult.matches.join(", ")}. Country risk: ${countryRisk}`,
      riskLevel: "critical",
      filedBy: null,
    });
  }

  res.json({
    success: true,
    screening: { result, risk_score: combinedScore, matches: nameResult.matches, country_risk: countryRisk > 0 ? "high" : "normal" },
  });
});

router.get("/compliance/screening-log", requireAuth, async (req: AuthenticatedRequest, res): Promise<void> => {
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, req.user!.id));
  if (user?.role !== "admin") { res.status(403).json({ success: false, message: "Admin access required" }); return; }

  const logs = await db.select().from(sanctionsScreeningTable).orderBy(desc(sanctionsScreeningTable.createdAt)).limit(200);
  res.json({ success: true, screenings: logs });
});

router.get("/compliance/sar", requireAuth, async (req: AuthenticatedRequest, res): Promise<void> => {
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, req.user!.id));
  if (user?.role !== "admin") { res.status(403).json({ success: false, message: "Admin access required" }); return; }

  const reports = await db.select({
    report: suspiciousActivityTable,
    userName: usersTable.name,
    userEmail: usersTable.email,
  }).from(suspiciousActivityTable)
    .leftJoin(usersTable, eq(suspiciousActivityTable.userId, usersTable.id))
    .orderBy(desc(suspiciousActivityTable.createdAt)).limit(200);

  res.json({ success: true, reports: reports.map(r => ({ ...r.report, user_name: r.userName, user_email: r.userEmail })) });
});

router.post("/compliance/sar", requireAuth, async (req: AuthenticatedRequest, res): Promise<void> => {
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, req.user!.id));
  if (user?.role !== "admin") { res.status(403).json({ success: false, message: "Admin access required" }); return; }

  const { user_id, transaction_ref, report_type, description, risk_level } = req.body;
  if (!user_id || !report_type || !description) { res.status(400).json({ success: false, message: "user_id, report_type and description required" }); return; }

  await db.insert(suspiciousActivityTable).values({
    userId: user_id,
    transactionRef: transaction_ref || null,
    reportType: report_type,
    description,
    riskLevel: risk_level || "medium",
    filedBy: req.user!.id,
  });

  res.json({ success: true, message: "SAR filed successfully" });
});

router.put("/compliance/sar/:id/resolve", requireAuth, async (req: AuthenticatedRequest, res): Promise<void> => {
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, req.user!.id));
  if (user?.role !== "admin") { res.status(403).json({ success: false, message: "Admin access required" }); return; }

  const { resolution_notes } = req.body;
  await db.update(suspiciousActivityTable).set({
    status: "resolved",
    resolvedBy: req.user!.id,
    resolutionNotes: resolution_notes || "Reviewed and resolved",
    resolvedAt: new Date(),
  }).where(eq(suspiciousActivityTable.id, Number(req.params.id)));

  res.json({ success: true, message: "SAR resolved" });
});

router.get("/compliance/kyc-queue", requireAuth, async (req: AuthenticatedRequest, res): Promise<void> => {
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, req.user!.id));
  if (user?.role !== "admin") { res.status(403).json({ success: false, message: "Admin access required" }); return; }

  const pendingDocs = await db.select({
    doc: kycDocumentsTable,
    userName: usersTable.name,
    userEmail: usersTable.email,
    userCountry: usersTable.country,
    kycLevel: usersTable.kycLevel,
    kycStatus: usersTable.kycStatus,
  }).from(kycDocumentsTable)
    .leftJoin(usersTable, eq(kycDocumentsTable.userId, usersTable.id))
    .where(eq(kycDocumentsTable.status, "pending"))
    .orderBy(kycDocumentsTable.createdAt);

  res.json({
    success: true,
    queue: pendingDocs.map(d => ({
      ...d.doc,
      user_name: d.userName,
      user_email: d.userEmail,
      user_country: d.userCountry,
      kyc_level: d.kycLevel,
      kyc_status: d.kycStatus,
    })),
  });
});

router.put("/compliance/kyc/:docId/review", requireAuth, async (req: AuthenticatedRequest, res): Promise<void> => {
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, req.user!.id));
  if (user?.role !== "admin") { res.status(403).json({ success: false, message: "Admin access required" }); return; }

  const { action, rejection_reason, new_kyc_level } = req.body;
  const docId = Number(req.params.docId);

  const [doc] = await db.select().from(kycDocumentsTable).where(eq(kycDocumentsTable.id, docId));
  if (!doc) { res.status(404).json({ success: false, message: "Document not found" }); return; }

  if (action === "approve") {
    await db.update(kycDocumentsTable).set({ status: "approved" }).where(eq(kycDocumentsTable.id, docId));
    const level = new_kyc_level !== undefined ? String(new_kyc_level) : undefined;
    const updateData: any = { kycStatus: "verified" };
    if (level) updateData.kycLevel = level;
    await db.update(usersTable).set(updateData).where(eq(usersTable.id, doc.userId));
    await db.insert(auditLogsTable).values({
      userId: req.user!.id, action: "kyc_approve",
      ip: req.ip || "unknown",
      meta: { doc_id: docId, target_user: doc.userId, new_level: level },
    });
  } else if (action === "reject") {
    await db.update(kycDocumentsTable).set({ status: "rejected", rejectionReason: rejection_reason || "Does not meet requirements" }).where(eq(kycDocumentsTable.id, docId));
    await db.update(usersTable).set({ kycStatus: "rejected" }).where(eq(usersTable.id, doc.userId));
    await db.insert(auditLogsTable).values({
      userId: req.user!.id, action: "kyc_reject",
      ip: req.ip || "unknown",
      meta: { doc_id: docId, target_user: doc.userId, reason: rejection_reason },
    });
  } else {
    res.status(400).json({ success: false, message: "action must be 'approve' or 'reject'" }); return;
  }

  res.json({ success: true, message: `Document ${action}d` });
});

router.get("/compliance/stats", requireAuth, async (req: AuthenticatedRequest, res): Promise<void> => {
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, req.user!.id));
  if (user?.role !== "admin") { res.status(403).json({ success: false, message: "Admin access required" }); return; }

  const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000);

  const [totalScreenings] = await db.select({ count: count() }).from(sanctionsScreeningTable);
  const [flaggedScreenings] = await db.select({ count: count() }).from(sanctionsScreeningTable).where(eq(sanctionsScreeningTable.result, "flagged"));
  const [recentScreenings] = await db.select({ count: count() }).from(sanctionsScreeningTable).where(gte(sanctionsScreeningTable.createdAt, thirtyDaysAgo));
  const [openSARs] = await db.select({ count: count() }).from(suspiciousActivityTable).where(eq(suspiciousActivityTable.status, "open"));
  const [totalSARs] = await db.select({ count: count() }).from(suspiciousActivityTable);
  const [pendingKYC] = await db.select({ count: count() }).from(kycDocumentsTable).where(eq(kycDocumentsTable.status, "pending"));
  const [verifiedUsers] = await db.select({ count: count() }).from(usersTable).where(eq(usersTable.kycStatus, "verified"));
  const [totalUsers] = await db.select({ count: count() }).from(usersTable);

  const kycByLevel = await db.select({
    level: usersTable.kycLevel,
    count: count(),
  }).from(usersTable).groupBy(usersTable.kycLevel);

  res.json({
    success: true,
    stats: {
      screenings: { total: totalScreenings.count, flagged: flaggedScreenings.count, recent_30d: recentScreenings.count },
      sar: { open: openSARs.count, total: totalSARs.count },
      kyc: { pending_docs: pendingKYC.count, verified_users: verifiedUsers.count, total_users: totalUsers.count, by_level: kycByLevel },
    },
  });
});

export default router;
