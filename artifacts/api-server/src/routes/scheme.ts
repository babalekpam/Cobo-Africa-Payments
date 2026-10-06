// IAPAY — Pan-African Instant Payment Scheme API.
// Alias directory (IAPAY Keys), instant payments through the switch,
// IAPAY QR generation/decoding, participant registry, and settlement operations.

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
  auditLogsTable,
} from "@workspace/db";
import { isSafeOutboundUrl } from "../lib/urlSafety.js";
import { isProduction } from "../lib/security.js";
import { encryptSecret, generateParticipantSecret, secretBoxAvailable } from "../lib/secretBox.js";
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
  HOME_PARTICIPANT_CODE,
  ALIAS_TYPES,
} from "../services/scheme/directory.js";
import { sendSms } from "../services/sms.js";
import { emailService } from "../services/email.js";
import { processInstantPayment } from "../services/scheme/switchEngine.js";
import { returnSchemeTransfer } from "../services/scheme/returns.js";
import { closeSettlementCycle, getBatchPositions } from "../services/scheme/settlement.js";
import { encodeIapayQr, decodeIapayQr } from "../services/scheme/qrStandard.js";
import { buildPacs008, buildPacs002 } from "../services/scheme/iso20022.js";
import { resolveUnresolvedTransfer } from "../services/scheme/externalSwitch.js";

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
    req.headers["idempotency-key"] = `iapay:${req.user!.id}:${key}`;
  }
  next();
}

// ---------- IAPAY Keys (alias directory) ----------

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
      sendSms(alias.aliasValue, `${result.otp} is your IAPAY key verification code. Expires in 15 minutes.`).catch(() => {});
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

  res.status(201).json({ success: true, message: "IAPAY key registered and live", alias, requires_verification: false });
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
  res.json({ success: true, message: "IAPAY key removed" });
});

