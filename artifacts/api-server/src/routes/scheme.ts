// Afrix — Pan-African Instant Payment Scheme API.
// Alias directory (Afrix Keys), instant payments through the switch,
// AfrixQR generation/decoding, participant registry, and settlement operations.

import { Router, type IRouter } from "express";
import QRCode from "qrcode";
import { eq, or, desc, and } from "drizzle-orm";
import {
  db,
  usersTable,
  schemeParticipantsTable,
  schemeTransfersTable,
  settlementBatchesTable,
  schemeDisputesTable,
  notificationsTable,
} from "@workspace/db";
import type { NextFunction, Response } from "express";
import { requireAuth, type AuthenticatedRequest } from "../middlewares/requireAuth.js";
import { idempotencyMiddleware } from "../middlewares/idempotency.js";
import { directoryLookupRateLimit, transferRateLimit } from "../middlewares/rateLimit.js";
import {
  registerAlias,
  verifyAlias,
  listUserAliases,
  deleteAlias,
  resolveAlias,
  getHomeParticipant,
  ALIAS_TYPES,
} from "../services/scheme/directory.js";
import { sendSms } from "../services/sms.js";
import { emailService } from "../services/email.js";
import { processInstantPayment } from "../services/scheme/switchEngine.js";
import { returnSchemeTransfer } from "../services/scheme/returns.js";
import { closeSettlementCycle, getBatchPositions } from "../services/scheme/settlement.js";
import { encodeAfriQr, decodeAfriQr } from "../services/scheme/qrStandard.js";

const router: IRouter = Router();

async function requireAdmin(req: AuthenticatedRequest): Promise<boolean> {
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, req.user!.id));
  return user?.role === "admin";
}

// Scope idempotency keys per authenticated user so one client's key can never
// replay another user's cached response. Accepts the key from the Idempotency-Key
// header or, for clients that can't set headers, an idempotency_key body field.
// Runs after requireAuth.
function scopeIdempotencyKey(req: AuthenticatedRequest, _res: Response, next: NextFunction): void {
  const headerKey = req.headers["idempotency-key"];
  const bodyKey = (req.body as Record<string, unknown> | undefined)?.idempotency_key;
  const key = typeof headerKey === "string" && headerKey ? headerKey : typeof bodyKey === "string" ? bodyKey : "";
  if (key) {
    req.headers["idempotency-key"] = `afrix:${req.user!.id}:${key}`;
  }
  next();
}

// ---------- Afrix Keys (alias directory) ----------

router.get("/scheme/aliases", requireAuth, async (req: AuthenticatedRequest, res): Promise<void> => {
  const aliases = await listUserAliases(req.user!.id);
  res.json({ success: true, aliases, max: 5, types: ALIAS_TYPES });
});

router.post("/scheme/aliases", requireAuth, async (req: AuthenticatedRequest, res): Promise<void> => {
  const { alias_type, alias_value, currency } = req.body as Record<string, string>;
  const result = await registerAlias(req.user!.id, alias_type, alias_value || "", currency || "USD");
  if (!result.ok) {
    res.status(result.status).json({ success: false, message: result.message });
    return;
  }

  const alias = result.alias!;
  if (result.otp) {
    // Prove ownership: the code goes to the claimed phone/email itself,
    // never to the registrant's session.
    if (alias.aliasType === "phone") {
      sendSms(alias.aliasValue, `${result.otp} is your Afrix key verification code. Expires in 15 minutes.`).catch(() => {});
    } else if (alias.aliasType === "email") {
      emailService.sendKeyVerificationEmail(alias.aliasValue, result.otp).catch(() => {});
    }
    res.status(201).json({
      success: true,
      message: `Verification code sent to ${alias.aliasValue}. Enter it to activate the key.`,
      alias,
      requires_verification: true,
      // Sandbox convenience only — never exposed in production
      ...(process.env.NODE_ENV !== "production" ? { dev_code: result.otp } : {}),
    });
    return;
  }

  res.status(201).json({ success: true, message: "Afrix key registered and live", alias, requires_verification: false });
});

router.post("/scheme/aliases/:id/verify", requireAuth, async (req: AuthenticatedRequest, res): Promise<void> => {
  const { code } = req.body as Record<string, string>;
  const result = await verifyAlias(req.user!.id, Number(req.params.id), code || "");
  res.status(result.status).json({ success: result.ok, message: result.message, alias: result.alias });
});

