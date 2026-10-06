// Access-control integration tests: who may read, create, change or delete what.
// Run with a DISPOSABLE Postgres (tables are TRUNCATEd):
//   DATABASE_URL=postgres://... pnpm --filter @workspace/api-server run test:integration
// Every test drives the real Express app over HTTP with real session tokens.

import { test, before, after, beforeEach } from "node:test";
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

// ---------- fixtures ----------
interface Actor {
  id: number;
  email: string;
  token: string;
}
interface World {
  admin: Actor;
  a: Actor;
  b: Actor;
}
let w: World;

async function mkUser(email: string, role: string, extra: Record<string, unknown> = {}): Promise<Actor> {
  const [u] = await m.db.db
    .insert(m.db.usersTable)
    .values({ email, name: email.split("@")[0], firstName: email.split("@")[0], lastName: "T", passwordHash: m.auth.hashPassword("Correct-Horse-Battery-9"), role, kycLevel: "2", kycStatus: "verified", ...extra })
    .returning();
  await m.db.db.insert(m.db.walletsTable).values({ userId: u.id, currency: "USD", balance: "0" });
  return { id: u.id, email, token: m.auth.signToken({ id: u.id, email, role }) };
}

beforeEach(async () => {
  if (skip) return;
  await m.db.db.execute(
    m.drizzle.sql`TRUNCATE users, wallets, transactions, merchants, kyc_documents, notifications, audit_logs, scheme_participants, payment_aliases, scheme_transfers, settlement_batches, gateway_messages RESTART IDENTITY CASCADE`
  );
  w = { admin: await mkUser("admin@example.com", "admin"), a: await mkUser("alice@example.com", "user"), b: await mkUser("bob@example.com", "user") };
});

async function api(path: string, o: { method?: string; token?: string; body?: unknown } = {}): Promise<{ status: number; json: any }> {
  const res = await fetch(baseUrl + "/api" + path, {
    method: o.method ?? "GET",
    headers: { "content-type": "application/json", ...(o.token ? { authorization: `Bearer ${o.token}` } : {}) },
    body: o.body === undefined ? undefined : JSON.stringify(o.body),
  });
  const text = await res.text();
  let json: any = {};
  try { json = JSON.parse(text); } catch { /* not json */ }
  return { status: res.status, json };
}
const userRow = async (id: number) => (await m.db.db.select().from(m.db.usersTable).where(m.drizzle.eq(m.db.usersTable.id, id)))[0];

// ---------- 1. user management ----------
test("finding 1: ordinary users cannot list, read, create, edit or delete accounts — nor make themselves admin", { skip }, async () => {
  const calls: Array<[string, string, unknown]> = [
    ["GET", "/users", undefined],
    ["GET", `/users/${w.b.id}`, undefined],
    ["POST", "/users", { email: "evil@example.com", name: "Evil", password: "Passw0rd!Passw0rd!", role: "admin" }],
    ["PUT", `/users/${w.a.id}`, { role: "admin" }],
    ["PUT", `/users/${w.b.id}`, { status: "suspended" }],
    ["DELETE", `/users/${w.b.id}`, undefined],
  ];
  for (const [method, path, body] of calls) {
    assert.equal((await api(path, { method, body })).status, 401, `${method} ${path} requires login`);
    assert.equal((await api(path, { method, body, token: w.a.token })).status, 403, `${method} ${path} must be admin-only`);
  }
  assert.equal((await userRow(w.a.id)).role, "user", "no privilege escalation");
  assert.equal((await userRow(w.b.id)).status, "active", "other accounts untouched");
  assert.equal((await m.db.db.select().from(m.db.usersTable).where(m.drizzle.eq(m.db.usersTable.email, "evil@example.com"))).length, 0);
});

