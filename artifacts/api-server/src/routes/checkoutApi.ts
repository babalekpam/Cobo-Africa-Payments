import { Router, type IRouter, type Request, type Response, type NextFunction } from "express";
import { eq, and, desc } from "drizzle-orm";
import { db, apiKeysTable, checkoutSessionsTable, webhookEventsTable, usersTable, walletsTable, transactionsTable } from "@workspace/db";
import { requireAuth, type AuthenticatedRequest } from "../middlewares/requireAuth";
import crypto from "crypto";

const router: IRouter = Router();

function generateApiKey(mode: string): string {
  const prefix = mode === "live" ? "iapay_live_" : "iapay_test_";
  return prefix + crypto.randomBytes(24).toString("hex");
}

function hashKey(key: string): string {
  return crypto.createHash("sha256").update(key).digest("hex");
}

function generateSessionId(): string {
  return "cs_" + crypto.randomBytes(16).toString("hex");
}

interface ApiKeyAuthRequest extends Request {
  merchantUser?: { id: number; email: string; apiKeyId: number; mode: string };
}

async function requireApiKey(req: ApiKeyAuthRequest, res: Response, next: NextFunction): Promise<void> {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    res.status(401).json({ error: { type: "authentication_error", message: "Missing API key. Include Authorization: Bearer <your_api_key>" } });
    return;
  }
  const key = authHeader.slice(7);
  const kHash = hashKey(key);
  const [apiKey] = await db.select().from(apiKeysTable).where(eq(apiKeysTable.keyHash, kHash));
  if (!apiKey || !apiKey.isActive) {
    res.status(401).json({ error: { type: "authentication_error", message: "Invalid or revoked API key" } });
    return;
  }
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, parseInt(apiKey.userId)));
  if (!user) {
    res.status(401).json({ error: { type: "authentication_error", message: "Account not found" } });
    return;
  }
  await db.update(apiKeysTable).set({ lastUsedAt: new Date() }).where(eq(apiKeysTable.id, apiKey.id));
  req.merchantUser = { id: user.id, email: user.email, apiKeyId: apiKey.id, mode: apiKey.mode };
  next();
}

function isValidWebhookUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return false;
    const host = parsed.hostname.toLowerCase().replace(/^\[|\]$/g, "");
    if (host === "localhost" || host === "127.0.0.1" || host === "0.0.0.0" || host === "::1" || host === "::") return false;
    if (host.startsWith("127.") || host.startsWith("10.") || host.startsWith("192.168.") || host.startsWith("169.254.")) return false;
    if (/^172\.(1[6-9]|2\d|3[01])\./.test(host)) return false;
    // IPv6 loopback/link-local/unique-local
    if (host.startsWith("fe80:") || host.startsWith("fc") || host.startsWith("fd") || host.startsWith("::ffff:")) return false;
    // Reject non-dotted numeric encodings of IPs (e.g. http://2130706433/, 0x7f000001)
    if (/^\d+$/.test(host) || /^0x[0-9a-f]+$/.test(host) || /^0\d+/.test(host)) return false;
    if (host.endsWith(".internal") || host.endsWith(".local")) return false;
    return true;
  } catch {
    return false;
  }
}

const WEBHOOK_SECRET = process.env.WEBHOOK_SIGNING_SECRET || crypto.randomBytes(32).toString("hex");

const WEBHOOK_RETRY_DELAYS = [0, 5000, 30000, 120000, 600000];

async function attemptWebhookDelivery(webhookUrl: string, eventType: string, payload: any): Promise<{ ok: boolean; status: number }> {
  const signature = crypto.createHmac("sha256", WEBHOOK_SECRET).update(JSON.stringify(payload)).digest("hex");
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const response = await fetch(webhookUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-IAPAY-Event": eventType,
      "X-IAPAY-Signature": signature,
      "X-IAPAY-Timestamp": timestamp,
      "X-IAPAY-Delivery": crypto.randomUUID(),
      "User-Agent": "IAPAY-Webhooks/1.0",
    },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(15000),
  });
  return { ok: response.ok, status: response.status };
}