router.delete("/scheme/aliases/:id", requireAuth, async (req: AuthenticatedRequest, res): Promise<void> => {
  const ok = await deleteAlias(req.user!.id, Number(req.params.id));
  if (!ok) {
    res.status(404).json({ success: false, message: "Key not found" });
    return;
  }
  res.json({ success: true, message: "Afrix key removed" });
});

// Directory lookup — returns masked holder info, like Pix's pre-payment confirmation
// screen. Rate-limited so the directory can't be scraped by key enumeration.
router.get("/scheme/resolve", directoryLookupRateLimit, requireAuth, async (req: AuthenticatedRequest, res): Promise<void> => {
  const key = String(req.query.key || "");
  const resolved = await resolveAlias(key);
  if (!resolved) {
    res.status(404).json({ success: false, message: "Afrix key not found in the network directory" });
    return;
  }
  res.json({
    success: true,
    holder_name: resolved.holderName,
    alias_type: resolved.alias.aliasType,
    currency: resolved.alias.currency,
    institution: { code: resolved.participant.code, name: resolved.participant.name, country: resolved.participant.country, type: resolved.participant.type },
  });
});

// ---------- Instant payments (the switch) ----------

router.post("/scheme/pay", transferRateLimit, requireAuth, scopeIdempotencyKey, idempotencyMiddleware, async (req: AuthenticatedRequest, res): Promise<void> => {
  const { key, alias, amount, currency, wallet_id, description, qr_ref } = req.body as Record<string, string>;
  const result = await processInstantPayment({
    senderUserId: req.user!.id,
    senderEmail: req.user!.email,
    alias: key || alias || "",
    amount: Number(amount),
    currency: currency || undefined,
    walletId: wallet_id ? Number(wallet_id) : undefined,
    description: description || undefined,
    qrRef: qr_ref || undefined,
  });

  if (!result.ok) {
    res.status(result.status).json({ success: false, message: result.message, code: result.code });
    return;
  }

  res.json({
    success: true,
    message: result.message,
    reference: result.transfer!.reference,
    end_to_end_id: result.transfer!.endToEndId,
    status: result.transfer!.status,
    recipient_name: result.recipientName,
    recipient_amount: result.recipientAmount,
    recipient_currency: result.recipientCurrency,
    fx_rate: result.fxRate,
    fee: 0,
  });
});

router.get("/scheme/transfers", requireAuth, async (req: AuthenticatedRequest, res): Promise<void> => {
  const transfers = await db
    .select()
    .from(schemeTransfersTable)
    .where(or(eq(schemeTransfersTable.senderUserId, req.user!.id), eq(schemeTransfersTable.recipientUserId, req.user!.id)))
    .orderBy(desc(schemeTransfersTable.initiatedAt))
    .limit(50);
  res.json({ success: true, transfers });
});

router.get("/scheme/transfers/:reference", requireAuth, async (req: AuthenticatedRequest, res): Promise<void> => {
  const [transfer] = await db
    .select()
    .from(schemeTransfersTable)
    .where(
      and(
        eq(schemeTransfersTable.reference, req.params.reference),
        or(eq(schemeTransfersTable.senderUserId, req.user!.id), eq(schemeTransfersTable.recipientUserId, req.user!.id))
      )
    );
  if (!transfer) {
    res.status(404).json({ success: false, message: "Transfer not found" });
    return;
  }
  res.json({ success: true, transfer });
});

// ---------- Returns & disputes (Pix devolução + MED equivalent) ----------

// Voluntary return by the recipient — money flows back along the original path
router.post("/scheme/transfers/:reference/return", requireAuth, async (req: AuthenticatedRequest, res): Promise<void> => {
  const { reason } = req.body as Record<string, string>;
  const result = await returnSchemeTransfer(req.params.reference, req.user!.id, reason || "Returned by recipient", "recipient");
  if (!result.ok) {
    res.status(result.status).json({ success: false, message: result.message });
    return;
  }
  res.json({ success: true, message: result.message, return_reference: result.returnTransfer!.reference });
});