test("finding 1: administrators keep control, with guard rails against lockout and orphaned money", { skip }, async () => {
  assert.equal((await api("/users", { token: w.admin.token })).status, 200);
  const created = await api("/users", { method: "POST", token: w.admin.token, body: { email: "new@example.com", name: "New", password: "Passw0rd!Passw0rd!", role: "customer" } });
  assert.equal(created.status, 201);
  assert.equal((await api(`/users/${created.json.id}`, { method: "PUT", token: w.admin.token, body: { name: "Renamed" } })).status, 200);
  assert.equal((await api(`/users/${created.json.id}`, { method: "DELETE", token: w.admin.token })).status, 200, "an unused account can be deleted");

  assert.equal((await api(`/users/${w.admin.id}`, { method: "DELETE", token: w.admin.token })).status, 400, "cannot delete yourself");
  assert.equal((await api(`/users/${w.admin.id}`, { method: "PUT", token: w.admin.token, body: { role: "customer" } })).status, 400, "cannot demote yourself");
  assert.equal((await api(`/users/${w.admin.id}`, { method: "PUT", token: w.admin.token, body: { status: "suspended" } })).status, 400, "cannot suspend yourself");

  await m.db.db.update(m.db.walletsTable).set({ balance: "5.00" }).where(m.drizzle.eq(m.db.walletsTable.userId, w.b.id));
  assert.equal((await api(`/users/${w.b.id}`, { method: "DELETE", token: w.admin.token })).status, 409, "cannot delete an account that holds money");
  await m.db.db.update(m.db.walletsTable).set({ balance: "0" }).where(m.drizzle.eq(m.db.walletsTable.userId, w.b.id));
  await m.db.db.insert(m.db.transactionsTable).values({ reference: "T-HIST", amount: "1", currency: "USD", status: "completed", type: "send", customerId: w.b.id, paymentMethod: "iapay" });
  assert.equal((await api(`/users/${w.b.id}`, { method: "DELETE", token: w.admin.token })).status, 409, "cannot delete an account with transaction history");
  assert.ok(await userRow(w.b.id));
});

// ---------- 2. transactions ----------
async function mkTx(reference: string, customerId: number | null, merchantId: number | null = null) {
  const [tx] = await m.db.db.insert(m.db.transactionsTable).values({ reference, amount: "10", currency: "USD", status: "pending", type: "send", customerId, merchantId, paymentMethod: "iapay" }).returning();
  return tx;
}

test("finding 2: transactions are private to their owner; only administrators can create or change them", { skip }, async () => {
  const merchant = await api("/merchants", { method: "POST", token: w.a.token, body: { name: "Alice Shop", email: "shop@alice.example", country: "KE" } });
  assert.equal(merchant.status, 201);
  const txA = await mkTx("T-A", w.a.id);
  const txB = await mkTx("T-B", w.b.id);
  const txShop = await mkTx("T-SHOP", null, merchant.json.id); // a sale at Alice's merchant

  const refs = (await api("/transactions?limit=100", { token: w.a.token })).json.data.map((t: any) => t.reference).sort();
  assert.deepEqual(refs, ["T-A", "T-SHOP"], "a user sees only their own and their merchant's transactions");
  assert.equal((await api("/transactions?limit=100", { token: w.admin.token })).json.data.length, 3, "an administrator sees all");

  assert.equal((await api(`/transactions/${txA.id}`, { token: w.a.token })).status, 200);
  assert.equal((await api(`/transactions/${txShop.id}`, { token: w.a.token })).status, 200);
  assert.equal((await api(`/transactions/${txB.id}`, { token: w.a.token })).status, 404, "someone else's transaction looks nonexistent");
  assert.equal((await api(`/transactions/${txB.id}`, { token: w.admin.token })).status, 200);

  assert.equal((await api("/transactions", { method: "POST", token: w.a.token, body: { amount: 1, currency: "USD", status: "completed", type: "send" } })).status, 403);
  assert.equal((await api(`/transactions/${txA.id}`, { method: "PUT", token: w.a.token, body: { status: "completed" } })).status, 403, "even the owner cannot rewrite a ledger record");
  assert.equal((await api(`/transactions/${txB.id}`, { method: "PUT", token: w.a.token, body: { status: "failed" } })).status, 403);
  const [after] = await m.db.db.select().from(m.db.transactionsTable).where(m.drizzle.eq(m.db.transactionsTable.id, txA.id));
  assert.equal(after.status, "pending");
  assert.equal((await api(`/transactions/${txA.id}`, { method: "PUT", token: w.admin.token, body: { status: "completed" } })).status, 200);
});

