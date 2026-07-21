// AfriPay — Pan-African Instant Payment Scheme API.
// Alias directory (AfriPay Keys), instant payments through the switch,
// AfriQR generation/decoding, participant registry, and settlement operations.

import { Router, type IRouter } from "express";
import QRCode from "qrcode";
import { eq, or, desc, and } from "drizzle-orm";
import {
  db,
  usersTable,
  schemeParticipantsTable,
  schemeTransfersTable,
  settlementBatchesTable,
} from "@workspace/db";
import { requireAuth, type AuthenticatedRequest } from "../middlewares/requireAuth.js";
import {
  registerAlias,
  listUserAliases,
  deleteAlias,
  resolveAlias,
  getHomeParticipant,
  ALIAS_TYPES,
} from "../services/scheme/directory.js";
import { processInstantPayment } from "../services/scheme/switchEngine.js";
import { closeSettlementCycle, getBatchPositions } from "../services/scheme/settlement.js";
import { encodeAfriQr, decodeAfriQr } from "../services/scheme/qrStandard.js";

const router: IRouter = Router();

async function requireAdmin(req: AuthenticatedRequest): Promise<boolean> {
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, req.user!.id));
  return user?.role === "admin";
}

// ---------- AfriPay Keys (alias directory) ----------

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
  res.status(201).json({ success: true, message: "AfriPay key registered", alias: result.alias });
});

router.delete("/scheme/aliases/:id", requireAuth, async (req: AuthenticatedRequest, res): Promise<void> => {
  const ok = await deleteAlias(req.user!.id, Number(req.params.id));
  if (!ok) {
    res.status(404).json({ success: false, message: "Key not found" });
    return;
  }
  res.json({ success: true, message: "AfriPay key removed" });
});

// Directory lookup — returns masked holder info, like Pix's pre-payment confirmation screen
router.get("/scheme/resolve", requireAuth, async (req: AuthenticatedRequest, res): Promise<void> => {
  const key = String(req.query.key || "");
  const resolved = await resolveAlias(key);
  if (!resolved) {
    res.status(404).json({ success: false, message: "AfriPay key not found in the network directory" });
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

router.post("/scheme/pay", requireAuth, async (req: AuthenticatedRequest, res): Promise<void> => {
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

// ---------- AfriQR (pan-African QR standard) ----------

router.post("/scheme/qr/generate", requireAuth, async (req: AuthenticatedRequest, res): Promise<void> => {
  const { key, amount, currency, reference, format } = req.body as Record<string, string>;
  const aliases = await listUserAliases(req.user!.id);
  const alias = key ? aliases.find((a) => a.aliasValue === key) : aliases[0];
  if (!alias) {
    res.status(400).json({ success: false, message: "Register an AfriPay key first" });
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
    res.status(400).json({ success: false, message: decoded.error || "Invalid AfriQR payload" });
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