async function deliverWebhook(sessionId: number, merchantUserId: number, eventType: string, webhookUrl: string, payload: any) {
  let eventId: number | null = null;
  try {
    const [event] = await db.insert(webhookEventsTable).values({
      checkoutSessionId: sessionId,
      merchantUserId,
      eventType,
      webhookUrl,
      payload,
      status: "pending",
    }).returning();
    eventId = event.id;

    if (!isValidWebhookUrl(webhookUrl)) {
      await db.update(webhookEventsTable).set({ status: "failed", attempts: 1, lastAttemptAt: new Date() }).where(eq(webhookEventsTable.id, event.id));
      console.warn("[WEBHOOK] blocked private/invalid URL:", webhookUrl);
      return;
    }

    let delivered = false;
    let lastStatus = 0;
    for (let attempt = 0; attempt < WEBHOOK_RETRY_DELAYS.length; attempt++) {
      if (attempt > 0) {
        await new Promise(r => setTimeout(r, WEBHOOK_RETRY_DELAYS[attempt]));
      }
      try {
        const result = await attemptWebhookDelivery(webhookUrl, eventType, payload);
        lastStatus = result.status;
        await db.update(webhookEventsTable).set({
          attempts: attempt + 1,
          lastAttemptAt: new Date(),
          responseCode: result.status,
          status: result.ok ? "delivered" : (attempt === WEBHOOK_RETRY_DELAYS.length - 1 ? "failed" : "retrying"),
        }).where(eq(webhookEventsTable.id, event.id));
        if (result.ok) { delivered = true; break; }
      } catch (err) {
        await db.update(webhookEventsTable).set({
          attempts: attempt + 1,
          lastAttemptAt: new Date(),
          status: attempt === WEBHOOK_RETRY_DELAYS.length - 1 ? "failed" : "retrying",
        }).where(eq(webhookEventsTable.id, event.id));
      }
    }
    if (!delivered) {
      console.warn(`[WEBHOOK] failed after ${WEBHOOK_RETRY_DELAYS.length} attempts: ${webhookUrl} (last status: ${lastStatus})`);
    }
  } catch (e) {
    console.error("[WEBHOOK] delivery error:", e);
    if (eventId) {
      await db.update(webhookEventsTable).set({ status: "failed", attempts: 1, lastAttemptAt: new Date() }).where(eq(webhookEventsTable.id, eventId)).catch(() => {});
    }
  }
}


router.post("/developer/api-keys", requireAuth, async (req: AuthenticatedRequest, res): Promise<void> => {
  const { name, mode } = req.body;
  if (!name) { res.status(400).json({ success: false, message: "Key name required" }); return; }
  const keyMode = mode === "live" ? "live" : "test";
  const rawKey = generateApiKey(keyMode);
  const kHash = hashKey(rawKey);
  const prefix = rawKey.slice(0, 12) + "...";

  const [apiKey] = await db.insert(apiKeysTable).values({
    userId: String(req.user!.id),
    name,
    keyPrefix: prefix,
    keyHash: kHash,
    mode: keyMode,
  }).returning();

  res.status(201).json({
    success: true,
    api_key: {
      id: apiKey.id,
      name: apiKey.name,
      key: rawKey,
      prefix: prefix,
      mode: apiKey.mode,
      created_at: apiKey.createdAt,
    },
    message: "Save this key now — it won't be shown again.",
  });
});

router.get("/developer/api-keys", requireAuth, async (req: AuthenticatedRequest, res): Promise<void> => {
  const keys = await db.select({
    id: apiKeysTable.id,
    name: apiKeysTable.name,
    keyPrefix: apiKeysTable.keyPrefix,
    mode: apiKeysTable.mode,
    isActive: apiKeysTable.isActive,
    lastUsedAt: apiKeysTable.lastUsedAt,
    createdAt: apiKeysTable.createdAt,
  }).from(apiKeysTable).where(eq(apiKeysTable.userId, String(req.user!.id))).orderBy(desc(apiKeysTable.createdAt));
  res.json({ success: true, api_keys: keys });
});