// Sender opens a dispute (fraud/error claim) for scheme-operator review
router.post("/scheme/transfers/:reference/dispute", requireAuth, async (req: AuthenticatedRequest, res): Promise<void> => {
  const { reason, description } = req.body as Record<string, string>;
  const validReasons = ["fraud", "error", "duplicate", "other"];
  if (!validReasons.includes(reason)) {
    res.status(400).json({ success: false, message: `Reason must be one of: ${validReasons.join(", ")}` });
    return;
  }
  const [transfer] = await db.select().from(schemeTransfersTable).where(eq(schemeTransfersTable.reference, req.params.reference));
  if (!transfer || transfer.senderUserId !== req.user!.id) {
    res.status(404).json({ success: false, message: "Transfer not found (only the sender can dispute a payment)" });
    return;
  }
  if (transfer.status === "returned") {
    res.status(409).json({ success: false, message: "This payment was already returned" });
    return;
  }
  const [existing] = await db
    .select()
    .from(schemeDisputesTable)
    .where(and(eq(schemeDisputesTable.transferReference, transfer.reference), eq(schemeDisputesTable.status, "open")));
  if (existing) {
    res.status(409).json({ success: false, message: "A dispute is already open for this payment" });
    return;
  }
  const [dispute] = await db
    .insert(schemeDisputesTable)
    .values({ transferReference: transfer.reference, openedByUserId: req.user!.id, reason, description: description || null })
    .returning();
  res.status(201).json({ success: true, message: "Dispute opened — the scheme operator will review it", dispute });
});

// Own disputes; admins can pass ?all=1 to see the whole queue
router.get("/scheme/disputes", requireAuth, async (req: AuthenticatedRequest, res): Promise<void> => {
  if (req.query.all && (await requireAdmin(req))) {
    const disputes = await db.select().from(schemeDisputesTable).orderBy(desc(schemeDisputesTable.createdAt)).limit(100);
    res.json({ success: true, disputes });
    return;
  }
  const disputes = await db
    .select()
    .from(schemeDisputesTable)
    .where(eq(schemeDisputesTable.openedByUserId, req.user!.id))
    .orderBy(desc(schemeDisputesTable.createdAt))
    .limit(50);
  res.json({ success: true, disputes });
});

// Scheme operator resolves: refund forces a return along the original path
router.post("/scheme/disputes/:id/resolve", requireAuth, async (req: AuthenticatedRequest, res): Promise<void> => {
  if (!(await requireAdmin(req))) { res.status(403).json({ success: false, message: "Admin access required" }); return; }
  const { action, note } = req.body as Record<string, string>;
  if (action !== "refund" && action !== "deny") {
    res.status(400).json({ success: false, message: "action must be 'refund' or 'deny'" });
    return;
  }
  const [dispute] = await db.select().from(schemeDisputesTable).where(eq(schemeDisputesTable.id, Number(req.params.id)));
  if (!dispute) { res.status(404).json({ success: false, message: "Dispute not found" }); return; }
  if (dispute.status !== "open" && dispute.status !== "under_review") {
    res.status(409).json({ success: false, message: "Dispute is already resolved" });
    return;
  }

  if (action === "refund") {
    const result = await returnSchemeTransfer(dispute.transferReference, req.user!.id, `Dispute #${dispute.id}: ${dispute.reason}`, "operator");
    if (!result.ok) {
      res.status(result.status).json({ success: false, message: `Refund failed: ${result.message}` });
      return;
    }
  }

  const [resolved] = await db
    .update(schemeDisputesTable)
    .set({
      status: action === "refund" ? "resolved_refund" : "resolved_denied",
      resolutionNote: note || null,
      resolvedByUserId: req.user!.id,
      resolvedAt: new Date(),
    })
    .where(eq(schemeDisputesTable.id, dispute.id))
    .returning();

  await db.insert(notificationsTable).values({
    userId: dispute.openedByUserId,
    title: action === "refund" ? "Dispute Resolved — Refunded" : "Dispute Resolved",
    message:
      action === "refund"
        ? `Your dispute on ${dispute.transferReference} was upheld and the payment was returned to you.`
        : `Your dispute on ${dispute.transferReference} was reviewed and denied.${note ? ` Note: ${note}` : ""}`,
    type: action === "refund" ? "success" : "info",
  });

  res.json({ success: true, dispute: resolved });
});

// ---------- AfrixQR (pan-African QR standard) ----------

router.post("/scheme/qr/generate", requireAuth, async (req: AuthenticatedRequest, res): Promise<void> => {
  const { key, amount, currency, reference, format } = req.body as Record<string, string>;
  const aliases = (await listUserAliases(req.user!.id)).filter((a) => a.status === "active");
  const alias = key ? aliases.find((a) => a.aliasValue === key) : aliases[0];
  if (!alias) {
    res.status(400).json({ success: false, message: "Register and verify an Afrix key first" });
    return;
  }

  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, req.user!.id));
  const home = await getHomeParticipant();
  const payload = encodeAfriQr({
    alias: alias.aliasValue,
    participantCode: home?.code || "COBOPANA",
    merchantName: `${user.firstName || ""} ${user.lastName || ""}`.trim() || user.name,
    country: user.country || "KE",
    currency: currency || alias.currency,
    amount: amount ? Number(amount) : null,
    reference: reference || undefined,
    dynamic: Boolean(amount),
  });

  if (format === "png") {
    const buffer = await QRCode.toBuffer(payload, { errorCorrectionLevel: "M", width: 300 });
    res.set("Content-Type", "image/png");
    res.send(buffer);
    return;
  }
  const dataUrl = await QRCode.toDataURL(payload, { errorCorrectionLevel: "M", width: 300 });
  res.json({ success: true, payload, dataUrl, key: alias.aliasValue });
});

