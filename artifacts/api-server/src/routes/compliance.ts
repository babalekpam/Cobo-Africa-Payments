import { Router, type IRouter } from "express";
import { eq, desc, and, gte, sql, count } from "drizzle-orm";
import { db, usersTable, kycDocumentsTable, transactionsTable, auditLogsTable, sanctionsScreeningTable, suspiciousActivityTable, ctrReportsTable, eddReviewsTable } from "@workspace/db";
import { requireAuth, type AuthenticatedRequest } from "../middlewares/requireAuth";
import { screenAgainstOFAC, assessCountryRisk, HIGH_RISK_COUNTRIES, MEDIUM_RISK_COUNTRIES } from "../lib/ofac";

const router: IRouter = Router();

router.post("/compliance/screen", requireAuth, async (req: AuthenticatedRequest, res): Promise<void> => {
  const { name, country, transaction_ref, screen_type } = req.body;
  if (!name) { res.status(400).json({ success: false, message: "Name is required" }); return; }

  const nameResult = screenAgainstOFAC(name);
  const countryRisk = assessCountryRisk(country || "");
  const combinedScore = Math.max(nameResult.riskScore, countryRisk.score);
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
      description: `OFAC/SDN screening flagged: ${name}. Matches: ${nameResult.matches.map(m => `${m.entry} (${m.score}%)`).join(", ")}. Country risk: ${countryRisk.level}`,
      riskLevel: "critical",
      filedBy: null,
    });
  }

  res.json({
    success: true,
    screening: {
      result,
      risk_score: combinedScore,
      matches: nameResult.matches,
      country_risk: countryRisk,
      source: "OFAC SDN + Internal Watchlist",
    },
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
    userId: user_id, transactionRef: transaction_ref || null, reportType: report_type,
    description, riskLevel: risk_level || "medium", filedBy: req.user!.id,
  });
  res.json({ success: true, message: "SAR filed successfully" });
});

router.put("/compliance/sar/:id/resolve", requireAuth, async (req: AuthenticatedRequest, res): Promise<void> => {
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, req.user!.id));
  if (user?.role !== "admin") { res.status(403).json({ success: false, message: "Admin access required" }); return; }
  const { resolution_notes } = req.body;
  await db.update(suspiciousActivityTable).set({
    status: "resolved", resolvedBy: req.user!.id,
    resolutionNotes: resolution_notes || "Reviewed and resolved", resolvedAt: new Date(),
  }).where(eq(suspiciousActivityTable.id, Number(req.params.id)));
  res.json({ success: true, message: "SAR resolved" });
});

router.get("/compliance/kyc-queue", requireAuth, async (req: AuthenticatedRequest, res): Promise<void> => {
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, req.user!.id));
  if (user?.role !== "admin") { res.status(403).json({ success: false, message: "Admin access required" }); return; }
  const pendingDocs = await db.select({
    doc: kycDocumentsTable, userName: usersTable.name, userEmail: usersTable.email,
    userCountry: usersTable.country, kycLevel: usersTable.kycLevel, kycStatus: usersTable.kycStatus,
  }).from(kycDocumentsTable)
    .leftJoin(usersTable, eq(kycDocumentsTable.userId, usersTable.id))
    .where(eq(kycDocumentsTable.status, "pending"))
    .orderBy(kycDocumentsTable.createdAt);
  res.json({
    success: true,
    queue: pendingDocs.map(d => ({ ...d.doc, user_name: d.userName, user_email: d.userEmail, user_country: d.userCountry, kyc_level: d.kycLevel, kyc_status: d.kycStatus })),
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
    await db.insert(auditLogsTable).values({ userId: req.user!.id, action: "kyc_approve", ip: req.ip || "unknown", meta: { doc_id: docId, target_user: doc.userId, new_level: level } });
  } else if (action === "reject") {
    await db.update(kycDocumentsTable).set({ status: "rejected", rejectionReason: rejection_reason || "Does not meet requirements" }).where(eq(kycDocumentsTable.id, docId));
    await db.update(usersTable).set({ kycStatus: "rejected" }).where(eq(usersTable.id, doc.userId));
    await db.insert(auditLogsTable).values({ userId: req.user!.id, action: "kyc_reject", ip: req.ip || "unknown", meta: { doc_id: docId, target_user: doc.userId, reason: rejection_reason } });
  } else { res.status(400).json({ success: false, message: "action must be 'approve' or 'reject'" }); return; }
  res.json({ success: true, message: `Document ${action}d` });
});