router.delete("/developer/api-keys/:id", requireAuth, async (req: AuthenticatedRequest, res): Promise<void> => {
  const id = parseInt(req.params.id);
  await db.update(apiKeysTable).set({ isActive: false }).where(
    and(eq(apiKeysTable.id, id), eq(apiKeysTable.userId, String(req.user!.id)))
  );
  res.json({ success: true, message: "API key revoked" });
});


router.post("/checkout/sessions", requireApiKey as any, async (req: Request, res): Promise<void> => {
  const r = req as ApiKeyAuthRequest;
  const { amount, currency, description, reference, customer_email, success_url, cancel_url, webhook_url, metadata } = req.body;

  if (!amount || isNaN(Number(amount)) || Number(amount) <= 0) {
    res.status(400).json({ error: { type: "invalid_request", message: "amount is required and must be > 0" } });
    return;
  }

  const sessionId = generateSessionId();
  const expiresAt = new Date(Date.now() + 30 * 60 * 1000);

  const [session] = await db.insert(checkoutSessionsTable).values({
    sessionId,
    merchantUserId: r.merchantUser!.id,
    apiKeyId: r.merchantUser!.apiKeyId,
    amount: String(amount),
    currency: (currency || "USD").toUpperCase(),
    description: description || null,
    reference: reference || null,
    customerEmail: customer_email || null,
    successUrl: success_url || null,
    cancelUrl: cancel_url || null,
    webhookUrl: webhook_url || null,
    status: "pending",
    metadata: metadata || null,
    expiresAt,
  }).returning();

  const baseUrl = `https://${process.env.REPLIT_DEV_DOMAIN || "localhost"}`;

  res.status(201).json({
    id: session.sessionId,
    object: "checkout.session",
    amount: Number(session.amount),
    currency: session.currency,
    status: session.status,
    description: session.description,
    reference: session.reference,
    checkout_url: `${baseUrl}/pay/${session.sessionId}`,
    expires_at: session.expiresAt.toISOString(),
    created_at: session.createdAt.toISOString(),
  });
});

router.get("/checkout/sessions/:sessionId", requireApiKey as any, async (req: Request, res): Promise<void> => {
  const r = req as ApiKeyAuthRequest;
  const { sessionId } = req.params;
  const [session] = await db.select().from(checkoutSessionsTable).where(
    and(eq(checkoutSessionsTable.sessionId, sessionId), eq(checkoutSessionsTable.merchantUserId, r.merchantUser!.id))
  );
  if (!session) { res.status(404).json({ error: { type: "not_found", message: "Session not found" } }); return; }

  res.json({
    id: session.sessionId,
    object: "checkout.session",
    amount: Number(session.amount),
    currency: session.currency,
    status: session.status,
    description: session.description,
    reference: session.reference,
    customer_email: session.customerEmail,
    paid_at: session.paidAt?.toISOString() || null,
    expires_at: session.expiresAt.toISOString(),
    created_at: session.createdAt.toISOString(),
    metadata: session.metadata,
  });
});

router.get("/checkout/sessions", requireApiKey as any, async (req: Request, res): Promise<void> => {
  const r = req as ApiKeyAuthRequest;
  const sessions = await db.select().from(checkoutSessionsTable)
    .where(eq(checkoutSessionsTable.merchantUserId, r.merchantUser!.id))
    .orderBy(desc(checkoutSessionsTable.createdAt))
    .limit(50);

  res.json({
    object: "list",
    data: sessions.map(s => ({
      id: s.sessionId,
      object: "checkout.session",
      amount: Number(s.amount),
      currency: s.currency,
      status: s.status,
      description: s.description,
      reference: s.reference,
      customer_email: s.customerEmail,
      paid_at: s.paidAt?.toISOString() || null,
      expires_at: s.expiresAt.toISOString(),
      created_at: s.createdAt.toISOString(),
    })),
  });
});