router.post("/scheme/qr/decode", requireAuth, async (req: AuthenticatedRequest, res): Promise<void> => {
  const { payload } = req.body as Record<string, string>;
  const decoded = decodeAfriQr(String(payload || ""));
  if (!decoded.valid) {
    res.status(400).json({ success: false, message: decoded.error || "Invalid AfrixQR payload" });
    return;
  }
  res.json({ success: true, qr: decoded });
});

// ---------- Network registry & stats ----------

router.get("/scheme/participants", requireAuth, async (_req: AuthenticatedRequest, res): Promise<void> => {
  const participants = await db.select().from(schemeParticipantsTable).orderBy(schemeParticipantsTable.country);
  res.json({
    success: true,
    participants: participants.map((p) => ({
      id: p.id, code: p.code, name: p.name, type: p.type, country: p.country, currency: p.currency, status: p.status, joined_at: p.joinedAt,
    })),
  });
});

router.get("/scheme/stats", requireAuth, async (_req: AuthenticatedRequest, res): Promise<void> => {
  const participants = await db.select().from(schemeParticipantsTable);
  const transfers = await db.select().from(schemeTransfersTable);
  const countries = new Set(participants.map((p) => p.country));
  const totalVolume = transfers.reduce((s, t) => s + Number(t.amount), 0);
  res.json({
    success: true,
    stats: {
      participants: participants.length,
      countries: countries.size,
      transfers: transfers.length,
      settled: transfers.filter((t) => t.status === "settled").length,
      total_volume: totalVolume,
    },
  });
});

// ---------- Settlement operations (scheme operator / admin) ----------

router.post("/scheme/participants", requireAuth, async (req: AuthenticatedRequest, res): Promise<void> => {
  if (!(await requireAdmin(req))) { res.status(403).json({ success: false, message: "Admin access required" }); return; }
  const { code, name, type, country, currency, api_url } = req.body as Record<string, string>;
  if (!code || !name || !country || !currency) {
    res.status(400).json({ success: false, message: "code, name, country and currency are required" });
    return;
  }
  const [existing] = await db.select().from(schemeParticipantsTable).where(eq(schemeParticipantsTable.code, code.toUpperCase()));
  if (existing) { res.status(409).json({ success: false, message: "Participant code already exists" }); return; }
  const [participant] = await db
    .insert(schemeParticipantsTable)
    .values({ code: code.toUpperCase(), name, type: type || "bank", country: country.toUpperCase(), currency: currency.toUpperCase(), apiUrl: api_url || null })
    .returning();
  res.status(201).json({ success: true, participant });
});

router.post("/scheme/settlement/close", requireAuth, async (req: AuthenticatedRequest, res): Promise<void> => {
  if (!(await requireAdmin(req))) { res.status(403).json({ success: false, message: "Admin access required" }); return; }
  const summary = await closeSettlementCycle();
  if (!summary) { res.json({ success: true, message: "No open settlement cycle" }); return; }
  res.json({ success: true, message: `Settlement cycle closed — ${summary.transferCount} transfers netted`, batch: summary.batch, positions: summary.positions });
});

router.get("/scheme/settlement/batches", requireAuth, async (req: AuthenticatedRequest, res): Promise<void> => {
  if (!(await requireAdmin(req))) { res.status(403).json({ success: false, message: "Admin access required" }); return; }
  const batches = await db.select().from(settlementBatchesTable).orderBy(desc(settlementBatchesTable.openedAt)).limit(50);
  res.json({ success: true, batches });
});

router.get("/scheme/settlement/batches/:id", requireAuth, async (req: AuthenticatedRequest, res): Promise<void> => {
  if (!(await requireAdmin(req))) { res.status(403).json({ success: false, message: "Admin access required" }); return; }
  const [batch] = await db.select().from(settlementBatchesTable).where(eq(settlementBatchesTable.id, Number(req.params.id)));
  if (!batch) { res.status(404).json({ success: false, message: "Batch not found" }); return; }
  const positions = await getBatchPositions(batch.id);
  res.json({ success: true, batch, positions });
});

export default router;
