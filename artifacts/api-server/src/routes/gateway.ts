// IAPAY Participant Gateway — the server-to-server API a bank or PSP integrates with.
//
//   POST /api/gateway/v1/credit-transfer      pacs.008 (XML) in → pacs.002 (XML) out
//   GET  /api/gateway/v1/status/:endToEndId   pacs.002 for a payment the caller sent or received
//   POST /api/gateway/v1/aliases              register/delete a key (JSON) for the caller's own customers
//
// Every request is authenticated by HMAC-SHA256 over `${timestamp}.${exact request bytes}` with
// the participant's shared secret (see services/scheme/gateway/signing.ts) and must carry the
// headers X-IAPAY-Participant / X-IAPAY-Timestamp / X-IAPAY-Signature. All authentication
// failures return an identical 401 so the API reveals nothing about which participants exist.
// Message bodies are never logged.
//
// Participant contract (see docs/IAPAY-participant-integration.md):
//  * the bank verifies its customer owns a key BEFORE registering it;
//  * the bank sends a pacs.008 only after reserving the debtor's funds, and treats any
//    non-final reply (202/PDNG, timeout, 5xx) as "unknown — poll /status", never as failure;
//  * every message id is unique per participant; resending the same id is always safe.

import { createHash } from "crypto";
import express, { Router, type IRouter, type NextFunction, type Request, type Response } from "express";
import rateLimit from "express-rate-limit";
import { and, eq } from "drizzle-orm";
import { db, paymentAliasesTable, gatewayMessagesTable, type SchemeParticipant } from "@workspace/db";
import { logger } from "../lib/logger.js";
import { getAllRates, ratesAreFresh } from "../services/fxRates.js";
import { loadSchemeConfig } from "../services/scheme/config.js";
import { SIGNATURE_HEADERS, verifySignature } from "../services/scheme/gateway/signing.js";
import { parsePacs008, Iso20022ParseError } from "../services/scheme/iso20022Parse.js";
import { ALIAS_TYPES, normalizeAlias } from "../services/scheme/directory.js";
import { getParticipantByCode, handleInboundMessage, participantSecret, statusForParticipant } from "../services/scheme/externalSwitch.js";

interface GatewayRequest extends Request {
  participant?: SchemeParticipant;
  rawBody?: Buffer;
}

const router: IRouter = Router();

const UNAUTHORIZED = { success: false, message: "Unauthorized" };
// Stand-in secret so an unknown participant still costs one HMAC (never matches a real signature).
const DUMMY_SECRET = "0".repeat(64);

// Pre-auth: protect the endpoint itself, per client IP.
const gatewayIpLimit = rateLimit({
  windowMs: 60 * 1000,
  max: 600,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: "Too many requests" },
});
// Post-auth: per participant, sized for real payment traffic.
const gatewayParticipantLimit = rateLimit({
  windowMs: 60 * 1000,
  max: 3000,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => `participant:${(req as GatewayRequest).participant?.code ?? "unknown"}`,
  message: { success: false, message: "Too many requests" },
});

router.use("/gateway", gatewayIpLimit);
router.use("/gateway/v1/credit-transfer", express.raw({ type: ["application/xml", "text/xml"], limit: "256kb" }));

function bodyBytes(req: GatewayRequest): Buffer {
  if (Buffer.isBuffer(req.body)) return req.body; // XML via express.raw
  return req.rawBody ?? Buffer.alloc(0); // JSON bytes captured by the app-level parser
}

/** `signedBytes` = what the participant signed (the body, or the e2e id for GET status). */
function authenticate(signedBytes: (req: GatewayRequest) => Buffer) {
  return async (req: GatewayRequest, res: Response, next: NextFunction): Promise<void> => {
    const code = String(req.headers[SIGNATURE_HEADERS.participant] ?? "");
    const fail = (reason: string): void => {
      logger.warn({ participant: code.slice(0, 20), reason, path: req.path }, "Gateway authentication failed");
      res.status(401).json(UNAUTHORIZED);
    };
    if (!/^[A-Z0-9]{3,20}$/.test(code)) return fail("bad_participant_header");

    // Every request does exactly one participant lookup and one HMAC computation — known or
    // unknown code, with or without a secret — so response timing doesn't reveal which
    // participant codes exist or have credentials. Failure reasons are checked afterwards.
    const participant = await getParticipantByCode(code);
    const secret = participant ? participantSecret(participant) : null;
    const check = verifySignature({
      secret: secret ?? DUMMY_SECRET,
      timestamp: req.headers[SIGNATURE_HEADERS.timestamp] as string | undefined,
      signature: req.headers[SIGNATURE_HEADERS.signature] as string | undefined,
      body: signedBytes(req),
      maxSkewSec: loadSchemeConfig().gatewayMaxClockSkewSec,
    });
    if (!participant) return fail("unknown_participant");
    if (!secret) return fail("no_secret");
    if (!check.ok) return fail(check.reason);
    if (participant.status !== "active") return fail("participant_inactive");
    req.participant = participant;
    next();
  };
}

// ---------- pacs.008 in, pacs.002 out ----------
router.post(
  "/gateway/v1/credit-transfer",
  authenticate(bodyBytes),
  gatewayParticipantLimit,
  async (req: GatewayRequest, res: Response): Promise<void> => {
    const participant = req.participant!;
    // Fail closed on stale FX: nothing is reserved or recorded, and 503 tells the bank the outcome
    // is "not processed — retry/poll", so it keeps its funds reserved.
    if (loadSchemeConfig().gatewayRequireLiveRates && !ratesAreFresh()) {
      res.status(503).json({ success: false, message: "Exchange rates unavailable; payments are paused" });
      return;
    }
    let parsed;
    try {
      parsed = parsePacs008(bodyBytes(req).toString("utf8"));
    } catch (err) {
      const message = err instanceof Iso20022ParseError ? err.message : "Malformed message";
      res.status(400).json({ success: false, message });
      return;
    }
    const reply = await handleInboundMessage(participant, parsed);
    res.status(reply.status).type("application/xml").send(reply.xml);
  }
);