// Directory lookup — returns masked holder info, like Pix's pre-payment confirmation
// screen. Rate-limited so the directory can't be scraped by key enumeration.
router.get("/scheme/resolve", directoryLookupRateLimit, requireAuth, async (req: AuthenticatedRequest, res): Promise<void> => {
  const key = String(req.query.key || "");
  const resolved = await resolveAlias(key);
  if (!resolved) {
    res.status(404).json({ success: false, message: "IAPAY key not found in the network directory" });
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
    // A payment that reached an external bank but is not final (pending/declined) still has a
    // transfer record: return its reference so the customer can track it.
    res.status(result.status).json({
      success: false,
      message: result.message,
      code: result.code,
      ...(result.transfer
        ? { reference: result.transfer.reference, end_to_end_id: result.transfer.endToEndId, status: result.transfer.status }
        : {}),
    });
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

// ---------- Operator reconciliation of unresolved bank payments ----------
// A payment whose bank outcome is unknown (timeout, outage, interrupted process) keeps the
// sender's money held. An operator confirms with the bank what actually happened and
// settles it exactly once: "credited" clears it, "not_credited" refunds the sender.

router.get("/scheme/unresolved", requireAuth, async (req: AuthenticatedRequest, res): Promise<void> => {
  if (!(await requireAdmin(req))) {
    res.status(403).json({ success: false, message: "Admin access required" });
    return;
  }
  const transfers = await db
    .select()
    .from(schemeTransfersTable)
    .where(eq(schemeTransfersTable.status, "unresolved"))
    .orderBy(desc(schemeTransfersTable.initiatedAt))
    .limit(200);
  res.json({ success: true, transfers });
});

router.post("/scheme/transfers/:reference/resolve", requireAuth, async (req: AuthenticatedRequest, res): Promise<void> => {
  if (!(await requireAdmin(req))) {
    res.status(403).json({ success: false, message: "Admin access required" });
    return;
  }
  const { outcome, note } = (req.body ?? {}) as { outcome?: string; note?: string };
  if ((outcome !== "credited" && outcome !== "not_credited") || typeof note !== "string" || note.trim().length < 5) {
    res.status(400).json({ success: false, message: 'Provide outcome ("credited" | "not_credited") and a note (min 5 chars) recording the bank confirmation' });
    return;
  }
  const result = await resolveUnresolvedTransfer(String(req.params.reference), outcome, req.user!.id, note.trim());
  res.status(result.status).json({ success: result.ok, message: result.message, status: result.transfer?.status });
});

// ISO 20022 view of a transfer (pacs.008 credit transfer / pacs.002 status report) —
// the format participant banks integrate against. Same access rule as the detail route.
router.get("/scheme/transfers/:reference/iso20022", requireAuth, async (req: AuthenticatedRequest, res): Promise<void> => {
  const msg = typeof req.query.msg === "string" ? req.query.msg : "pacs.008";
  if (msg !== "pacs.008" && msg !== "pacs.002") {
    res.status(400).json({ success: false, message: "msg must be pacs.008 or pacs.002" });
    return;
  }
  const [transfer] = await db
    .select()
    .from(schemeTransfersTable)
    .where(
      and(
        eq(schemeTransfersTable.reference, String(req.params.reference)),
        or(eq(schemeTransfersTable.senderUserId, req.user!.id), eq(schemeTransfersTable.recipientUserId, req.user!.id))
      )
    );
  if (!transfer) {
    res.status(404).json({ success: false, message: "Transfer not found" });
    return;
  }

  const [debtorAgent] = await db.select().from(schemeParticipantsTable).where(eq(schemeParticipantsTable.id, transfer.senderParticipantId));
  const [creditorAgent] = await db.select().from(schemeParticipantsTable).where(eq(schemeParticipantsTable.id, transfer.recipientParticipantId));
  const [sender] = transfer.senderUserId ? await db.select().from(usersTable).where(eq(usersTable.id, transfer.senderUserId)) : [];
  const [recipient] = transfer.recipientUserId ? await db.select().from(usersTable).where(eq(usersTable.id, transfer.recipientUserId)) : [];
  if (!debtorAgent || !creditorAgent) {
    res.status(500).json({ success: false, message: "Participant record missing for transfer" });
    return;
  }

  const fullName = (u?: { firstName?: string | null; lastName?: string | null; businessName?: string | null }) =>
    u?.businessName || [u?.firstName, u?.lastName].filter(Boolean).join(" ") || "IAPAY customer";
  const description = (transfer.metadata as { description?: string | null } | null)?.description ?? null;
  const iso = {
    reference: transfer.reference,
    endToEndId: transfer.endToEndId,
    amount: Number(transfer.amount),
    currency: transfer.currency,
    recipientAmount: Number(transfer.recipientAmount),
    recipientCurrency: transfer.recipientCurrency,
    fxRate: transfer.fxRate ? Number(transfer.fxRate) : null,
    initiatedAt: transfer.initiatedAt,
    clearedAt: transfer.clearedAt,
    description,
    creditorAlias: transfer.recipientAlias,
    debtor: { name: fullName(sender), agentName: debtorAgent.name, participantCode: debtorAgent.code, country: debtorAgent.country },
    creditor: { name: fullName(recipient), agentName: creditorAgent.name, participantCode: creditorAgent.code, country: creditorAgent.country },
  };

  const xml =
    msg === "pacs.008"
      ? buildPacs008(iso)
      : buildPacs002(iso, transfer.status === "rejected" ? "RJCT" : "ACSC", transfer.statusReason ?? undefined);
  res.type("application/xml").send(xml);
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

// ---------- IAPAY QR (pan-African QR standard) ----------

router.post("/scheme/qr/generate", requireAuth, async (req: AuthenticatedRequest, res): Promise<void> => {
  const { key, amount, currency, reference, format } = req.body as Record<string, string>;
  const aliases = (await listUserAliases(req.user!.id)).filter((a) => a.status === "active");
  const alias = key ? aliases.find((a) => a.aliasValue === key) : aliases[0];
  if (!alias) {
    res.status(400).json({ success: false, message: "Register and verify an IAPAY key first" });
    return;
  }

  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, req.user!.id));
  const home = await getHomeParticipant();
  const payload = encodeIapayQr({
    alias: alias.aliasValue,
    participantCode: home?.code || "IAPAYPAN",
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
  const decoded = decodeIapayQr(String(payload || ""));
  if (!decoded.valid) {
    res.status(400).json({ success: false, message: decoded.error || "Invalid IAPAY QR payload" });
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

// ---------- Operator onboarding of participants (banks, MNOs, PSPs) ----------
// Everything an operator needs to bring an institution onto the scheme, with no server
// restart or environment edit: create it (a gateway secret is generated and shown ONCE),
// set its net-debit cap and endpoint, suspend/reactivate it, rotate its secret. Secrets are
// stored AES-256-GCM encrypted (GATEWAY_SECRETS_KEY) and are never returned again.

const PARTICIPANT_TYPES = ["bank", "mobile_money", "fintech", "central_bank"];

function adminParticipantView(p: typeof schemeParticipantsTable.$inferSelect) {
  return {
    id: p.id,
    code: p.code,
    name: p.name,
    type: p.type,
    country: p.country,
    currency: p.currency,
    status: p.status,
    api_url: p.apiUrl,
    net_debit_cap_usd: p.netDebitCapUsd === null ? null : Number(p.netDebitCapUsd),
    has_gateway_secret: !!p.gatewaySecretEnc,
    secret_rotated_at: p.secretRotatedAt,
    joined_at: p.joinedAt,
  };
}

async function adminAudit(adminId: number, action: string, meta: Record<string, unknown>): Promise<void> {
  await db.insert(auditLogsTable).values({ userId: adminId, action, ip: "admin", meta });
}

function validApiUrl(url: unknown): url is string {
  return typeof url === "string" && isSafeOutboundUrl(url, { requireHttps: isProduction() });
}

function parseCap(value: unknown): number | null | undefined {
  if (value === null) return null;
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0 || value > 1e12) return undefined;
  return Math.round(value * 100) / 100;
}

router.get("/scheme/admin/participants", requireAuth, async (req: AuthenticatedRequest, res): Promise<void> => {
  if (!(await requireAdmin(req))) { res.status(403).json({ success: false, message: "Admin access required" }); return; }
  const rows = await db.select().from(schemeParticipantsTable).orderBy(schemeParticipantsTable.code);
  res.json({ success: true, participants: rows.map(adminParticipantView) });
});

router.post("/scheme/participants", requireAuth, async (req: AuthenticatedRequest, res): Promise<void> => {
  if (!(await requireAdmin(req))) { res.status(403).json({ success: false, message: "Admin access required" }); return; }
  const b = (req.body ?? {}) as Record<string, unknown>;
  const code = typeof b.code === "string" ? b.code.trim().toUpperCase() : "";
  const name = typeof b.name === "string" ? b.name.trim() : "";
  const type = typeof b.type === "string" ? b.type : "bank";
  const country = typeof b.country === "string" ? b.country.trim().toUpperCase() : "";
  const currency = typeof b.currency === "string" ? b.currency.trim().toUpperCase() : "";
  if (!/^[A-Z0-9]{3,20}$/.test(code) || code === HOME_PARTICIPANT_CODE) {
    res.status(400).json({ success: false, message: "code must be 3-20 characters A-Z/0-9 and not the operator's own code" });
    return;
  }
  if (name.length < 2 || name.length > 100 || !PARTICIPANT_TYPES.includes(type) || !/^[A-Z]{2}$/.test(country) || !/^[A-Z]{3}$/.test(currency)) {
    res.status(400).json({ success: false, message: `name, country (ISO-2), currency (ISO-4217) are required; type one of ${PARTICIPANT_TYPES.join(", ")}` });
    return;
  }
  if (b.api_url !== undefined && b.api_url !== null && !validApiUrl(b.api_url)) {
    res.status(400).json({ success: false, message: "api_url must be a public https URL" });
    return;
  }
  const cap = b.net_debit_cap_usd === undefined ? null : parseCap(b.net_debit_cap_usd);
  if (cap === undefined) {
    res.status(400).json({ success: false, message: "net_debit_cap_usd must be a number >= 0" });
    return;
  }
  const [existing] = await db.select().from(schemeParticipantsTable).where(eq(schemeParticipantsTable.code, code));
  if (existing) { res.status(409).json({ success: false, message: "Participant code already exists" }); return; }

  const secret = secretBoxAvailable() ? generateParticipantSecret() : null;
  const [participant] = await db
    .insert(schemeParticipantsTable)
    .values({
      code,
      name,
      type,
      country,
      currency,
      apiUrl: (b.api_url as string | null | undefined) ?? null,
      netDebitCapUsd: cap === null ? null : String(cap),
      gatewaySecretEnc: secret ? encryptSecret(secret) : null,
      secretRotatedAt: secret ? new Date() : null,
    })
    .returning();
  await adminAudit(req.user!.id, "iapay_participant_created", { code, type, country, currency, cap, secretIssued: !!secret });
  res.status(201).json({
    success: true,
    participant: adminParticipantView(participant),
    // Shown exactly once. Hand it to the institution over a secure channel.
    gateway_secret: secret,
    note: secret
      ? "Store this gateway secret now; it cannot be shown again. The participant cannot send until you set net_debit_cap_usd."
      : "No gateway secret was issued: set GATEWAY_SECRETS_KEY (>= 32 chars) on the server, then call rotate-secret.",
  });
});

router.put("/scheme/participants/:code", requireAuth, async (req: AuthenticatedRequest, res): Promise<void> => {
  if (!(await requireAdmin(req))) { res.status(403).json({ success: false, message: "Admin access required" }); return; }
  const code = String(req.params.code).toUpperCase();
  const [p] = await db.select().from(schemeParticipantsTable).where(eq(schemeParticipantsTable.code, code));
  if (!p) { res.status(404).json({ success: false, message: "Participant not found" }); return; }
  const b = (req.body ?? {}) as Record<string, unknown>;
  const patch: Partial<typeof schemeParticipantsTable.$inferInsert> = {};
  if (b.net_debit_cap_usd !== undefined) {
    const cap = parseCap(b.net_debit_cap_usd);
    if (cap === undefined) { res.status(400).json({ success: false, message: "net_debit_cap_usd must be a number >= 0 or null" }); return; }
    patch.netDebitCapUsd = cap === null ? null : String(cap);
  }
  if (b.status !== undefined) {
    if ((b.status !== "active" && b.status !== "suspended") || code === HOME_PARTICIPANT_CODE) {
      res.status(400).json({ success: false, message: 'status must be "active" or "suspended" (the operator itself cannot be suspended)' });
      return;
    }
    patch.status = b.status;
  }
  if (b.api_url !== undefined) {
    if (b.api_url !== null && !validApiUrl(b.api_url)) { res.status(400).json({ success: false, message: "api_url must be a public https URL or null" }); return; }
    patch.apiUrl = b.api_url as string | null;
  }
  if (Object.keys(patch).length === 0) { res.status(400).json({ success: false, message: "Nothing to update" }); return; }
  const [updated] = await db.update(schemeParticipantsTable).set(patch).where(eq(schemeParticipantsTable.id, p.id)).returning();
  await adminAudit(req.user!.id, "iapay_participant_updated", { code, changes: Object.keys(patch), cap: b.net_debit_cap_usd, status: b.status });
  res.json({ success: true, participant: adminParticipantView(updated) });
});

router.post("/scheme/participants/:code/rotate-secret", requireAuth, async (req: AuthenticatedRequest, res): Promise<void> => {
  if (!(await requireAdmin(req))) { res.status(403).json({ success: false, message: "Admin access required" }); return; }
  const code = String(req.params.code).toUpperCase();
  if (code === HOME_PARTICIPANT_CODE) { res.status(400).json({ success: false, message: "The operator has no gateway secret" }); return; }
  if (!secretBoxAvailable()) {
    res.status(503).json({ success: false, message: "GATEWAY_SECRETS_KEY (>= 32 chars) is not configured on the server" });
    return;
  }
  const [p] = await db.select().from(schemeParticipantsTable).where(eq(schemeParticipantsTable.code, code));
  if (!p) { res.status(404).json({ success: false, message: "Participant not found" }); return; }
  const secret = generateParticipantSecret();
  await db.update(schemeParticipantsTable).set({ gatewaySecretEnc: encryptSecret(secret), secretRotatedAt: new Date() }).where(eq(schemeParticipantsTable.id, p.id));
  await adminAudit(req.user!.id, "iapay_participant_secret_rotated", { code });
  res.json({
    success: true,
    gateway_secret: secret,
    note: "The previous secret stopped working immediately. Store this one now; it cannot be shown again.",
  });
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
