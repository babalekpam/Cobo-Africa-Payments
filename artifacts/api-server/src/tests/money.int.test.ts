// Money-route integration tests: wallet funding, P2P, FX swap, bank and mobile payouts, provider
// callbacks, deposit approval and checkout. Each test targets a way money could be created, lost or
// moved twice. Run with a DISPOSABLE Postgres (tables are TRUNCATEd):
//   DATABASE_URL=postgres://... pnpm --filter @workspace/api-server run test:integration

import { test, before, after, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";

process.env.NODE_ENV = "test";
process.env.LOG_LEVEL = process.env.LOG_LEVEL || "silent";
process.env.JWT_SECRET = process.env.JWT_SECRET || "integration-test-jwt-secret-0123456789";
process.env.SCHEME_SEED_DEMO_PARTICIPANTS = "false";

const skip = !process.env.DATABASE_URL;

type Mods = {
  db: typeof import("@workspace/db");
  drizzle: typeof import("drizzle-orm");
  auth: typeof import("../lib/auth.js");
  ledger: typeof import("../lib/ledger.js");
};
let m: Mods;
let server: Server;
let baseUrl = "";

before(async () => {
  if (skip) return;
  m = {
    db: await import("@workspace/db"),
    drizzle: await import("drizzle-orm"),
    auth: await import("../lib/auth.js"),
    ledger: await import("../lib/ledger.js"),
  };
  const { default: app } = await import("../app.js");
  server = app.listen(0);
  await new Promise((r) => server.once("listening", r));
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

after(async () => {
  if (skip) return;
  server?.close();
  await m.db.pool.end();
});

interface Actor { id: number; email: string; token: string; walletId: number }
let admin: Actor, alice: Actor, bob: Actor;

async function mkUser(email: string, role: string, usd: string): Promise<Actor> {
  const [u] = await m.db.db
    .insert(m.db.usersTable)
    .values({ email, name: email.split("@")[0], firstName: email.split("@")[0], lastName: "T", passwordHash: "x", role, kycLevel: "2", kycStatus: "verified" })
    .returning();
  const [w] = await m.db.db.insert(m.db.walletsTable).values({ userId: u.id, currency: "USD", balance: usd, isDefault: true }).returning();
  return { id: u.id, email, token: m.auth.signToken(u), walletId: w.id };
}

beforeEach(async () => {
  if (skip) return;
  await m.db.db.execute(
    m.drizzle.sql`TRUNCATE users, wallets, transactions, notifications, audit_logs, payment_intents, deposit_requests, checkout_sessions, auth_lockouts, idempotency_records, rate_limit_counters RESTART IDENTITY CASCADE`
  );
  process.env.IAPAY_ENVIRONMENT = "sandbox";
  admin = await mkUser("admin@example.com", "admin", "0");
  alice = await mkUser("alice@example.com", "user", "100.00");
  bob = await mkUser("bob@example.com", "user", "0");
});

afterEach(() => {
  delete process.env.IAPAY_ENVIRONMENT;
});

async function api(path: string, o: { method?: string; token?: string; body?: unknown } = {}): Promise<{ status: number; json: any }> {
  const res = await fetch(baseUrl + "/api" + path, {
    method: o.method ?? "GET",
    headers: { "content-type": "application/json", ...(o.token ? { authorization: `Bearer ${o.token}` } : {}) },
    body: o.body === undefined ? undefined : JSON.stringify(o.body),
  });
  return { status: res.status, json: await res.json().catch(() => null) };
}

async function wallet(id: number): Promise<{ balance: number; locked: number }> {
  const [w] = await m.db.db.select().from(m.db.walletsTable).where(m.drizzle.eq(m.db.walletsTable.id, id));
  return { balance: Number(w.balance), locked: Number(w.lockedBalance ?? 0) };
}

async function totalMoney(): Promise<number> {
  const [{ t }] = (await m.db.db.execute(m.drizzle.sql`SELECT COALESCE(SUM(balance + COALESCE(locked_balance,0)),0)::float AS t FROM wallets WHERE currency = 'USD'`)).rows as { t: number }[];
  return Math.round(t * 100) / 100;
}

// ---------- ledger helpers ----------
test("parseAmount accepts exact cents only", { skip }, () => {
  assert.equal(m.ledger.parseAmount("12.5"), "12.50");
  assert.equal(m.ledger.parseAmount(0.01), "0.01");
  for (const bad of ["0.001", "-5", "0", "abc", "", null, undefined, "1e12", Infinity, "12.345"]) {
    assert.equal(m.ledger.parseAmount(bad), null, `refuses ${String(bad)}`);
  }
});

// ---------- test funding ----------
test("test funding works on a sandbox and is refused on a live installation", { skip }, async () => {
  assert.equal((await api("/wallets/fund", { method: "POST", token: bob.token, body: { currency: "USD", amount: 50 } })).status, 200);
  assert.equal((await wallet(bob.walletId)).balance, 50);

  process.env.IAPAY_ENVIRONMENT = "live";
  const r = await api("/wallets/fund", { method: "POST", token: bob.token, body: { currency: "USD", amount: 50 } });
  assert.equal(r.status, 403, "no free money on a live installation");
  assert.equal((await wallet(bob.walletId)).balance, 50);
});

// ---------- P2P ----------
test("concurrent internal transfers can never overdraw or create money", { skip }, async () => {
  const before = await totalMoney();
  const results = await Promise.all(
    Array.from({ length: 10 }, () => api("/transfers/internal", { method: "POST", token: alice.token, body: { recipient_email: bob.email, amount: "30", currency: "USD" } })),
  );
  assert.equal(results.filter((r) => r.status === 200).length, 3, "only 3 x 30 fit in 100");
  assert.deepEqual(await wallet(alice.walletId), { balance: 10, locked: 0 });
  assert.equal((await wallet(bob.walletId)).balance, 90);
  assert.equal(await totalMoney(), before, "money is conserved");
});

test("sub-cent amounts are refused (they would round away on one side only)", { skip }, async () => {
  const r = await api("/transfers/internal", { method: "POST", token: alice.token, body: { recipient_email: bob.email, amount: "0.004", currency: "USD" } });
  assert.equal(r.status, 400);
});

// ---------- FX swap ----------
test("concurrent FX swaps cannot overdraw the source wallet", { skip }, async () => {
  const results = await Promise.all(
    Array.from({ length: 6 }, () => api("/exchange/swap", { method: "POST", token: alice.token, body: { from: "USD", to: "KES", amount: 40 } })),
  );
  assert.equal(results.filter((r) => r.status === 200).length, 2, "only 2 x 40 fit in 100");
  assert.equal((await wallet(alice.walletId)).balance, 20);
});

// ---------- bank payouts ----------
test("live bank transfer holds the funds until an operator resolves it — exactly once", { skip }, async () => {
  process.env.IAPAY_ENVIRONMENT = "live";
  const r = await api("/transfers/bank", { method: "POST", token: alice.token, body: { currency: "USD", amount: 50, account_number: "0123456789", account_name: "Jane Doe" } });
  assert.equal(r.status, 200);
  assert.equal(r.json.status, "pending", "never reported as completed before the payout");
  const fee = r.json.fee as number;
  assert.deepEqual(await wallet(alice.walletId), { balance: Number((100 - 50 - fee).toFixed(2)), locked: Number((50 + fee).toFixed(2)) });

  assert.equal((await api(`/admin/payouts/${r.json.reference}/complete`, { method: "POST", token: alice.token, body: { note: "x" } })).status, 403, "customers cannot confirm payouts");
  assert.equal((await api(`/admin/payouts/${r.json.reference}/complete`, { method: "POST", token: admin.token, body: {} })).status, 400, "a confirmation note is required");
  assert.equal((await api(`/admin/payouts/${r.json.reference}/complete`, { method: "POST", token: admin.token, body: { note: "BANK-STMT-1" } })).status, 200);
  assert.deepEqual(await wallet(alice.walletId), { balance: Number((100 - 50 - fee).toFixed(2)), locked: 0 });
  assert.equal((await api(`/admin/payouts/${r.json.reference}/fail`, { method: "POST", token: admin.token, body: { note: "late" } })).status, 409, "a completed payout cannot also be refunded");
  assert.equal((await wallet(alice.walletId)).balance, Number((100 - 50 - fee).toFixed(2)));
});

test("a failed live bank payout returns the held funds once", { skip }, async () => {
  process.env.IAPAY_ENVIRONMENT = "live";
  const r = await api("/transfers/bank", { method: "POST", token: alice.token, body: { currency: "USD", amount: 20, account_number: "0123456789", account_name: "Jane Doe" } });
  const both = await Promise.all([
    api(`/admin/payouts/${r.json.reference}/fail`, { method: "POST", token: admin.token, body: { note: "rejected by bank" } }),
    api(`/admin/payouts/${r.json.reference}/fail`, { method: "POST", token: admin.token, body: { note: "rejected by bank" } }),
  ]);
  assert.deepEqual(both.map((x) => x.status).sort(), [200, 409]);
  assert.deepEqual(await wallet(alice.walletId), { balance: 100, locked: 0 });
});

// ---------- mobile money ----------
test("mobile money on a live installation with no provider is refused and refunded, never faked", { skip }, async () => {
  process.env.IAPAY_ENVIRONMENT = "live";
  const r = await api("/transfers/mobile", { method: "POST", token: alice.token, body: { currency: "USD", amount: 10, phone: "+254700000000", provider: "mpesa" } });
  assert.equal(r.status, 400);
  assert.deepEqual(await wallet(alice.walletId), { balance: 100, locked: 0 });
});

test("provider callbacks resolve a payout once: replays and in-progress callbacks move nothing", { skip }, async () => {
  // A pending payout with its funds held (what /transfers/mobile leaves behind while the provider works).
  await m.db.db.update(m.db.walletsTable).set({ balance: "75.00", lockedBalance: "25.00" }).where(m.drizzle.eq(m.db.walletsTable.id, alice.walletId));
  await m.db.db.insert(m.db.paymentIntentsTable).values({ reference: "MOB-1", transactionReference: "MOB-1", userId: alice.id, walletId: alice.walletId, provider: "mtn_momo", providerReference: "mtn-ref-1", status: "pending", amount: "24.50", fee: "0.50", currency: "USD" });

  const cb = (status: string) => api("/webhooks/mtn", { method: "POST", body: { referenceId: "mtn-ref-1", status } });
  await cb("PENDING");
  assert.deepEqual(await wallet(alice.walletId), { balance: 75, locked: 25 }, "an in-progress callback is not a failure");
  await Promise.all([cb("FAILED"), cb("FAILED"), cb("FAILED")]);
  assert.deepEqual(await wallet(alice.walletId), { balance: 100, locked: 0 }, "refunded exactly once");
  await cb("SUCCESSFUL");
  assert.deepEqual(await wallet(alice.walletId), { balance: 100, locked: 0 }, "a late success after the refund changes nothing");
});

// ---------- deposits ----------
test("approving a deposit twice (double-click, two admins) credits it once", { skip }, async () => {
  const [dep] = await m.db.db.insert(m.db.depositRequestsTable).values({ userId: bob.id, currency: "USD", amount: "40.00", reference: "DEP-1" }).returning();
  const both = await Promise.all([
    api(`/admin/deposits/${dep.id}/approve`, { method: "POST", token: admin.token }),
    api(`/admin/deposits/${dep.id}/approve`, { method: "POST", token: admin.token }),
  ]);
  assert.deepEqual(both.map((x) => x.status).sort(), [200, 400]);
  assert.equal((await wallet(bob.walletId)).balance, 40);
});

// ---------- checkout ----------
async function mkSession(amount: string): Promise<string> {
  const sessionId = "cs_" + Math.random().toString(36).slice(2, 14);
  await m.db.db.insert(m.db.checkoutSessionsTable).values({ sessionId, merchantUserId: bob.id, apiKeyId: 1, amount, currency: "USD", expiresAt: new Date(Date.now() + 3600_000) });
  return sessionId;
}

test("live checkout: anonymous completion is refused; a signed-in payer pays from their wallet", { skip }, async () => {
  process.env.IAPAY_ENVIRONMENT = "live";
  const sid = await mkSession("30.00");
  const anon = await api(`/pay/${sid}/complete`, { method: "POST", body: { email: "x@example.com" } });
  assert.equal(anon.status, 401, "no money for the merchant from nowhere");
  assert.equal((await wallet(bob.walletId)).balance, 0);

  const paid = await api(`/pay/${sid}/complete`, { method: "POST", token: alice.token, body: { email: alice.email } });
  assert.equal(paid.status, 200);
  assert.equal((await wallet(alice.walletId)).balance, 70);
  assert.equal((await wallet(bob.walletId)).balance, 30);
  await api(`/pay/${sid}/complete`, { method: "POST", token: alice.token, body: {} });
  assert.equal((await wallet(alice.walletId)).balance, 70, "paying again does not charge twice");
});

test("checkout with insufficient funds leaves the session payable and moves nothing", { skip }, async () => {
  process.env.IAPAY_ENVIRONMENT = "live";
  const sid = await mkSession("500.00");
  const r = await api(`/pay/${sid}/complete`, { method: "POST", token: alice.token, body: {} });
  assert.equal(r.status, 400);
  assert.equal((await wallet(alice.walletId)).balance, 100);
  assert.equal((await wallet(bob.walletId)).balance, 0);
  const [s] = await m.db.db.select().from(m.db.checkoutSessionsTable).where(m.drizzle.eq(m.db.checkoutSessionsTable.sessionId, sid));
  assert.equal(s.status, "pending");
});

test("sandbox checkout accepts a simulated payment (labelled as such)", { skip }, async () => {
  const sid = await mkSession("12.00");
  assert.equal((await api(`/pay/${sid}/complete`, { method: "POST", body: { email: "x@example.com" } })).status, 200);
  assert.equal((await wallet(bob.walletId)).balance, 12);
});

// ---------- licensed sanctions provider (fake provider on a local port) ----------
test("sanctions provider: a match blocks, an outage fails closed, a clear result lets the payout through", { skip }, async () => {
  const { createServer } = await import("node:http");
  let mode: "match" | "clear" | "down" = "match";
  let lastAuth = "";
  const provider = createServer((req, res) => {
    lastAuth = String(req.headers.authorization || "");
    let body = "";
    req.on("data", (c) => (body += c));
    req.on("end", () => {
      if (mode === "down") { res.writeHead(500).end(); return; }
      const queries = Object.keys(JSON.parse(body).queries);
      const responses = Object.fromEntries(queries.map((q) => [q, { results: mode === "match" ? [{ id: "NK-1", caption: "Listed Person", score: 0.97, match: true }] : [] }]));
      res.writeHead(200, { "content-type": "application/json" }).end(JSON.stringify({ responses }));
    });
  });
  provider.listen(0);
  await new Promise((r) => provider.once("listening", r));
  process.env.SANCTIONS_API_KEY = "test-key";
  process.env.SANCTIONS_API_URL = `http://127.0.0.1:${(provider.address() as AddressInfo).port}`;
  const send = () => api("/transfers/bank", { method: "POST", token: alice.token, body: { currency: "USD", amount: 10, account_number: "0123456789", account_name: "Jane Doe" } });
  try {
    const blocked = await send();
    assert.equal(blocked.status, 403);
    assert.equal(blocked.json.code, "SANCTIONS_FLAG");
    assert.equal(lastAuth, "ApiKey test-key");

    mode = "down";
    const held = await send();
    assert.equal(held.status, 503, "provider outage: refused, never waved through");
    assert.equal(held.json.code, "SCREENING_UNAVAILABLE");
    assert.deepEqual(await wallet(alice.walletId), { balance: 100, locked: 0 }, "nothing moved");

    mode = "clear";
    assert.equal((await send()).status, 200);
  } finally {
    delete process.env.SANCTIONS_API_KEY;
    delete process.env.SANCTIONS_API_URL;
    provider.close();
  }
});

test("the daily KYC limit holds under simultaneous transfers", { skip }, async () => {
  // An unverified customer (limit $100/day) with plenty of money tries 6 x $30 at once.
  await m.db.db.update(m.db.usersTable).set({ kycLevel: "0" }).where(m.drizzle.eq(m.db.usersTable.id, alice.id));
  await m.db.db.update(m.db.walletsTable).set({ balance: "1000.00" }).where(m.drizzle.eq(m.db.walletsTable.id, alice.walletId));
  const results = await Promise.all(
    Array.from({ length: 6 }, () => api("/transfers/internal", { method: "POST", token: alice.token, body: { recipient_email: bob.email, amount: "30", currency: "USD" } })),
  );
  assert.equal(results.filter((r) => r.status === 200).length, 3, "3 x 30 = 90 fits the $100 limit; a 4th would not");
  assert.ok(results.filter((r) => r.status === 403).every((r) => r.json.code === "LIMIT_EXCEEDED"));
  assert.equal((await wallet(bob.walletId)).balance, 90);
});

test("P2P finds a recipient whose email was registered with capital letters", { skip }, async () => {
  await m.db.db.update(m.db.usersTable).set({ email: "Bob.Mensah@Example.com" }).where(m.drizzle.eq(m.db.usersTable.id, bob.id));
  const r = await api("/transfers/internal", { method: "POST", token: alice.token, body: { recipient_email: "bob.mensah@example.com", amount: "5", currency: "USD" } });
  assert.equal(r.status, 200);
  assert.equal((await wallet(bob.walletId)).balance, 5);
});