// ---------- status query ----------
router.get(
  "/gateway/v1/status/:endToEndId",
  authenticate((req) => Buffer.from(String(req.params.endToEndId))),
  gatewayParticipantLimit,
  async (req: GatewayRequest, res: Response): Promise<void> => {
    const reply = await statusForParticipant(req.participant!, String(req.params.endToEndId));
    if (!reply) {
      res.status(404).json({ success: false, message: "Unknown end-to-end id" });
      return;
    }
    res.status(reply.status === 202 ? 200 : reply.status).type("application/xml").send(reply.xml);
  }
);

// ---------- key (alias) registration for the caller's own customers ----------
const MESSAGE_ID = /^[A-Za-z0-9._\-]{1,35}$/;

router.post(
  "/gateway/v1/aliases",
  authenticate(bodyBytes),
  gatewayParticipantLimit,
  async (req: GatewayRequest, res: Response): Promise<void> => {
    const participant = req.participant!;
    const b = (req.body ?? {}) as Record<string, unknown>;
    const messageId = typeof b.message_id === "string" ? b.message_id : "";
    if (!MESSAGE_ID.test(messageId)) {
      res.status(400).json({ success: false, message: "message_id (max 35 chars: letters, digits . _ -) is required" });
      return;
    }

    // Idempotency: same message id replays the stored answer.
    // The request body's hash is stored with the ledger row so a replay must carry the SAME body:
    // re-using a message_id with different content must never return the earlier success.
    const ledgerId = `alias:${messageId}`;
    const bodyHash = createHash("sha256").update(bodyBytes(req)).digest("hex");
    const inserted = await db
      .insert(gatewayMessagesTable)
      .values({ participantCode: participant.code, msgId: ledgerId, endToEndId: bodyHash })
      .onConflictDoNothing()
      .returning();
    if (inserted.length === 0) {
      const [prior] = await db
        .select()
        .from(gatewayMessagesTable)
        .where(and(eq(gatewayMessagesTable.participantCode, participant.code), eq(gatewayMessagesTable.msgId, ledgerId)));
      if (prior && prior.endToEndId !== bodyHash) {
        res.status(422).json({ success: false, message: "message_id was already used with a different request body" });
        return;
      }
      if (prior?.responseXml) {
        res.status(prior.responseStatus ?? 200).type("application/json").send(prior.responseXml);
      } else {
        res.status(409).json({ success: false, message: "Message is still being processed" });
      }
      return;
    }

    const answer = async (status: number, body: Record<string, unknown>): Promise<void> => {
      const text = JSON.stringify(body);
      await db
        .update(gatewayMessagesTable)
        .set({ status: status < 300 ? "credited" : "rejected", responseStatus: status, responseXml: text })
        .where(and(eq(gatewayMessagesTable.participantCode, participant.code), eq(gatewayMessagesTable.msgId, ledgerId)));
      res.status(status).type("application/json").send(text);
    };

    const type = typeof b.key_type === "string" ? b.key_type : "";
    if (!ALIAS_TYPES.includes(type as (typeof ALIAS_TYPES)[number]) || type === "random") {
      return answer(400, { success: false, message: `key_type must be one of: ${ALIAS_TYPES.filter((t) => t !== "random").join(", ")}` });
    }
    const value = normalizeAlias(type, typeof b.key_value === "string" ? b.key_value : "");
    if (!value) return answer(400, { success: false, message: `Invalid ${type} value` });

    if (b.action === "delete") {
      const removed = await db
        .delete(paymentAliasesTable)
        .where(and(eq(paymentAliasesTable.aliasValue, value), eq(paymentAliasesTable.participantId, participant.id)))
        .returning({ id: paymentAliasesTable.id });
      return removed.length ? answer(200, { success: true, message: "Key removed" }) : answer(404, { success: false, message: "Key not found for this participant" });
    }
    if (b.action !== "register") return answer(400, { success: false, message: 'action must be "register" or "delete"' });

    const holderName = typeof b.holder_name === "string" ? b.holder_name.trim() : "";
    const currency = typeof b.currency === "string" ? b.currency.trim().toUpperCase() : "";
    const accountRef = typeof b.account_ref === "string" ? b.account_ref.trim() : "";
    if (holderName.length < 2 || holderName.length > 100) return answer(400, { success: false, message: "holder_name must be 2-100 characters" });
    if (!/^[A-Z]{3}$/.test(currency) || (currency !== "USD" && !(await getAllRates())[currency])) {
      return answer(400, { success: false, message: "currency must be a supported ISO 4217 code" });
    }
    if (!/^[\w\-./:]{1,64}$/.test(accountRef)) return answer(400, { success: false, message: "account_ref must be 1-64 characters (letters, digits, _ - . / :)" });

    try {
      await db.insert(paymentAliasesTable).values({
        aliasType: type,
        aliasValue: value,
        userId: null,
        holderName,
        participantId: participant.id,
        accountRef,
        currency,
        status: "active",
      });
    } catch (err) {
      const code = (err as { code?: string; cause?: { code?: string } })?.code ?? (err as { cause?: { code?: string } })?.cause?.code;
      if (code === "23505") return answer(409, { success: false, message: "This key is already registered" });
      throw err;
    }
    return answer(201, { success: true, message: "Key registered" });
  }
);

export default router;