// ---------- 3. merchants ----------
test("finding 3: merchants belong to an owner; others cannot see, change or delete them", { skip }, async () => {
  const mk = (token: string, email: string) => api("/merchants", { method: "POST", token, body: { name: `Shop ${email}`, email, country: "KE" } });
  const ma = (await mk(w.a.token, "a@shop.example")).json;
  const mb = (await mk(w.b.token, "b@shop.example")).json;
  await m.db.db.insert(m.db.merchantsTable).values({ name: "Platform legacy merchant", email: "legacy@shop.example", country: "KE" }); // no owner

  const names = (r: any) => r.json.data.map((x: any) => x.email).sort();
  assert.deepEqual(names(await api("/merchants?limit=100", { token: w.a.token })), ["a@shop.example"]);
  assert.deepEqual(names(await api("/merchants?limit=100", { token: w.b.token })), ["b@shop.example"]);
  assert.equal((await api("/merchants?limit=100", { token: w.admin.token })).json.data.length, 3, "an administrator sees all, including ownerless legacy rows");

  assert.equal((await api(`/merchants/${mb.id}`, { token: w.a.token })).status, 404);
  assert.equal((await api(`/merchants/${mb.id}`, { method: "PUT", token: w.a.token, body: { name: "Hijacked" } })).status, 404);
  assert.equal((await api(`/merchants/${mb.id}`, { method: "DELETE", token: w.a.token })).status, 404);
  const [still] = await m.db.db.select().from(m.db.merchantsTable).where(m.drizzle.eq(m.db.merchantsTable.id, mb.id));
  assert.equal(still.name, "Shop b@shop.example", "the other business's record is intact");

  assert.equal((await api(`/merchants/${ma.id}`, { method: "PUT", token: w.a.token, body: { name: "Alice Renamed" } })).status, 200, "owners manage their own merchant");

  // an administrator suspends it; the owner cannot reactivate it
  assert.equal((await api(`/merchants/${ma.id}`, { method: "PUT", token: w.admin.token, body: { status: "suspended" } })).status, 200);
  assert.equal((await api(`/merchants/${ma.id}`, { method: "PUT", token: w.a.token, body: { status: "active" } })).status, 403);
  const [susp] = await m.db.db.select().from(m.db.merchantsTable).where(m.drizzle.eq(m.db.merchantsTable.id, ma.id));
  assert.equal(susp.status, "suspended");
  assert.equal((await api(`/merchants/${ma.id}`, { method: "DELETE", token: w.a.token })).status, 200, "owner may delete their own merchant");
});

// ---------- 4. dashboard ----------
test("finding 4: platform-wide reporting is for administrators only", { skip }, async () => {
  for (const p of ["/dashboard/summary", "/dashboard/recent-transactions", "/dashboard/volume-by-country", "/dashboard/monthly-volume", "/dashboard/top-merchants"]) {
    assert.equal((await api(p)).status, 401, `${p} requires login`);
    assert.equal((await api(p, { token: w.a.token })).status, 403, `${p} must be admin-only`);
    assert.equal((await api(p, { token: w.admin.token })).status, 200, `${p} works for administrators`);
  }
});