router.get("/compliance/ctr", requireAuth, async (req: AuthenticatedRequest, res): Promise<void> => {
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, req.user!.id));
  if (user?.role !== "admin") { res.status(403).json({ success: false, message: "Admin access required" }); return; }
  const status = req.query.status as string || undefined;
  const reports = await db.select({
    ctr: ctrReportsTable,
    userName: usersTable.name,
    userEmail: usersTable.email,
  }).from(ctrReportsTable)
    .leftJoin(usersTable, eq(ctrReportsTable.userId, usersTable.id))
    .orderBy(desc(ctrReportsTable.createdAt)).limit(200);
  const filtered = status ? reports.filter(r => r.ctr.filingStatus === status) : reports;
  res.json({ success: true, reports: filtered.map(r => ({ ...r.ctr, amount: Number(r.ctr.amount), amountUsd: Number(r.ctr.amountUsd), aggregateTotal: r.ctr.aggregateTotal ? Number(r.ctr.aggregateTotal) : null, user_name: r.userName, user_email: r.userEmail })) });
});

router.post("/compliance/ctr/:id/file", requireAuth, async (req: AuthenticatedRequest, res): Promise<void> => {
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, req.user!.id));
  if (user?.role !== "admin") { res.status(403).json({ success: false, message: "Admin access required" }); return; }
  const { notes } = req.body;
  await db.update(ctrReportsTable).set({
    filingStatus: "filed", filedBy: req.user!.id, filedAt: new Date(), notes: notes || "Filed with FinCEN",
  }).where(eq(ctrReportsTable.id, Number(req.params.id)));
  res.json({ success: true, message: "CTR marked as filed" });
});

router.get("/compliance/edd", requireAuth, async (req: AuthenticatedRequest, res): Promise<void> => {
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, req.user!.id));
  if (user?.role !== "admin") { res.status(403).json({ success: false, message: "Admin access required" }); return; }
  const reviews = await db.select({
    edd: eddReviewsTable,
    userName: usersTable.name,
    userEmail: usersTable.email,
    userCountry: usersTable.country,
  }).from(eddReviewsTable)
    .leftJoin(usersTable, eq(eddReviewsTable.userId, usersTable.id))
    .orderBy(desc(eddReviewsTable.createdAt)).limit(200);
  res.json({ success: true, reviews: reviews.map(r => ({ ...r.edd, user_name: r.userName, user_email: r.userEmail, user_country: r.userCountry })) });
});

router.post("/compliance/edd", requireAuth, async (req: AuthenticatedRequest, res): Promise<void> => {
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, req.user!.id));
  if (user?.role !== "admin") { res.status(403).json({ success: false, message: "Admin access required" }); return; }
  const { user_id, trigger_reason, risk_level, source_of_funds, expected_volume, business_purpose, pep_status, review_notes } = req.body;
  if (!user_id || !trigger_reason) { res.status(400).json({ success: false, message: "user_id and trigger_reason required" }); return; }
  await db.insert(eddReviewsTable).values({
    userId: user_id, triggerReason: trigger_reason, riskLevel: risk_level || "high",
    sourceOfFunds: source_of_funds, expectedVolume: expected_volume, businessPurpose: business_purpose,
    pepStatus: pep_status || "no", reviewNotes: review_notes,
  });
  res.json({ success: true, message: "EDD review created" });
});

router.put("/compliance/edd/:id/complete", requireAuth, async (req: AuthenticatedRequest, res): Promise<void> => {
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, req.user!.id));
  if (user?.role !== "admin") { res.status(403).json({ success: false, message: "Admin access required" }); return; }
  const { review_notes, status: eddStatus } = req.body;
  await db.update(eddReviewsTable).set({
    status: eddStatus || "completed", reviewedBy: req.user!.id, reviewedAt: new Date(),
    reviewNotes: review_notes || "Review completed",
  }).where(eq(eddReviewsTable.id, Number(req.params.id)));
  res.json({ success: true, message: "EDD review completed" });
});

