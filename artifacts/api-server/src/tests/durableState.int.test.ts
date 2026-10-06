// Security state shared by every API instance (Postgres-backed): sign-in lockout, rate-limit
// counters and the Idempotency-Key ledger. Run with a DISPOSABLE Postgres (tables are TRUNCATEd):
//   DATABASE_URL=postgres://... pnpm --filter @workspace/api-server run test:integration

import { test, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import express from "express";

process.env.NODE_ENV = "test";
process.env.LOG_LEVEL = process.env.LOG_LEVEL || "silent";
process.env.JWT_SECRET = process.env.JWT_SECRET || "integration-test-jwt-secret-0123456789";
process.env.SCHEME_SEED_DEMO_PARTICIPANTS = "false";
// This suite runs the real app on the Postgres rate-limit store (production's), reset per test.
process.env.RATE_LIMIT_STORE = "postgres";

const skip = !process.env.DATABASE_URL;

type Mods = {
  db: typeof import("@workspace/db");
  drizzle: typeof import("drizzle-orm");
  auth: typeof import("../lib/auth.js");
  lockout: typeof import("../lib/lockout.js");
  store: typeof import("../middlewares/rateLimitStore.js");
  idem: typeof import("../middlewares/idempotency.js");
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
    lockout: await import("../lib/lockout.js"),
    store: await import("../middlewares/rateLimitStore.js"),
    idem: await import("../middlewares/idempotency.js"),
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

beforeEach(async () => {
  if (skip) return;
  await m.db.db.execute(m.drizzle.sql`TRUNCATE users, wallets, audit_logs, auth_lockouts, idempotency_records, rate_limit_counters RESTART IDENTITY CASCADE`);
});

async function login(email: string, password: string): Promise<number> {
  const res = await fetch(baseUrl + "/api/auth/login", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  return res.status;
}

// ---------- lockout ----------
test("five wrong passwords lock sign-in for that account, even with the right password afterwards", { skip }, async () => {
  await m.db.db.insert(m.db.usersTable).values({ email: "carol@example.com", name: "carol", passwordHash: m.auth.hashPassword("Right-Passphrase-77"), role: "user" });
  for (let i = 0; i < 4; i++) assert.equal(await login("carol@example.com", "wrong-guess-" + i), 401);
  assert.equal(await login("carol@example.com", "wrong-guess-5"), 401); // the 5th failure sets the lock
  assert.equal(await login("carol@example.com", "Right-Passphrase-77"), 429, "locked: even the right password is refused");
  // The lock lives in the database, so another instance (or a restart) sees it too.
  assert.equal(await m.lockout.isLockedOut("login:carol@example.com"), true);
});

test("the per-IP sign-in limit is enforced from the shared database counter", { skip }, async () => {
  for (let i = 0; i < 10; i++) assert.equal(await login(`nobody${i}@example.com`, "x-wrong-password"), 401);
  assert.equal(await login("nobody@example.com", "x-wrong-password"), 429, "11th sign-in attempt in the window");
  const [{ n }] = (await m.db.db.execute(m.drizzle.sql`SELECT count(*)::int AS n FROM rate_limit_counters WHERE key LIKE 'auth:%'`)).rows as { n: number }[];
  assert.equal(n, 1, "counted in Postgres, not in this process's memory");
});

test("a successful sign-in clears earlier failures", { skip }, async () => {
  await m.db.db.insert(m.db.usersTable).values({ email: "dave@example.com", name: "dave", passwordHash: m.auth.hashPassword("Right-Passphrase-77"), role: "user" });
  for (let i = 0; i < 4; i++) assert.equal(await login("dave@example.com", "nope-" + i), 401);
  assert.equal(await login("dave@example.com", "Right-Passphrase-77"), 200);
  for (let i = 0; i < 4; i++) assert.equal(await login("dave@example.com", "nope-again-" + i), 401, "the counter restarted from zero");
});

test("lockout counter is atomic under concurrent wrong answers", { skip }, async () => {
  const results = await Promise.all(Array.from({ length: 5 }, () => m.lockout.recordFailedAttempt("pin:race")));
  assert.equal(results.filter((r) => r.locked).length, 1, "exactly one of five concurrent failures trips the lock");
  assert.equal(await m.lockout.isLockedOut("pin:race"), true);
  await m.lockout.clearAttempts("pin:race");
  assert.equal(await m.lockout.isLockedOut("pin:race"), false);
});

// ---------- rate limits shared across instances ----------
test("two API instances share one rate-limit allowance", { skip }, async () => {
  const opts = { windowMs: 60_000 } as Parameters<NonNullable<InstanceType<typeof m.store.PostgresRateLimitStore>["init"]>>[0];
  const instanceA = new m.store.PostgresRateLimitStore("shared-test");
  const instanceB = new m.store.PostgresRateLimitStore("shared-test");
  instanceA.init(opts);
  instanceB.init(opts);
  assert.equal((await instanceA.increment("203.0.113.5")).totalHits, 1);
  assert.equal((await instanceB.increment("203.0.113.5")).totalHits, 2, "instance B sees instance A's hit");
  const hits = await Promise.all(Array.from({ length: 20 }, (_, i) => (i % 2 ? instanceA : instanceB).increment("203.0.113.5")));
  assert.equal(Math.max(...hits.map((h) => h.totalHits)), 22, "concurrent hits are all counted");
  await instanceA.resetKey("203.0.113.5");
  assert.equal((await instanceB.increment("203.0.113.5")).totalHits, 1);
  assert.equal((await instanceB.increment("other-client")).totalHits, 1, "clients are counted separately");
});

// ---------- idempotency ----------
test("Idempotency-Key: a retry replays the first response; a different payload or a duplicate in flight is refused", { skip }, async () => {
  let executions = 0;
  let release: () => void = () => {};
  const app = express();
  app.use(express.json());
  app.post("/pay", m.idem.idempotencyMiddleware, async (req, res) => {
    executions += 1;
    if (req.body.slow) await new Promise<void>((r) => (release = r));
    res.status(201).json({ paid: req.body.amount, execution: executions });
  });
  const s = app.listen(0);
  await new Promise((r) => s.once("listening", r));
  const url = `http://127.0.0.1:${(s.address() as AddressInfo).port}/pay`;
  const post = (key: string, body: unknown) =>
    fetch(url, { method: "POST", headers: { "content-type": "application/json", "idempotency-key": key }, body: JSON.stringify(body) })
      .then(async (r) => ({ status: r.status, json: await r.json() }));

  try {
    const first = await post("k1", { amount: 10 });
    assert.equal(first.status, 201);
    const retry = await post("k1", { amount: 10 });
    assert.deepEqual(retry, first, "the retry gets the stored response");
    assert.equal(executions, 1, "the payment ran once");

    assert.equal((await post("k1", { amount: 99 })).status, 409, "same key, different payload");

    const inFlight = post("k2", { amount: 5, slow: true });
    await new Promise((r) => setTimeout(r, 150));
    assert.equal((await post("k2", { amount: 5, slow: true })).status, 409, "duplicate while the first is still running");
    release();
    assert.equal((await inFlight).status, 201);
    assert.equal(executions, 2);
  } finally {
    s.close();
  }
});
