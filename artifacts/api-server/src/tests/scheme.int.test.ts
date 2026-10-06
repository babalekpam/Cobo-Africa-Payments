// Money-path integration tests. Run with a DISPOSABLE Postgres:
//   DATABASE_URL=postgres://... pnpm --filter @workspace/api-server run test:integration
// Tables are TRUNCATEd between tests. These tests drive the real Express app over HTTP with
// signed gateway messages and the real switch engine, and try to break the invariants:
// money is credited/refunded at most once, banks cannot exceed caps, unknown outcomes are
// never assumed, and replays/parallel duplicates cannot double-spend.

import { test, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";

process.env.NODE_ENV = "test";
process.env.LOG_LEVEL = process.env.LOG_LEVEL || "silent";
process.env.JWT_SECRET = process.env.JWT_SECRET || "integration-test-jwt-secret-0123456789";
process.env.SCHEME_SEED_DEMO_PARTICIPANTS = "false";
const SECRET_A = "bank-a-shared-secret-0123456789";
const SECRET_B = "bank-b-shared-secret-0123456789";
process.env.GATEWAY_PARTICIPANT_SECRETS = JSON.stringify({ BANKAKEN: SECRET_A, BANKBGHA: SECRET_B });
const SECRETS_KEY = "integration-test-secrets-key-0123456789abcdef";
process.env.GATEWAY_SECRETS_KEY = SECRETS_KEY;

const skip = !process.env.DATABASE_URL;

// Dynamic imports: @workspace/db throws at import without DATABASE_URL.
type Mods = {
  db: typeof import("@workspace/db");
  drizzle: typeof import("drizzle-orm");
  signing: typeof import("../services/scheme/gateway/signing.js");
  iso: typeof import("../services/scheme/iso20022.js");
  ext: typeof import("../services/scheme/externalSwitch.js");
  engine: typeof import("../services/scheme/switchEngine.js");
  settlement: typeof import("../services/scheme/settlement.js");
  adapters: typeof import("../services/scheme/adapters.js");
  participants: typeof import("../services/scheme/participants.js");
};
let m: Mods;
let server: Server;
let baseUrl = "";

before(async () => {
  if (skip) return;
  m = {
    db: await import("@workspace/db"),
    drizzle: await import("drizzle-orm"),
    signing: await import("../services/scheme/gateway/signing.js"),
    iso: await import("../services/scheme/iso20022.js"),
    ext: await import("../services/scheme/externalSwitch.js"),
    engine: await import("../services/scheme/switchEngine.js"),
    settlement: await import("../services/scheme/settlement.js"),
    adapters: await import("../services/scheme/adapters.js"),
    participants: await import("../services/scheme/participants.js"),
  };
  const { default: app } = await import("../app.js");
  server = app.listen(0);
  await new Promise((r) => server.once("listening", r));
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

after(async () => {
  if (skip) return;
  m.ext.setAdapterOverrideForTests(null);
  server?.close();
  await m.db.pool.end();
});

// ---------- fixtures ----------
interface World {
  home: { id: number; code: string };
  bankA: { id: number };
  bankB: { id: number };
  alice: { id: number; walletId: number };
  bob: { id: number; walletId: number };
}
let w: World;

async function reset(): Promise<World> {
  const { db } = m.db;
  await db.execute(
    m.drizzle.sql`TRUNCATE users, auth_lockouts, idempotency_records, rate_limit_counters, wallets, transactions, notifications, audit_logs, scheme_participants, payment_aliases, scheme_transfers, settlement_batches, settlement_positions, gateway_messages, ctr_reports RESTART IDENTITY CASCADE`
  );
  m.ext.setAdapterOverrideForTests(null);
  await m.participants.ensureSchemeParticipants(); // operator only (demo seeding off)
  const [home] = await db.select().from(m.db.schemeParticipantsTable);
  const [bankA] = await db
    .insert(m.db.schemeParticipantsTable)
    .values({ code: "BANKAKEN", name: "Bank A Kenya", type: "bank", country: "KE", currency: "USD", netDebitCapUsd: "1000" })
    .returning();
  const [bankB] = await db
    .insert(m.db.schemeParticipantsTable)
    .values({ code: "BANKBGHA", name: "Bank B Ghana", type: "bank", country: "GH", currency: "USD" }) // no cap => fail closed (0)
    .returning();

  const mkUser = async (email: string, first: string, last: string, balance: string) => {
    const [u] = await db
      .insert(m.db.usersTable)
      .values({ email, name: `${first} ${last}`, firstName: first, lastName: last, passwordHash: "x", kycLevel: "2", kycStatus: "verified" })
      .returning();
    const [wallet] = await db.insert(m.db.walletsTable).values({ userId: u.id, currency: "USD", balance }).returning();
    return { id: u.id, walletId: wallet.id };
  };
  const alice = await mkUser("alice@example.com", "Alice", "Wanjiru", "1000.00");
  const bob = await mkUser("bob@example.com", "Bob", "Mensah", "500.00");
  await db.insert(m.db.paymentAliasesTable).values([
    { aliasType: "phone", aliasValue: "+254700000001", userId: alice.id, participantId: home.id, accountRef: "w-alice", currency: "USD", status: "active" },
    { aliasType: "email", aliasValue: "bob@example.com", userId: bob.id, participantId: home.id, accountRef: "w-bob", currency: "USD", status: "active" },
  ]);
  return { home, bankA, bankB, alice, bob };
}

beforeEach(async () => {
  if (skip) return;
  w = await reset();
});

async function balance(walletId: number): Promise<number> {
  const [row] = await m.db.db.select().from(m.db.walletsTable).where(m.drizzle.eq(m.db.walletsTable.id, walletId));
  return Number(row.balance);
}
async function transfers() {
  return m.db.db.select().from(m.db.schemeTransfersTable);
}

// ---------- gateway client ----------
function pacs008(o: { e2e: string; alias: string; amount?: number; currency?: string; debtorCode?: string; creditorCode?: string; debtorName?: string }): string {
  const amount = o.amount ?? 100;
  const currency = o.currency ?? "USD";
  return m.iso.buildPacs008({
    reference: `I${o.e2e}`.slice(0, 35),
    endToEndId: o.e2e,
    amount,
    currency,
    recipientAmount: amount,
    recipientCurrency: currency,
    fxRate: 1,
    initiatedAt: new Date(),
    clearedAt: new Date(),
    creditorAlias: o.alias,
    description: "test payment",
    debtor: { name: o.debtorName ?? "Test Payer", agentName: "Bank", participantCode: o.debtorCode ?? "BANKAKEN", country: "KE" },
    creditor: { name: "Payee", agentName: "Operator", participantCode: o.creditorCode ?? "IAPAYPAN", country: "KE" },
  });
}

async function send(
  path: string,
  body: string,
  opts: { code?: string; secret?: string; ts?: number; sig?: string; contentType?: string; method?: string } = {}
): Promise<{ status: number; text: string }> {
  const code = opts.code ?? "BANKAKEN";
  const secret = opts.secret ?? SECRET_A;
  const ts = opts.ts ?? Math.floor(Date.now() / 1000);
  const res = await fetch(baseUrl + path, {
    method: opts.method ?? "POST",
    headers: {
      "content-type": opts.contentType ?? "application/xml",
      "x-iapay-participant": code,
      "x-iapay-timestamp": String(ts),
      "x-iapay-signature": opts.sig ?? m.signing.signMessage(secret, ts, body),
    },
    body: opts.method === "GET" ? undefined : body,
  });
  return { status: res.status, text: await res.text() };
}
const credit = (xml: string, o?: Parameters<typeof send>[2]) => send("/api/gateway/v1/credit-transfer", xml, o);
const txStatus = (xml: string) => /<TxSts>(\w+)<\/TxSts>/.exec(xml)?.[1];
const reason = (xml: string) => /<Prtry>(\w+)<\/Prtry>/.exec(xml)?.[1];

// ---------- authentication ----------
test("gateway rejects unauthenticated, forged, stale and unknown-participant requests identically", { skip }, async () => {
  const xml = pacs008({ e2e: "EAUTH000000000000001", alias: "+254700000001" });
  const cases = [
    await credit(xml, { sig: "00".repeat(32) }), // forged signature
    await credit(xml, { secret: "wrong-secret-wrong-secret-12345" }), // wrong secret
    await credit(xml, { ts: Math.floor(Date.now() / 1000) - 3600 }), // stale
    await credit(xml, { code: "NOSUCHBANK", secret: SECRET_A }), // unknown participant
    await credit(xml, { code: "bad code!" }), // malformed header
  ];
  for (const r of cases) {
    assert.equal(r.status, 401);
    assert.deepEqual(JSON.parse(r.text), { success: false, message: "Unauthorized" });
  }
  const noHeaders = await fetch(`${baseUrl}/api/gateway/v1/credit-transfer`, { method: "POST", headers: { "content-type": "application/xml" }, body: xml });
  assert.equal(noHeaders.status, 401);
  assert.equal(await balance(w.alice.walletId), 1000, "no money moved by unauthenticated requests");
  assert.equal((await transfers()).length, 0);
});

test("a body tampered after signing is rejected", { skip }, async () => {
  const xml = pacs008({ e2e: "ETAMP00000000000001", alias: "+254700000001", amount: 10 });
  const ts = Math.floor(Date.now() / 1000);
  const sig = m.signing.signMessage(SECRET_A, ts, xml);
  const r = await credit(xml.replace(">10.00<", ">900.00<"), { ts, sig });
  assert.equal(r.status, 401);
  assert.equal(await balance(w.alice.walletId), 1000);
});

// ---------- inbound credit (bank → operator-held key) ----------
test("bank credits an operator-held key: wallet +amount once, transfer cleared in the open batch, ledger recorded", { skip }, async () => {
  const r = await credit(pacs008({ e2e: "ECR000000000000000001", alias: "+254700000001", amount: 100 }));
  assert.equal(r.status, 200);
  assert.equal(txStatus(r.text), "ACSC");
  assert.equal(await balance(w.alice.walletId), 1100);
  const [t] = await transfers();
  assert.equal(t.status, "cleared");
  assert.equal(t.senderUserId, null);
  assert.equal(t.senderParticipantId, w.bankA.id);
  assert.equal(t.recipientUserId, w.alice.id);
  assert.ok(t.settlementBatchId);
  const ledger = await m.db.db.select().from(m.db.gatewayMessagesTable);
  assert.equal(ledger.length, 1);
  assert.equal(ledger[0].status, "credited");
});

test("replaying the same signed message returns the same reply and never credits twice", { skip }, async () => {
  const xml = pacs008({ e2e: "ERP000000000000000001", alias: "+254700000001", amount: 100 });
  const first = await credit(xml);
  const again = await credit(xml);
  const third = await credit(xml);
  assert.equal(first.status, 200);
  assert.equal(again.status, 200);
  assert.equal(txStatus(again.text), "ACSC");
  assert.equal(third.status, 200);
  assert.equal(await balance(w.alice.walletId), 1100, "credited exactly once");
  assert.equal((await transfers()).length, 1);
});

test("parallel duplicate deliveries credit exactly once", { skip }, async () => {
  const xml = pacs008({ e2e: "EPAR00000000000000001", alias: "+254700000001", amount: 50 });
  const results = await Promise.all(Array.from({ length: 8 }, () => credit(xml)));
  assert.ok(results.some((r) => r.status === 200), "one delivery succeeds");
  for (const r of results) assert.ok([200, 409].includes(r.status), `unexpected status ${r.status}`);
  assert.equal(await balance(w.alice.walletId), 1050, "credited exactly once under concurrency");
  assert.equal((await transfers()).length, 1);
});

test("re-using a message id for a different payment is refused (DUPL) and moves nothing", { skip }, async () => {
  await credit(pacs008({ e2e: "EMSG0000000000000001", alias: "+254700000001", amount: 10 }));
  const other = pacs008({ e2e: "EMSG0000000000000002", alias: "+254700000001", amount: 10 }).replace(/<MsgId>[^<]+<\/MsgId>/, "<MsgId>MEMSG0000000000000001</MsgId>");
  const r = await credit(other);
  assert.equal(r.status, 422);
  assert.equal(reason(r.text), "DUPL");
  assert.equal(await balance(w.alice.walletId), 1010);
});

test("an end-to-end id already used in the network cannot be credited again under a new message id", { skip }, async () => {
  await credit(pacs008({ e2e: "EE2E000000000000000001", alias: "+254700000001", amount: 10 }));
  const dup = pacs008({ e2e: "EE2E000000000000000001", alias: "+254700000001", amount: 10 }).replace(/<MsgId>[^<]+<\/MsgId>/, "<MsgId>NEWMSG000000000000001</MsgId>");
  const r = await credit(dup);
  assert.equal(r.status, 422);
  assert.equal(reason(r.text), "DUPL");
  assert.equal(await balance(w.alice.walletId), 1010);
});

test("business rules reject without moving money: unknown key, wrong agent, currency, cents, ceiling, spoofed debtor agent", { skip }, async () => {
  const cases: Array<[string, string, string]> = [
    ["unknown key", pacs008({ e2e: "ER1000000000000000001", alias: "+254799999999" }), "AC03"],
    ["wrong creditor agent", pacs008({ e2e: "ER2000000000000000001", alias: "+254700000001", creditorCode: "BANKBGHA" }), "RC01"],
    ["currency mismatch", pacs008({ e2e: "ER3000000000000000001", alias: "+254700000001", currency: "KES" }), "AM03"],
    ["fractional cents", pacs008({ e2e: "ER4000000000000000001", alias: "+254700000001", amount: 10 }).replace(">10.00<", ">10.005<"), "AM02"],
    ["above single-payment ceiling", pacs008({ e2e: "ER5000000000000000001", alias: "+254700000001", amount: 20000 }), "AM02"],
    ["debtor agent spoofing another bank", pacs008({ e2e: "ER6000000000000000001", alias: "+254700000001", debtorCode: "BANKBGHA" }), "RC01"],
  ];
  for (const [label, xml, expected] of cases) {
    const r = await credit(xml);
    assert.equal(r.status, 422, label);
    assert.equal(reason(r.text), expected, label);
  }
  assert.equal(await balance(w.alice.walletId), 1000);
  assert.equal((await transfers()).length, 0);
});

test("net-debit cap: a bank cannot originate beyond its cap; a bank with no cap cannot originate at all", { skip }, async () => {
  const ok = await credit(pacs008({ e2e: "ECAP00000000000000001", alias: "+254700000001", amount: 600 }));
  assert.equal(ok.status, 200);
  const over = await credit(pacs008({ e2e: "ECAP00000000000000002", alias: "+254700000001", amount: 600 })); // 1200 > 1000
  assert.equal(over.status, 422);
  assert.equal(reason(over.text), "AM23");
  assert.equal(await balance(w.alice.walletId), 1600, "only the first payment credited");

  const uncapped = await credit(pacs008({ e2e: "ECAP00000000000000003", alias: "+254700000001", amount: 1, debtorCode: "BANKBGHA" }), {
    code: "BANKBGHA",
    secret: SECRET_B,
  });
  assert.equal(reason(uncapped.text), "AM23", "default cap is 0 (fail closed)");
  assert.equal(await balance(w.alice.walletId), 1600);
});

test("parallel payments from one bank cannot jointly exceed its cap", { skip }, async () => {
  // cap 1000: ten parallel 300 payments → at most three can be admitted
  const results = await Promise.all(
    Array.from({ length: 10 }, (_, i) => credit(pacs008({ e2e: `EPC${String(i).padStart(18, "0")}`, alias: "+254700000001", amount: 300 })))
  );
  const accepted = results.filter((r) => r.status === 200).length;
  assert.ok(accepted <= 3, `accepted ${accepted} payments of 300 under a 1000 cap`);
  assert.equal(await balance(w.alice.walletId), 1000 + accepted * 300);
});

test("sanctioned debtor is refused; ordinary names that merely resemble listed ones are not", { skip }, async () => {
  const hit = await credit(pacs008({ e2e: "ESAN00000000000000001", alias: "+254700000001", debtorName: "Ahmed Diriye" }));
  assert.equal(reason(hit.text), "RR04");
  assert.equal(await balance(w.alice.walletId), 1000);
  const fine = await credit(pacs008({ e2e: "ESAN00000000000000002", alias: "+254700000001", debtorName: "Ibrahim Musa", amount: 10 }));
  assert.equal(fine.status, 200, "no false positive on a common name");
});

// ---------- key registration ----------
const aliasBody = (o: Record<string, unknown>) =>
  JSON.stringify({ message_id: "REG-1", action: "register", key_type: "phone", key_value: "+233200000001", holder_name: "Kofi Mensah", currency: "USD", account_ref: "acct-001", ...o });
const aliasCall = (body: string, o?: Parameters<typeof send>[2]) => send("/api/gateway/v1/aliases", body, { contentType: "application/json", ...o });

test("a bank registers keys only for itself; duplicates conflict; replays are idempotent; deletes are scoped", { skip }, async () => {
  const b = aliasBody({});
  const reg = await aliasCall(b, { code: "BANKBGHA", secret: SECRET_B });
  assert.equal(reg.status, 201);
  const replay = await aliasCall(b, { code: "BANKBGHA", secret: SECRET_B });
  assert.equal(replay.status, 201, "same message id replays the stored answer");
  const [row] = await m.db.db.select().from(m.db.paymentAliasesTable).where(m.drizzle.eq(m.db.paymentAliasesTable.aliasValue, "+233200000001"));
  assert.equal(row.participantId, w.bankB.id);
  assert.equal(row.userId, null);

  const dup = await aliasCall(aliasBody({ message_id: "REG-2" }), { code: "BANKAKEN" });
  assert.equal(dup.status, 409, "another bank cannot take an existing key");
  const stealDelete = await aliasCall(aliasBody({ message_id: "DEL-1", action: "delete" }), { code: "BANKAKEN" });
  assert.equal(stealDelete.status, 404, "a bank cannot delete another bank's key");
  const clash = await aliasCall(aliasBody({ message_id: "REG-3", key_value: "+254700000001" }), { code: "BANKBGHA", secret: SECRET_B });
  assert.equal(clash.status, 409, "cannot shadow an operator-held key");
  const del = await aliasCall(aliasBody({ message_id: "DEL-2", action: "delete" }), { code: "BANKBGHA", secret: SECRET_B });
  assert.equal(del.status, 200);
  const bad = await aliasCall(aliasBody({ message_id: "REG-4", currency: "ZZZ" }), { code: "BANKBGHA", secret: SECRET_B });
  assert.equal(bad.status, 400);
  const badType = await aliasCall(aliasBody({ message_id: "REG-5", key_type: "random" }), { code: "BANKBGHA", secret: SECRET_B });
  assert.equal(badType.status, 400);
});

// ---------- forwarding (bank → another bank's key) ----------
let keySeq = 0;
async function registerBankBKey(): Promise<void> {
  const r = await aliasCall(aliasBody({ message_id: `REG-AUTO-${++keySeq}` }), { code: "BANKBGHA", secret: SECRET_B });
  assert.equal(r.status, 201);
}
type MockRules = ConstructorParameters<typeof import("../services/scheme/adapters.js").MockBankAdapter>[1];
const bankBOverride = (rules: MockRules) => {
  const mock = new m.adapters.MockBankAdapter("BANKBGHA", rules);
  m.ext.setAdapterOverrideForTests((p) => (p.code === "BANKBGHA" ? mock : null));
  return mock;
};

test("forwarding: bank A pays a key at bank B — switch relays pacs.008, clears, replies ACSC, replay is stable", { skip }, async () => {
  await registerBankBKey();
  const mock = bankBOverride({});
  const xml = pacs008({ e2e: "EFWD00000000000000001", alias: "+233200000001", creditorCode: "BANKBGHA", amount: 200 });
  const r = await credit(xml);
  assert.equal(r.status, 200);
  assert.equal(txStatus(r.text), "ACSC");
  assert.equal(mock.calls.length, 1);
  assert.equal(mock.calls[0].creditorAlias, "+233200000001");
  assert.equal(mock.calls[0].creditor.participantCode, "BANKBGHA");
  const [t] = await transfers();
  assert.equal(t.status, "cleared");
  assert.equal(t.senderParticipantId, w.bankA.id);
  assert.equal(t.recipientParticipantId, w.bankB.id);

  const again = await credit(xml);
  assert.equal(again.status, 200);
  assert.equal(mock.calls.length, 1, "replay must not be forwarded twice");
});

test("forwarding: bank B declines → RJCT to A, transfer rejected, no exposure left behind", { skip }, async () => {
  await registerBankBKey();
  bankBOverride({ maxAmount: 100 });
  const r = await credit(pacs008({ e2e: "EFWD00000000000000002", alias: "+233200000001", creditorCode: "BANKBGHA", amount: 600 }));
  assert.equal(r.status, 422);
  assert.equal(reason(r.text), "AM02");
  const [t] = await transfers();
  assert.equal(t.status, "rejected");
  // exposure must be released: a full-cap payment still fits afterwards
  bankBOverride({});
  const next = await credit(pacs008({ e2e: "EFWD00000000000000003", alias: "+233200000001", creditorCode: "BANKBGHA", amount: 1000 }));
  assert.equal(next.status, 200);
});

test("forwarding: unknown outcome → 202 PDNG, held as unresolved, still counted against the cap, status query agrees", { skip }, async () => {
  await registerBankBKey();
  bankBOverride({ unknownAliasPrefix: "+2332" });
  const xml = pacs008({ e2e: "EFWD00000000000000004", alias: "+233200000001", creditorCode: "BANKBGHA", amount: 700 });
  const r = await credit(xml);
  assert.equal(r.status, 202);
  assert.equal(txStatus(r.text), "PDNG");
  const [t] = await transfers();
  assert.equal(t.status, "unresolved");

  const replay = await credit(xml);
  assert.equal(replay.status, 202, "replay reflects live status, not a fresh attempt");

  // unresolved credit still counts: 700 + 700 > 1000 cap
  const blocked = await credit(pacs008({ e2e: "EFWD00000000000000005", alias: "+254700000001", amount: 700 }));
  assert.equal(reason(blocked.text), "AM23");

  const q = await send("/api/gateway/v1/status/EFWD00000000000000004", "EFWD00000000000000004", { method: "GET" });
  assert.equal(q.status, 200);
  assert.equal(txStatus(q.text), "PDNG");
  const other = await send("/api/gateway/v1/status/EFWD00000000000000004", "EFWD00000000000000004", { method: "GET", code: "BANKBGHA", secret: SECRET_B });
  assert.equal(other.status, 200, "the receiving bank may also query it");
  const missing = await send("/api/gateway/v1/status/NOPE0000000000000000", "NOPE0000000000000000", { method: "GET" });
  assert.equal(missing.status, 404);
});

test("forwarding: unreachable recipient bank → rejected before anything is reserved", { skip }, async () => {
  await registerBankBKey(); // no adapter configured for BANKBGHA
  const r = await credit(pacs008({ e2e: "EFWD00000000000000006", alias: "+233200000001", creditorCode: "BANKBGHA" }));
  assert.equal(r.status, 422);
  assert.equal(reason(r.text), "AC13");
  assert.equal((await transfers()).length, 0);
});

// ---------- outbound (operator user → bank-held key) ----------
type PayInput = Parameters<typeof import("../services/scheme/switchEngine.js").processInstantPayment>[0];
const pay = (over: Partial<PayInput> = {}) =>
  m.engine.processInstantPayment({ senderUserId: w.alice.id, senderEmail: "alice@example.com", alias: "+233200000001", amount: 100, walletId: w.alice.walletId, ...over });

async function makeAdmin(): Promise<number> {
  const [admin] = await m.db.db.insert(m.db.usersTable).values({ email: "admin@example.com", name: "Admin", passwordHash: "x", role: "admin" }).returning();
  return admin.id;
}

test("outbound: accepted by the bank → sender debited once, transfer cleared", { skip }, async () => {
  await registerBankBKey();
  const mock = bankBOverride({});
  const r = await pay();
  assert.equal(r.ok, true);
  assert.equal(r.transfer?.status, "cleared");
  assert.equal(await balance(w.alice.walletId), 900);
  assert.equal(mock.calls.length, 1);
  assert.equal(mock.calls[0].debtor.participantCode, "IAPAYPAN");
  assert.equal(mock.calls[0].creditorAlias, "+233200000001");
});

test("outbound: declined by the bank → sender refunded exactly once, transfer rejected", { skip }, async () => {
  await registerBankBKey();
  bankBOverride({ rejectAliasPrefix: "+2332" });
  const r = await pay();
  assert.equal(r.ok, false);
  assert.equal(r.code, "PARTICIPANT_REJECTED");
  assert.equal(await balance(w.alice.walletId), 1000, "full refund");
  const [t] = await transfers();
  assert.equal(t.status, "rejected");
  const [tx] = await m.db.db.select().from(m.db.transactionsTable).where(m.drizzle.eq(m.db.transactionsTable.reference, t.reference));
  assert.equal(tx.status, "failed");
});

test("outbound: unknown outcome → funds held, never auto-refunded; operator resolves exactly once", { skip }, async () => {
  await registerBankBKey();
  bankBOverride({ unknownAliasPrefix: "+2332" });
  const r = await pay();
  assert.equal(r.ok, false);
  assert.equal(r.status, 202);
  assert.equal(r.code, "PAYMENT_PENDING");
  assert.equal(await balance(w.alice.walletId), 900, "held, not refunded");
  const [t] = await transfers();
  assert.equal(t.status, "unresolved");

  assert.equal(await m.ext.sweepStalePending(0), 0, "the sweeper leaves unresolved rows alone");

  const adminId = await makeAdmin();
  const refund = await m.ext.resolveUnresolvedTransfer(t.reference, "not_credited", adminId, "bank confirmed not credited");
  assert.equal(refund.ok, true);
  assert.equal(await balance(w.alice.walletId), 1000, "refunded");
  const again = await m.ext.resolveUnresolvedTransfer(t.reference, "not_credited", adminId, "double click");
  assert.equal(again.ok, false);
  assert.equal(again.status, 409);
  const flip = await m.ext.resolveUnresolvedTransfer(t.reference, "credited", adminId, "changed mind");
  assert.equal(flip.status, 409, "a resolved transfer cannot be flipped");
  assert.equal(await balance(w.alice.walletId), 1000, "refunded once only");

  const audit = await m.db.db.select().from(m.db.auditLogsTable).where(m.drizzle.eq(m.db.auditLogsTable.action, "iapay_resolve_unresolved_transfer"));
  assert.equal(audit.length, 1, "only the successful resolution is audited");
});

test("outbound: unknown outcome later confirmed credited → transfer clears, money stays debited", { skip }, async () => {
  await registerBankBKey();
  bankBOverride({ unknownAliasPrefix: "+2332" });
  await pay();
  const [t] = await transfers();
  const adminId = await makeAdmin();
  const ok = await m.ext.resolveUnresolvedTransfer(t.reference, "credited", adminId, "bank confirmed credited");
  assert.equal(ok.ok, true);
  assert.equal((await transfers())[0].status, "cleared");
  assert.equal(await balance(w.alice.walletId), 900);
  const back = await m.ext.resolveUnresolvedTransfer(t.reference, "not_credited", adminId, "oops");
  assert.equal(back.status, 409);
  assert.equal(await balance(w.alice.walletId), 900, "no refund after clearing");
});

test("outbound: concurrent payments cannot overspend the wallet", { skip }, async () => {
  await registerBankBKey();
  bankBOverride({});
  await m.db.db.update(m.db.walletsTable).set({ balance: "100.00" }).where(m.drizzle.eq(m.db.walletsTable.id, w.alice.walletId));
  const results = await Promise.all(Array.from({ length: 6 }, () => pay({ amount: 60 })));
  const okCount = results.filter((r) => r.ok).length;
  assert.equal(okCount, 1, "only one 60 payment fits in 100");
  assert.equal(await balance(w.alice.walletId), 40);
  assert.equal((await transfers()).filter((t) => t.status === "cleared").length, 1);
});

test("outbound: bank-held key with no reachable adapter is refused and charges nothing", { skip }, async () => {
  await registerBankBKey(); // no adapter
  const r = await pay();
  assert.equal(r.ok, false);
  assert.equal(r.code, "PARTICIPANT_UNAVAILABLE");
  assert.equal(await balance(w.alice.walletId), 1000);
  assert.equal((await transfers()).length, 0);
});

test("outbound: insufficient funds is refused before any bank call", { skip }, async () => {
  await registerBankBKey();
  const mock = bankBOverride({});
  const r = await pay({ amount: 5000 });
  assert.equal(r.ok, false);
  assert.equal(mock.calls.length, 0);
  assert.equal(await balance(w.alice.walletId), 1000);
});

test("sweeper parks stale pending transfers as unresolved and leaves fresh ones alone", { skip }, async () => {
  const row = { senderParticipantId: w.home.id, recipientParticipantId: w.bankB.id, recipientAlias: "+233200000001", amount: "10", currency: "USD", recipientAmount: "10", recipientCurrency: "USD", status: "pending" };
  await m.db.db.insert(m.db.schemeTransfersTable).values([
    { ...row, reference: "OLD1", endToEndId: "EOLD1", initiatedAt: new Date(Date.now() - 3600_000) },
    { ...row, reference: "NEW1", endToEndId: "ENEW1" },
  ]);
  assert.equal(await m.ext.sweepStalePending(10 * 60_000), 1);
  const rows = Object.fromEntries((await transfers()).map((t) => [t.reference, t.status]));
  assert.deepEqual(rows, { OLD1: "unresolved", NEW1: "pending" });
});

// ---------- regression: legacy home → home path and settlement ----------
test("regression: home → home instant payment still works and moves money atomically", { skip }, async () => {
  const r = await pay({ alias: "bob@example.com", amount: 50 });
  assert.equal(r.ok, true);
  assert.equal(await balance(w.alice.walletId), 950);
  assert.equal(await balance(w.bob.walletId), 550);
  assert.equal(r.transfer?.status, "cleared");
});

test("settlement nets only cleared transfers; pending and unresolved are untouched", { skip }, async () => {
  await credit(pacs008({ e2e: "ESET00000000000000001", alias: "+254700000001", amount: 300 })); // bank A → home (cleared)
  await registerBankBKey();
  bankBOverride({ unknownAliasPrefix: "+2332" });
  await pay({ amount: 100 }); // home → bank B (unresolved)

  const summary = await m.settlement.closeSettlementCycle();
  assert.ok(summary);
  assert.equal(summary!.transferCount, 1);
  const statuses = new Set((await transfers()).map((t) => t.status));
  assert.deepEqual([...statuses].sort(), ["settled", "unresolved"]);
  const net = (id: number) => Number(summary!.positions.find((p) => p.participantId === id)?.netPosition);
  assert.equal(net(w.bankA.id), -300);
  assert.equal(net(w.home.id), 300);
});

// ---------- regressions for the independent security review ----------
test("review #1: sub-cent / fractional-cent / non-positive amounts are refused — no money from nothing", { skip }, async () => {
  for (const amount of [0.004, 0.001, 10.005, 0, -5, Number.NaN, Number.POSITIVE_INFINITY]) {
    const r = await pay({ alias: "bob@example.com", amount });
    assert.equal(r.ok, false, `amount ${amount}`);
    assert.equal(r.status, 400, `amount ${amount}`);
  }
  assert.equal(await balance(w.alice.walletId), 1000);
  assert.equal(await balance(w.bob.walletId), 500);
  assert.equal((await transfers()).length, 0);
});

test("review #1: a conversion that rounds to zero is refused (nothing debited, nothing credited)", { skip }, async () => {
  const [ngn] = await m.db.db.insert(m.db.walletsTable).values({ userId: w.alice.id, currency: "NGN", balance: "5000.00" }).returning();
  const r = await pay({ alias: "bob@example.com", amount: 1, walletId: ngn.id }); // 1 NGN ≈ 0.0006 USD
  assert.equal(r.ok, false);
  assert.equal(r.status, 400);
  assert.equal(await balance(ngn.id), 5000);
  assert.equal(await balance(w.bob.walletId), 500);
});

test("review #2: concurrent returns of one payment refund exactly once", { skip }, async () => {
  const sent = await pay({ alias: "bob@example.com", amount: 50 });
  assert.equal(sent.ok, true);
  const ref = sent.transfer!.reference;
  const { returnSchemeTransfer } = await import("../services/scheme/returns.js");
  const results = await Promise.all(Array.from({ length: 4 }, () => returnSchemeTransfer(ref, w.bob.id, "sent by mistake", "recipient")));
  assert.equal(results.filter((r) => r.ok).length, 1, "exactly one return succeeds");
  for (const r of results.filter((x) => !x.ok)) assert.equal(r.status, 409);
  assert.equal(await balance(w.alice.walletId), 1000, "sender refunded once");
  assert.equal(await balance(w.bob.walletId), 500, "recipient debited once");
});

test("review #3: a numeric national-id key cannot shadow a phone number typed without '+'", { skip }, async () => {
  const [carol] = await m.db.db.insert(m.db.usersTable).values({ email: "carol@example.com", name: "Carol Njeri", firstName: "Carol", lastName: "Njeri", passwordHash: "x", kycLevel: "2", kycStatus: "verified" }).returning();
  const [carolWallet] = await m.db.db.insert(m.db.walletsTable).values({ userId: carol.id, currency: "USD", balance: "100.00" }).returning();
  // attacker (bob) registers a national-id key FIRST; victim (alice) later owns the real phone key
  await m.db.db.insert(m.db.paymentAliasesTable).values({ aliasType: "national_id", aliasValue: "254712345678", userId: w.bob.id, participantId: w.home.id, accountRef: "w-bob", currency: "USD", status: "active" });
  await m.db.db.insert(m.db.paymentAliasesTable).values({ aliasType: "phone", aliasValue: "+254712345678", userId: w.alice.id, participantId: w.home.id, accountRef: "w-alice", currency: "USD", status: "active" });
  const r = await pay({ senderUserId: carol.id, senderEmail: "carol@example.com", alias: "254712345678", amount: 10, walletId: carolWallet.id });
  assert.equal(r.ok, true);
  assert.equal(await balance(w.alice.walletId), 1010, "the phone owner is paid");
  assert.equal(await balance(w.bob.walletId), 500, "the squatter is not");
});

test("review #3: bank messages resolve keys by exact stored value only", { skip }, async () => {
  const r = await credit(pacs008({ e2e: "EEXA00000000000000001", alias: "254700000001" })); // registered as +254700000001
  assert.equal(r.status, 422);
  assert.equal(reason(r.text), "AC03");
  assert.equal(await balance(w.alice.walletId), 1000);
});

test("review #4: concurrent first-time credits create exactly one wallet", { skip }, async () => {
  const [dana] = await m.db.db.insert(m.db.usersTable).values({ email: "dana@example.com", name: "Dana K", firstName: "Dana", lastName: "K", passwordHash: "x" }).returning();
  await m.db.db.insert(m.db.paymentAliasesTable).values({ aliasType: "phone", aliasValue: "+254700000009", userId: dana.id, participantId: w.home.id, accountRef: "w-dana", currency: "EUR", status: "active" });
  const results = await Promise.all(
    Array.from({ length: 6 }, (_, i) => credit(pacs008({ e2e: `EWAL${String(i).padStart(17, "0")}`, alias: "+254700000009", amount: 10, currency: "EUR" })))
  );
  assert.equal(results.filter((r) => r.status === 200).length, 6);
  const wallets = await m.db.db.select().from(m.db.walletsTable).where(m.drizzle.and(m.drizzle.eq(m.db.walletsTable.userId, dana.id), m.drizzle.eq(m.db.walletsTable.currency, "EUR")));
  assert.equal(wallets.length, 1, "one EUR wallet, not one per racing request");
  assert.equal(Number(wallets[0].balance), 60);
});

test("review #7: concurrent settlement runs net each batch exactly once", { skip }, async () => {
  await credit(pacs008({ e2e: "ESTL00000000000000001", alias: "+254700000001", amount: 300 }));
  const runs = await Promise.all([m.settlement.closeSettlementCycle(), m.settlement.closeSettlementCycle(), m.settlement.closeSettlementCycle()]);
  assert.equal(runs.filter((r) => r !== null).length, 1, "only one run claims the batch");
  const positions = await m.db.db.select().from(m.db.settlementPositionsTable);
  assert.equal(positions.length, 2, "no duplicate positions");
  const [a] = await m.db.db.select().from(m.db.schemeParticipantsTable).where(m.drizzle.eq(m.db.schemeParticipantsTable.id, w.bankA.id));
  assert.equal(Number(a.settlementBalance), -300, "settlement balance applied once");
});

test("review #10: alias message ids are bound to their request body", { skip }, async () => {
  const first = await aliasCall(aliasBody({ message_id: "BIND-1" }), { code: "BANKBGHA", secret: SECRET_B });
  assert.equal(first.status, 201);
  const swapped = await aliasCall(aliasBody({ message_id: "BIND-1", key_value: "+233200000777" }), { code: "BANKBGHA", secret: SECRET_B });
  assert.equal(swapped.status, 422, "same message_id with a different body is refused, not replayed as success");
  const rows = await m.db.db.select().from(m.db.paymentAliasesTable).where(m.drizzle.eq(m.db.paymentAliasesTable.aliasValue, "+233200000777"));
  assert.equal(rows.length, 0);
});

test("review #10: the operator's own code can never act as an external sender", { skip }, async () => {
  const prior = process.env.GATEWAY_PARTICIPANT_SECRETS;
  process.env.GATEWAY_PARTICIPANT_SECRETS = JSON.stringify({ ...JSON.parse(prior!), IAPAYPAN: "operator-secret-0123456789abcdef" });
  try {
    const r = await credit(pacs008({ e2e: "EHOM00000000000000001", alias: "+254700000001", debtorCode: "IAPAYPAN" }), { code: "IAPAYPAN", secret: "operator-secret-0123456789abcdef" });
    assert.equal(r.status, 422);
    assert.equal(reason(r.text), "RC01");
    assert.equal(await balance(w.alice.walletId), 1000);
  } finally {
    process.env.GATEWAY_PARTICIPANT_SECRETS = prior;
  }
});

// ---------- portable KYC storage (works on any host) ----------
test("local KYC storage: signed single-use uploads, content checks, authenticated download, no traversal", { skip }, async () => {
  const fsp = await import("node:fs/promises");
  const os = await import("node:os");
  const path = await import("node:path");
  const dir = await fsp.mkdtemp(path.join(os.tmpdir(), "iapay-kyc-"));
  process.env.OBJECT_STORAGE = "local";
  process.env.LOCAL_STORAGE_DIR = dir;
  try {
    const user = await tokenFor(w.bob.id, "bob@example.com", "user");
    const png = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(64, 7)]);
    const requestUrl = async (contentType: string) => adminApi("/api/kyc/upload-url", { method: "POST", token: user, body: { contentType } });
    const put = (url: string, body: Buffer, type: string) => fetch(baseUrl + url, { method: "PUT", headers: { "content-type": type }, body });

    assert.equal((await adminApi("/api/kyc/upload-url", { method: "POST", body: { contentType: "image/png" } })).status, 401, "login required to obtain an upload URL");
    assert.equal((await requestUrl("text/html")).status, 400, "only JPEG/PNG/WebP/PDF");
    assert.equal((await requestUrl("application/x-msdownload")).status, 400);

    const ticket = await requestUrl("image/png");
    assert.equal(ticket.status, 200);
    const { uploadURL, objectPath } = ticket.json as { uploadURL: string; objectPath: string };
    assert.ok(objectPath.startsWith("/objects/uploads/"));
    assert.equal((await put(uploadURL, png, "image/png")).status, 200);
    assert.equal((await put(uploadURL, png, "image/png")).status, 409, "an upload URL works once and never overwrites");

    const id = objectPath.split("/").pop()!;
    const dl = await fetch(`${baseUrl}/api/storage/objects/uploads/${id}`, { headers: { authorization: `Bearer ${user}` } });
    assert.equal(dl.status, 200);
    assert.equal(dl.headers.get("content-type"), "image/png");
    assert.equal(dl.headers.get("x-content-type-options"), "nosniff");
    assert.ok(Buffer.from(await dl.arrayBuffer()).equals(png), "bytes round-trip exactly");
    assert.equal((await fetch(`${baseUrl}/api/storage/objects/uploads/${id}`)).status, 401, "download requires login");

    // content checks (each needs a fresh ticket)
    const t2 = (await requestUrl("image/png")).json as { uploadURL: string };
    assert.equal((await put(t2.uploadURL, png, "application/pdf")).status, 415, "declared type must match the ticket");
    assert.equal((await put(t2.uploadURL, Buffer.from("<script>alert(1)</script>"), "image/png")).status, 415, "magic bytes must match the type");
    assert.equal((await put(t2.uploadURL, Buffer.alloc(0), "image/png")).status, 413, "empty file refused");
    const tampered = t2.uploadURL.slice(0, -2) + (t2.uploadURL.endsWith("AA") ? "BB" : "AA");
    assert.equal((await put(tampered, png, "image/png")).status, 403, "tampered token refused");
    assert.equal((await put("/api/storage/local-upload/not-a-token", png, "image/png")).status, 403);
    assert.equal((await put(t2.uploadURL, Buffer.concat([png, Buffer.alloc(10 * 1024 * 1024)]), "image/png")).status, 413, "over 10 MB refused");

    // traversal / probing
    for (const p of ["uploads/..%2f..%2fetc%2fpasswd", `uploads/${id}.type`, "uploads/not-a-uuid", "../../etc/passwd"]) {
      const r = await fetch(`${baseUrl}/api/storage/objects/${p}`, { headers: { authorization: `Bearer ${user}` } });
      assert.equal(r.status, 404, p);
    }

    // the stored object can be attached to a KYC submission
    const submit = await adminApi("/api/kyc/submit", { method: "POST", token: user, body: { document_type: "national_id", document_number: "12345678", file_path: objectPath } });
    assert.equal(submit.status, 200);
  } finally {
    delete process.env.OBJECT_STORAGE;
    delete process.env.LOCAL_STORAGE_DIR;
    await fsp.rm(dir, { recursive: true, force: true });
  }
});

// ---------- first-run bootstrap ----------
test("bootstrap: creates the client's own admin once, never alters an existing one, never promotes anyone", { skip }, async () => {
  const { bootstrapOperator } = await import("../lib/bootstrapOperator.js");
  const email = "Ops@Client.Example";
  const first = await bootstrapOperator({ email, password: "Cl1ent-Str0ng#Passphrase", name: "Ada Client" });
  assert.equal(first.adminCreated, true);
  const [admin] = await m.db.db.select().from(m.db.usersTable).where(m.drizzle.eq(m.db.usersTable.email, "ops@client.example"));
  assert.equal(admin.role, "admin");
  assert.equal(admin.firstName, "Ada");
  assert.equal(admin.lastName, "Client");
  assert.notEqual(admin.passwordHash, "Cl1ent-Str0ng#Passphrase");
  assert.ok((await m.db.db.select().from(m.db.walletsTable).where(m.drizzle.eq(m.db.walletsTable.userId, admin.id))).length >= 1);

  const again = await bootstrapOperator({ email, password: "Another-Str0ng#Passphrase" });
  assert.equal(again.adminCreated, false, "idempotent");
  const [unchanged] = await m.db.db.select().from(m.db.usersTable).where(m.drizzle.eq(m.db.usersTable.id, admin.id));
  assert.equal(unchanged.passwordHash, admin.passwordHash, "an existing admin's password is never overwritten");

  await assert.rejects(bootstrapOperator({ email: "new@client.example", password: "password" }), /rejected/);
  await assert.rejects(bootstrapOperator({ email: "not-an-email", password: "Cl1ent-Str0ng#Passphrase" }), /valid email/);
  await assert.rejects(bootstrapOperator({ email: "alice@example.com", password: "Cl1ent-Str0ng#Passphrase" }), /non-admin/);
  const [alice] = await m.db.db.select().from(m.db.usersTable).where(m.drizzle.eq(m.db.usersTable.email, "alice@example.com"));
  assert.equal(alice.role, "user", "an ordinary account is never promoted");
});

// ---------- operator self-service onboarding ----------
async function adminApi(path: string, init: { method?: string; body?: unknown; token?: string } = {}): Promise<{ status: number; json: Record<string, any>; raw: string }> {
  const res = await fetch(baseUrl + path, {
    method: init.method ?? "GET",
    headers: { "content-type": "application/json", ...(init.token ? { authorization: `Bearer ${init.token}` } : {}) },
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
  });
  const raw = await res.text();
  let json: Record<string, any> = {};
  try { json = JSON.parse(raw); } catch { /* non-JSON */ }
  return { status: res.status, json, raw };
}
async function tokenFor(userId: number, email: string, role: string): Promise<string> {
  const { signToken } = await import("../lib/auth.js");
  return signToken({ id: userId, email, role });
}
const newBank = { code: "NEWBANKNGA", name: "New Bank Nigeria", type: "bank", country: "NG", currency: "USD", net_debit_cap_usd: 500 };

test("onboarding: an operator brings a bank online end to end with no restart or env edit", { skip }, async () => {
  const admin = await tokenFor(await makeAdmin(), "admin@example.com", "admin");
  const created = await adminApi("/api/scheme/participants", { method: "POST", token: admin, body: newBank });
  assert.equal(created.status, 201);
  const secret: string = created.json.gateway_secret;
  assert.ok(typeof secret === "string" && secret.length >= 40, "a strong secret is generated");
  assert.equal(created.json.participant.has_gateway_secret, true);
  assert.equal(created.json.participant.net_debit_cap_usd, 500);
  assert.ok(!created.raw.includes("gateway_secret_enc"), "the encrypted blob is never returned");

  const [row] = await m.db.db.select().from(m.db.schemeParticipantsTable).where(m.drizzle.eq(m.db.schemeParticipantsTable.code, "NEWBANKNGA"));
  assert.ok(row.gatewaySecretEnc!.startsWith("v1."), "stored encrypted");
  assert.ok(!row.gatewaySecretEnc!.includes(secret), "never stored in plaintext");

  const publicList = await adminApi("/api/scheme/participants", { token: admin });
  assert.ok(!publicList.raw.includes(secret) && !publicList.raw.includes("gateway_secret") && !publicList.raw.includes("v1."), "public registry leaks nothing");
  const adminList = await adminApi("/api/scheme/admin/participants", { token: admin });
  assert.ok(!adminList.raw.includes(secret) && !adminList.raw.includes("v1."), "admin registry shows only has_gateway_secret");

  const asNew = (e2e: string, amount: number) => credit(pacs008({ e2e, alias: "+254700000001", amount, debtorCode: "NEWBANKNGA" }), { code: "NEWBANKNGA", secret });
  assert.equal((await asNew("EONB00000000000000001", 100)).status, 200, "the new bank can send immediately with its issued secret");
  assert.equal(reason((await asNew("EONB00000000000000002", 600)).text), "AM23", "its cap (500) is enforced");

  assert.equal((await adminApi("/api/scheme/participants/newbanknga", { method: "PUT", token: admin, body: { net_debit_cap_usd: 5000 } })).status, 200);
  assert.equal((await asNew("EONB00000000000000003", 600)).status, 200, "raised cap takes effect at once");

  assert.equal((await adminApi("/api/scheme/participants/NEWBANKNGA", { method: "PUT", token: admin, body: { status: "suspended" } })).status, 200);
  assert.equal((await asNew("EONB00000000000000004", 1)).status, 401, "a suspended bank is locked out");
  assert.equal((await adminApi("/api/scheme/participants/NEWBANKNGA", { method: "PUT", token: admin, body: { status: "active" } })).status, 200);
  assert.equal((await asNew("EONB00000000000000005", 1)).status, 200);

  const rotated = await adminApi("/api/scheme/participants/NEWBANKNGA/rotate-secret", { method: "POST", token: admin });
  assert.equal(rotated.status, 200);
  const newSecret: string = rotated.json.gateway_secret;
  assert.notEqual(newSecret, secret);
  assert.equal((await asNew("EONB00000000000000006", 1)).status, 401, "the old secret stops working immediately");
  const withNew = await credit(pacs008({ e2e: "EONB00000000000000007", alias: "+254700000001", amount: 1, debtorCode: "NEWBANKNGA" }), { code: "NEWBANKNGA", secret: newSecret });
  assert.equal(withNew.status, 200);

  const actions = (await m.db.db.select().from(m.db.auditLogsTable)).map((a) => a.action);
  for (const a of ["iapay_participant_created", "iapay_participant_updated", "iapay_participant_secret_rotated"]) assert.ok(actions.includes(a), `audit: ${a}`);
});

test("onboarding: validation and authorization", { skip }, async () => {
  const adminId = await makeAdmin();
  const admin = await tokenFor(adminId, "admin@example.com", "admin");
  const user = await tokenFor(w.bob.id, "bob@example.com", "user");
  for (const [method, path, body] of [
    ["POST", "/api/scheme/participants", newBank],
    ["PUT", "/api/scheme/participants/BANKAKEN", { net_debit_cap_usd: 999999 }],
    ["POST", "/api/scheme/participants/BANKAKEN/rotate-secret", undefined],
    ["GET", "/api/scheme/admin/participants", undefined],
  ] as const) {
    assert.equal((await adminApi(path, { method, body, token: user })).status, 403, `${method} ${path} must be admin-only`);
    assert.equal((await adminApi(path, { method, body })).status, 401, `${method} ${path} must require login`);
  }
  const post = (body: unknown) => adminApi("/api/scheme/participants", { method: "POST", token: admin, body });
  assert.equal((await post({ ...newBank, code: "IAPAYPAN" })).status, 400, "cannot create a participant with the operator's code");
  assert.equal((await post({ ...newBank, code: "ab" })).status, 400);
  assert.equal((await post({ ...newBank, country: "Nigeria" })).status, 400);
  assert.equal((await post({ ...newBank, type: "casino" })).status, 400);
  assert.equal((await post({ ...newBank, net_debit_cap_usd: -1 })).status, 400);
  assert.equal((await post({ ...newBank, net_debit_cap_usd: "1000" })).status, 400, "cap must be a number");
  assert.equal((await post({ ...newBank, api_url: "http://localhost/internal" })).status, 400, "internal URLs are refused");
  assert.equal((await post({ ...newBank, api_url: "https://169.254.169.254/x" })).status, 400);
  assert.equal((await post({ ...newBank, code: "BANKAKEN" })).status, 409);
  assert.equal((await adminApi("/api/scheme/participants/IAPAYPAN", { method: "PUT", token: admin, body: { status: "suspended" } })).status, 400, "the operator cannot be suspended");
  assert.equal((await adminApi("/api/scheme/participants/NOPE", { method: "PUT", token: admin, body: { status: "active" } })).status, 404);
  assert.equal((await adminApi("/api/scheme/participants/BANKAKEN", { method: "PUT", token: admin, body: {} })).status, 400);
  assert.equal((await adminApi("/api/scheme/participants/IAPAYPAN/rotate-secret", { method: "POST", token: admin })).status, 400);
});

test("onboarding: without GATEWAY_SECRETS_KEY no secret is stored or issued (fail closed)", { skip }, async () => {
  const admin = await tokenFor(await makeAdmin(), "admin@example.com", "admin");
  delete process.env.GATEWAY_SECRETS_KEY;
  try {
    const created = await adminApi("/api/scheme/participants", { method: "POST", token: admin, body: newBank });
    assert.equal(created.status, 201);
    assert.equal(created.json.gateway_secret, null);
    assert.equal(created.json.participant.has_gateway_secret, false);
    assert.equal((await adminApi("/api/scheme/participants/NEWBANKNGA/rotate-secret", { method: "POST", token: admin })).status, 503);
  } finally {
    process.env.GATEWAY_SECRETS_KEY = SECRETS_KEY;
  }
});

test("onboarding: a stored secret that cannot be decrypted (wrong key) authenticates nobody", { skip }, async () => {
  const admin = await tokenFor(await makeAdmin(), "admin@example.com", "admin");
  const created = await adminApi("/api/scheme/participants", { method: "POST", token: admin, body: newBank });
  const secret: string = created.json.gateway_secret;
  const attempt = () => credit(pacs008({ e2e: `EKEY${Math.random().toString(36).slice(2, 14).padEnd(12, "0")}`, alias: "+254700000001", amount: 1, debtorCode: "NEWBANKNGA" }), { code: "NEWBANKNGA", secret });
  assert.equal((await attempt()).status, 200);
  process.env.GATEWAY_SECRETS_KEY = "a-completely-different-key-0123456789abcdef";
  try {
    assert.equal((await attempt()).status, 401, "wrong master key => cannot verify => rejected");
  } finally {
    process.env.GATEWAY_SECRETS_KEY = SECRETS_KEY;
  }
  assert.equal((await attempt()).status, 200, "restoring the key restores access");
});

test("stale exchange rates pause inter-institution payments in production mode and create nothing", { skip }, async () => {
  await registerBankBKey();
  bankBOverride({});
  process.env.GATEWAY_REQUIRE_LIVE_RATES = "true"; // as in production; rates here are static fallbacks (never fresh)
  try {
    const inbound = await credit(pacs008({ e2e: "ERATE0000000000000001", alias: "+254700000001", amount: 10 }));
    assert.equal(inbound.status, 503);
    assert.equal((await m.db.db.select().from(m.db.gatewayMessagesTable)).filter((r) => r.msgId.startsWith("MERATE")).length, 0, "nothing recorded");
    const outbound = await pay();
    assert.equal(outbound.ok, false);
    assert.equal(outbound.code, "RATES_UNAVAILABLE");
    assert.equal(await balance(w.alice.walletId), 1000, "nothing debited");
    assert.equal((await transfers()).length, 0);
  } finally {
    delete process.env.GATEWAY_REQUIRE_LIVE_RATES;
  }
  assert.equal((await credit(pacs008({ e2e: "ERATE0000000000000002", alias: "+254700000001", amount: 10 }))).status, 200, "unaffected when not required");
});

test("review #6: a late bank ACSC after an operator refund is flagged for reconciliation, not silently dropped", { skip }, async () => {
  await registerBankBKey();
  bankBOverride({ unknownAliasPrefix: "+2332" });
  await pay();
  const [t] = await transfers();
  const adminId = await makeAdmin();
  await m.ext.resolveUnresolvedTransfer(t.reference, "not_credited", adminId, "bank said not credited");
  assert.equal(await balance(w.alice.walletId), 1000);

  const [refreshed] = await transfers();
  const [homeP] = await m.db.db.select().from(m.db.schemeParticipantsTable).where(m.drizzle.eq(m.db.schemeParticipantsTable.id, w.home.id));
  const [bankBP] = await m.db.db.select().from(m.db.schemeParticipantsTable).where(m.drizzle.eq(m.db.schemeParticipantsTable.id, w.bankB.id));
  const lateAcsc = new m.adapters.MockBankAdapter("BANKBGHA", {});
  const iso = m.ext.toIso(refreshed, { name: "Alice", participant: homeP }, { name: "Kofi", participant: bankBP });
  const outcome = await m.ext.dispatchAndFinalize(refreshed, iso, lateAcsc);
  assert.equal(outcome.transfer.status, "rejected", "final state is not overwritten");
  assert.equal(await balance(w.alice.walletId), 1000, "no second movement of money");
  const flagged = await m.db.db.select().from(m.db.auditLogsTable).where(m.drizzle.eq(m.db.auditLogsTable.action, "iapay_reconciliation_contradiction"));
  assert.equal(flagged.length, 1, "the contradiction is recorded for manual reconciliation");
});