router.get("/compliance/overview", requireAuth, async (req: AuthenticatedRequest, res): Promise<void> => {
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, req.user!.id));
  if (user?.role !== "admin") { res.status(403).json({ success: false, message: "Admin access required" }); return; }
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const [screeningsToday] = await db.select({ count: count() }).from(sanctionsScreeningTable).where(gte(sanctionsScreeningTable.createdAt, today));
  const [pendingCtrs] = await db.select({ count: count() }).from(ctrReportsTable).where(eq(ctrReportsTable.filingStatus, "pending"));
  const [openSars] = await db.select({ count: count() }).from(suspiciousActivityTable).where(eq(suspiciousActivityTable.status, "open"));
  const [pendingKyc] = await db.select({ count: count() }).from(kycDocumentsTable).where(eq(kycDocumentsTable.status, "pending"));
  const [pendingEdd] = await db.select({ count: count() }).from(eddReviewsTable).where(eq(eddReviewsTable.status, "pending"));
  res.json({
    success: true,
    screeningsToday: screeningsToday.count,
    pendingCtrs: pendingCtrs.count,
    openSars: openSars.count,
    pendingKyc: pendingKyc.count,
    pendingEdd: pendingEdd.count,
  });
});

router.post("/compliance/kyc/:userId/review", requireAuth, async (req: AuthenticatedRequest, res): Promise<void> => {
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, req.user!.id));
  if (user?.role !== "admin") { res.status(403).json({ success: false, message: "Admin access required" }); return; }
  const targetUserId = Number(req.params.userId);
  const { action, level, reason } = req.body;

  const [targetUser] = await db.select().from(usersTable).where(eq(usersTable.id, targetUserId));
  if (!targetUser) { res.status(404).json({ success: false, message: "User not found" }); return; }

  if (action === "approve") {
    const newLevel = level !== undefined ? String(level) : String(Math.min((Number(targetUser.kycLevel) || 0) + 1, 2));
    await db.update(usersTable).set({ kycStatus: "verified", kycLevel: newLevel }).where(eq(usersTable.id, targetUserId));
    await db.update(kycDocumentsTable).set({ status: "approved" }).where(and(eq(kycDocumentsTable.userId, targetUserId), eq(kycDocumentsTable.status, "pending")));
    await db.insert(auditLogsTable).values({ userId: req.user!.id, action: "kyc_approve_user", ip: req.ip || "unknown", meta: { target_user: targetUserId, new_level: newLevel } });
    res.json({ success: true, message: `User KYC approved at level ${newLevel}` });
  } else if (action === "reject") {
    await db.update(usersTable).set({ kycStatus: "rejected" }).where(eq(usersTable.id, targetUserId));
    await db.update(kycDocumentsTable).set({ status: "rejected", rejectionReason: reason || "Documents insufficient" }).where(and(eq(kycDocumentsTable.userId, targetUserId), eq(kycDocumentsTable.status, "pending")));
    await db.insert(auditLogsTable).values({ userId: req.user!.id, action: "kyc_reject_user", ip: req.ip || "unknown", meta: { target_user: targetUserId, reason } });
    res.json({ success: true, message: "User KYC rejected" });
  } else {
    res.status(400).json({ success: false, message: "action must be 'approve' or 'reject'" });
  }
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
  const [pendingCTR] = await db.select({ count: count() }).from(ctrReportsTable).where(eq(ctrReportsTable.filingStatus, "pending"));
  const [totalCTR] = await db.select({ count: count() }).from(ctrReportsTable);
  const [pendingEDD] = await db.select({ count: count() }).from(eddReviewsTable).where(eq(eddReviewsTable.status, "pending"));
  const [totalEDD] = await db.select({ count: count() }).from(eddReviewsTable);
  const kycByLevel = await db.select({ level: usersTable.kycLevel, count: count() }).from(usersTable).groupBy(usersTable.kycLevel);

  res.json({
    success: true,
    stats: {
      screenings: { total: totalScreenings.count, flagged: flaggedScreenings.count, recent_30d: recentScreenings.count },
      sar: { open: openSARs.count, total: totalSARs.count },
      kyc: { pending_docs: pendingKYC.count, verified_users: verifiedUsers.count, total_users: totalUsers.count, by_level: kycByLevel },
      ctr: { pending: pendingCTR.count, total: totalCTR.count },
      edd: { pending: pendingEDD.count, total: totalEDD.count },
    },
  });
});

export default router;