// ---------- 5. private files ----------
test("finding 5: private files are served only to their owner or an administrator", { skip }, async () => {
  const fsp = await import("node:fs/promises");
  const os = await import("node:os");
  const path = await import("node:path");
  const dir = await fsp.mkdtemp(path.join(os.tmpdir(), "iapay-acl-"));
  process.env.OBJECT_STORAGE = "local";
  process.env.LOCAL_STORAGE_DIR = dir;
  try {
    const png = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(32, 3)]);
    const ticket = await api("/kyc/upload-url", { method: "POST", token: w.a.token, body: { contentType: "image/png" } });
    assert.equal(ticket.status, 200);
    assert.equal((await fetch(baseUrl + ticket.json.uploadURL, { method: "PUT", headers: { "content-type": "image/png" }, body: png })).status, 200);
    const objectPath: string = ticket.json.objectPath;
    const get = (token: string) => fetch(`${baseUrl}/api/storage${objectPath}`, { headers: { authorization: `Bearer ${token}` } });

    assert.equal((await get(w.a.token)).status, 200, "the owner can read it");
    assert.equal((await get(w.admin.token)).status, 200, "an administrator can read it");
    assert.equal((await get(w.b.token)).status, 404, "another user cannot, even with the exact path");

    const attach = (token: string) => api("/kyc/submit", { method: "POST", token, body: { document_type: "national_id", document_number: "1234567", file_path: objectPath } });
    assert.equal((await attach(w.b.token)).status, 400, "cannot attach someone else's file to your own KYC record");
    assert.equal((await attach(w.a.token)).status, 200);

    // a file with no recorded owner (e.g. created before ownership tracking) fails closed for users
    const { createLocalUploadURL, saveLocalUpload } = await import("../lib/localObjectStore.js");
    const legacy = createLocalUploadURL("image/png");
    assert.equal(await saveLocalUpload(legacy.uploadURL.split("/").pop()!, "image/png", png), "ok");
    const getLegacy = (token: string) => fetch(`${baseUrl}/api/storage${legacy.objectPath}`, { headers: { authorization: `Bearer ${token}` } });
    assert.equal((await getLegacy(w.a.token)).status, 404, "unowned file: not served to ordinary users");
    assert.equal((await getLegacy(w.admin.token)).status, 200, "unowned file: administrators only");
  } finally {
    delete process.env.OBJECT_STORAGE;
    delete process.env.LOCAL_STORAGE_DIR;
    await fsp.rm(dir, { recursive: true, force: true });
  }
});

// ---------- 6. sessions ----------
test("finding 6: suspending, deactivating, deleting or demoting an account takes effect immediately", { skip }, async () => {
  // Any authenticated route works as a session probe; /wallets avoids the login rate limiter that
  // covers every /api/auth/* path.
  const me = (token: string) => api("/wallets", { token });
  assert.equal((await me(w.a.token)).status, 200);

  for (const [label, patch] of [["suspended", { status: "suspended" }], ["pending", { status: "pending" }], ["isActive=false", { isActive: "false" }]] as const) {
    await m.db.db.update(m.db.usersTable).set({ status: "active", isActive: "true" }).where(m.drizzle.eq(m.db.usersTable.id, w.a.id));
    assert.equal((await me(w.a.token)).status, 200, `${label}: starts active`);
    await m.db.db.update(m.db.usersTable).set(patch).where(m.drizzle.eq(m.db.usersTable.id, w.a.id));
    assert.equal((await me(w.a.token)).status, 401, `${label}: an existing token stops working at once`);
    const login = await api("/auth/login", { method: "POST", body: { email: w.a.email, password: "Correct-Horse-Battery-9" } });
    assert.equal(login.status, 401, `${label}: cannot log in either`);
  }

  // role changes apply immediately: a token minted as admin stops being admin the moment the role changes
  assert.equal((await api("/users", { token: w.admin.token })).status, 200);
  await m.db.db.update(m.db.usersTable).set({ role: "user" }).where(m.drizzle.eq(m.db.usersTable.id, w.admin.id));
  assert.equal((await api("/users", { token: w.admin.token })).status, 403, "demoted admin loses admin access with the same token");

  // and a deleted account's token is dead
  await m.db.db.delete(m.db.usersTable).where(m.drizzle.eq(m.db.usersTable.id, w.b.id));
  assert.equal((await me(w.b.token)).status, 401);
});

// ---------- 15. network visibility ----------
test("finding 15: network-wide payment volumes are visible to administrators only", { skip }, async () => {
  const user = await api("/scheme/stats", { token: w.a.token });
  assert.equal(user.status, 200);
  assert.equal(user.json.stats.total_volume, undefined, "no volume for ordinary users");
  assert.equal(user.json.stats.transfers, undefined);
  assert.equal(user.json.stats.settled, undefined);
  const admin = await api("/scheme/stats", { token: w.admin.token });
  assert.equal(typeof admin.json.stats.total_volume, "number");
  assert.equal(typeof admin.json.stats.transfers, "number");
});