router.get("/pay/:sessionId/info", async (req, res): Promise<void> => {
  const { sessionId } = req.params;
  const [session] = await db.select().from(checkoutSessionsTable).where(eq(checkoutSessionsTable.sessionId, sessionId));
  if (!session) { res.status(404).json({ error: "Session not found" }); return; }

  const [merchant] = await db.select({
    name: usersTable.name,
    businessName: usersTable.businessName,
    email: usersTable.email,
  }).from(usersTable).where(eq(usersTable.id, session.merchantUserId));

  const expired = new Date(session.expiresAt) < new Date() && session.status === "pending";
  if (expired) {
    await db.update(checkoutSessionsTable).set({ status: "expired" }).where(eq(checkoutSessionsTable.id, session.id));
  }

  res.json({
    session_id: session.sessionId,
    amount: Number(session.amount),
    currency: session.currency,
    description: session.description,
    reference: session.reference,
    status: expired ? "expired" : session.status,
    merchant_name: merchant?.businessName || merchant?.name || "IAPAY Merchant",
    customer_email: session.customerEmail,
    expires_at: session.expiresAt.toISOString(),
  });
});

router.post("/pay/:sessionId/complete", async (req, res): Promise<void> => {
  const { sessionId } = req.params;
  const { email, name, payment_method } = req.body;

  const [session] = await db.select().from(checkoutSessionsTable).where(eq(checkoutSessionsTable.sessionId, sessionId));
  if (!session) { res.status(404).json({ error: "Session not found" }); return; }
  if (session.status === "paid") {
    res.json({ success: true, message: "Payment already completed", redirect_url: session.successUrl || null });
    return;
  }
  if (session.status !== "pending") {
    res.status(400).json({ error: `Session is already ${session.status}` });
    return;
  }
  if (new Date(session.expiresAt) < new Date()) {
    await db.update(checkoutSessionsTable).set({ status: "expired" }).where(eq(checkoutSessionsTable.id, session.id));
    res.status(400).json({ error: "Session has expired" });
    return;
  }

  const updated = await db.update(checkoutSessionsTable)
    .set({ status: "paid", paidAt: new Date(), customerEmail: email || session.customerEmail })
    .where(and(eq(checkoutSessionsTable.id, session.id), eq(checkoutSessionsTable.status, "pending")))
    .returning();

  if (updated.length === 0) {
    res.json({ success: true, message: "Payment already completed", redirect_url: session.successUrl || null });
    return;
  }

  const [merchantWallet] = await db.select().from(walletsTable).where(
    and(eq(walletsTable.userId, session.merchantUserId), eq(walletsTable.currency, session.currency))
  );

  if (merchantWallet) {
    await db.update(walletsTable).set({
      balance: String(Number(merchantWallet.balance) + Number(session.amount)),
    }).where(eq(walletsTable.id, merchantWallet.id));
  } else {
    await db.insert(walletsTable).values({
      userId: session.merchantUserId,
      currency: session.currency,
      balance: String(session.amount),
    });
  }

  const ref = "CHK-" + session.sessionId.slice(3, 11).toUpperCase();
  await db.insert(transactionsTable).values({
    customerId: session.merchantUserId,
    type: "receive",
    status: "completed",
    amount: String(session.amount),
    currency: session.currency,
    description: `Checkout payment: ${session.description || ref}`,
    reference: ref,
    paymentMethod: payment_method || "checkout",
  });

  if (session.webhookUrl) {
    deliverWebhook(session.id, session.merchantUserId, "checkout.session.paid", session.webhookUrl, {
      event: "checkout.session.paid",
      data: {
        id: session.sessionId,
        amount: Number(session.amount),
        currency: session.currency,
        reference: ref,
        customer_email: email || session.customerEmail,
        paid_at: new Date().toISOString(),
        metadata: session.metadata,
      },
    }).catch(() => {});
  }

  res.json({
    success: true,
    message: "Payment completed",
    redirect_url: session.successUrl || null,
  });
});

export default router;
